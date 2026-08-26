import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import type { Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { handleMockBridgeRequest } from './bridge-contract';
import { createLiveBridgeClient } from './bridge-client';

function constantTimeEquals(provided: string, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export type BridgeServerConfig = {
  port?: number;
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
    this.app.use(cors());
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

    // Raw endpoint for testing
    this.app.post('/bridge/raw', (req, res) => {
      res.json({ received: req.body, mode: this.config.mode });
    });
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`🚀 Bridge server started on port ${this.config.port} (${this.config.mode})`);
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