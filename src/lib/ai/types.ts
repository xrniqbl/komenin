export type AiProviderKind =
  | "ninerouter"
  | "openai"
  | "anthropic"
  | "openai_compatible";

export type AiProviderConfig = {
  id: string;
  kind: AiProviderKind;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  timeoutMs?: number;
  /** Lower runs first when resolving workspace providers. */
  priority?: number;
};

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Prefer this model id when present on a provider. */
  preferredModel?: string | null;
  /** Prefer this provider id (workspace or env). */
  preferredProviderId?: string | null;
  /** Ordered fallback model ids. */
  fallbackModels?: string[];
  /** Optional workspace context for vault providers (resolved by caller). */
  providers?: AiProviderConfig[];
  /** Workspace that funds this call (metering + quota). Omit to skip metering. */
  workspaceId?: string | null;
  /** Optional reference for usage attribution (e.g. "comment_action"). */
  refType?: string | null;
  refId?: string | null;
};

export type AiChatResult = {
  content: string;
  providerId: string;
  model: string;
  mode: "gateway" | "local_fallback";
  attempts: Array<{
    providerId: string;
    model: string;
    ok: boolean;
    error?: string;
  }>;
};

export type AiRouterStatus = {
  enabled: boolean;
  providerCount: number;
  providers: Array<{
    id: string;
    kind?: AiProviderKind;
    baseUrl: string;
    models: string[];
    hasApiKey: boolean;
  }>;
  localFallback: true;
  source?: "workspace" | "env" | "mixed";
};

export const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
export const DEFAULT_ANTHROPIC_BASE = "https://api.anthropic.com";
