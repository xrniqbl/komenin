export type AiProviderConfig = {
  id: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  timeoutMs?: number;
};

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
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
    baseUrl: string;
    models: string[];
    hasApiKey: boolean;
  }>;
  localFallback: true;
};