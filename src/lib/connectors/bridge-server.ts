import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import type { Server } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { handleMockBridgeRequest } from './bridge-contract';
import { createLiveBridgeClient } from './bridge-client';

function constantTimeEquals(provided: string, expected: string): boolean {
  // Hash both sides so timingSafeEqual always sees equal-length buffers —
  // a raw length early-return leaks the expected token's length.
  const left = createHash('sha256').update(provided || '').digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export type BridgeServerConfig = {
  port?: number;
  host?: string;
  mode?: 'mock' | 'live';
  liveUrl?: string;
  authToken?: string;
  mockDelay?: number;
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
};

export class BridgeServer {
  private app: express.Application;
  private config: BridgeServerConfig;
  private liveClient?: ReturnType<typeof createLiveBridgeClient>;
  private server?: Server;

  constructor(config: BridgeServerConfig = {}) {
    this.config = {
      port: 3001,
      // Loopback by default — this bridge is called server-to-server by the
      // Next app; exposing it on 0.0.0.0 makes it reachable from any network
      // the host is attached to. Override with BRIDGE_HOST only knowingly.
      host: process.env.BRIDGE_HOST?.trim() || '127.0.0.1',
      mode: 'mock',
      mockDelay: 50,
      rateLimitWindowMs: 15 * 60 * 1000,
      rateLimitMax: 100,
      ...config,
      authToken: config.authToken ?? process.env.BRIDGE_AUTH_TOKEN?.trim() ?? ''
    };
    if (this.config.mode === 'live' && !this.config.authToken) {
      throw new Error(
        'BridgeServer live mode requires an auth token (set BRIDGE_AUTH_TOKEN or pass authToken)'
      );
    }
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.liveClient = this.config.mode === 'live'
      ? createLiveBridgeClient(this.config.liveUrl!)
      : undefined;
  }

  private setupMiddleware() {
    this.app.use(helmet());
    // No CORS by default: this bridge is called server-to-server, so browser
    // cross-origin reads must fail. Set BRIDGE_ALLOWED_ORIGINS (comma-separated)
    // only if a browser client genuinely needs to call it.
    const allowedOrigins = (process.env.BRIDGE_ALLOWED_ORIGINS?.trim() || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean);
    this.app.use(cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      }
    }));
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMax,
      message: 'Too many requests from this IP, please try again later'
    });
    this.app.use('/bridge', limiter);

    // Token auth for the bridge endpoints (Authorization: Bearer or x-api-key)
    this.app.use('/bridge', (req, res, next) => {
      const expected = this.config.authToken;
      if (!expected) return next();
      const header = req.get('authorization') || '';
      const provided =
        header.startsWith('Bearer ') ? header.slice('Bearer '.length) : (req.get('x-api-key') || '');
      if (!constantTimeEquals(provided, expected)) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        mode: this.config.mode,
        timestamp: new Date().toISOString()
      });
    });

    // Main bridge endpoint
    this.app.post('/bridge', async (req, res) => {
      try {
        const { action, platform, ...body } = req.body;

        if (!action) {
          return res.status(400).json({
            ok: false,
            error: 'Missing action',
            details: { body: 'action is required' }
          });
        }

        // Mock mode
        if (this.config.mode === 'mock') {
          await new Promise(resolve => setTimeout(resolve, this.config.mockDelay!));
          const result = handleMockBridgeRequest({
            action,
            platform,
            ...body
          });
          return res.status(result.status).json(result.body);
        }

        // Live mode
        if (this.liveClient) {
          const result = await this.liveClient.call(action, platform, body);
          return res.status(result.status).json(result.body);
        }

        return res.status(500).json({
          ok: false,
          error: 'No bridge mode configured'
        });
      } catch (error) {
        console.error('Bridge error:', error);

        const errorMessage = process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error instanceof Error ? error.message : 'Internal server error';

        return res.status(500).json({
          ok: false,
          error: errorMessage
        });
      }
    });

    // Raw endpoint for testing — a body echo is only useful during local
    // development and must never exist on a deployed host.
    if (process.env.NODE_ENV !== 'production') {
      this.app.post('/bridge/raw', (req, res) => {
        res.json({ received: req.body, mode: this.config.mode });
      });
    }
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.server = this.app.listen(this.config.port ?? 3001, this.config.host ?? '127.0.0.1', () => {
        const bound = `${this.config.host}:${this.config.port}`;
        if (this.config.mode === 'mock' && !this.config.authToken) {
          console.warn(
            `⚠️  Bridge server (mock) on ${bound} is UNAUTHENTICATED — loopback bind only; never expose it.`
          );
        }
        console.log(`🚀 Bridge server started on ${bound} (${this.config.mode})`);
        resolve();
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      if (!this.server) {
        console.log('Bridge server stopped');
        return resolve();
      }
      this.server.close(() => {
        this.server = undefined;
        console.log('Bridge server stopped');
        resolve();
      });
    });
  }
}

// Factory
export const createMockBridgeServer = (config: BridgeServerConfig = {}) => {
  return new BridgeServer({ ...config, mode: 'mock' });
};

export const createLiveBridgeServer = (config: BridgeServerConfig = {}) => {
  return new BridgeServer({ ...config, mode: 'live' });
};