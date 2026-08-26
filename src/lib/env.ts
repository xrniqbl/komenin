import { z } from "zod";

// Treat declared-but-blank env vars (e.g. `FOO=""` in .env / docker-compose) as
// undefined so `.url()` validation never throws on empty strings. Without this,
// a single blank URL env var crashes getEnv() (and every caller such as the
// production gate) with a ZodError "Invalid URL".
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex characters"),
  SIMULATOR_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  WORKER_SECRET: z.string().min(16).optional(),
  // Vercel Cron authenticates scheduled GET requests with `Authorization: Bearer $CRON_SECRET`.
  CRON_SECRET: z.string().min(16).optional(),
  AI_GATEWAY_ENABLED: z.enum(["true", "false"]).default("true"),
  AI_GATEWAY_BASE_URL: optionalUrl,
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_MODEL_PRIMARY: z.string().optional(),
  AI_MODEL_FALLBACKS: z.string().optional(),
  AI_PROVIDERS: z.string().optional(),
  AI_TIMEOUT_MS: z.string().optional(),
  SOCIAL_PUBLISH_WEBHOOK_URL: optionalUrl,
  SOCIAL_PUBLISH_WEBHOOK_TOKEN: z.string().optional(),
  SOCIAL_CONNECTOR_POLICY: z.string().optional(),
  SOCIAL_OFFICIAL_API_BASE_URL: optionalUrl,
  SOCIAL_OFFICIAL_API_TOKEN: z.string().optional(),
  INSTAGRAM_API_BASE_URL: optionalUrl,
  THREADS_API_BASE_URL: optionalUrl,
  TIKTOK_API_BASE_URL: optionalUrl,
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  THREADS_ACCESS_TOKEN: z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).optional(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  MIDTRANS_MERCHANT_ID: z.string().optional(),
  AETHER_REGION: z.string().optional(),
  INSTAGRAM_GRAPH_BASE_URL: optionalUrl,
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    APP_URL: process.env.APP_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SIMULATOR_MODE: process.env.SIMULATOR_MODE ?? "true",
    WORKER_SECRET: process.env.WORKER_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    AI_GATEWAY_ENABLED: process.env.AI_GATEWAY_ENABLED ?? "true",
    AI_GATEWAY_BASE_URL: process.env.AI_GATEWAY_BASE_URL,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    AI_MODEL_PRIMARY: process.env.AI_MODEL_PRIMARY,
    AI_MODEL_FALLBACKS: process.env.AI_MODEL_FALLBACKS,
    AI_PROVIDERS: process.env.AI_PROVIDERS,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
    SOCIAL_PUBLISH_WEBHOOK_URL: process.env.SOCIAL_PUBLISH_WEBHOOK_URL,
    SOCIAL_PUBLISH_WEBHOOK_TOKEN: process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN,
    SOCIAL_CONNECTOR_POLICY: process.env.SOCIAL_CONNECTOR_POLICY,
    SOCIAL_OFFICIAL_API_BASE_URL: process.env.SOCIAL_OFFICIAL_API_BASE_URL,
    SOCIAL_OFFICIAL_API_TOKEN: process.env.SOCIAL_OFFICIAL_API_TOKEN,
    INSTAGRAM_API_BASE_URL: process.env.INSTAGRAM_API_BASE_URL,
    THREADS_API_BASE_URL: process.env.THREADS_API_BASE_URL,
    TIKTOK_API_BASE_URL: process.env.TIKTOK_API_BASE_URL,
    INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
    THREADS_ACCESS_TOKEN: process.env.THREADS_ACCESS_TOKEN,
    TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN,
    MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION,
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
    MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY,
    MIDTRANS_MERCHANT_ID: process.env.MIDTRANS_MERCHANT_ID,
    AETHER_REGION: process.env.AETHER_REGION,
    INSTAGRAM_GRAPH_BASE_URL: process.env.INSTAGRAM_GRAPH_BASE_URL,
    INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID,
    INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET,
    THREADS_APP_ID: process.env.THREADS_APP_ID,
    THREADS_APP_SECRET: process.env.THREADS_APP_SECRET,
    TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET,
  });
}

export function isSimulatorMode(): boolean {
  return getEnv().SIMULATOR_MODE;
}