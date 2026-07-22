export {
  defaultBaseForKind,
  getAiProviders,
  getAiRouterStatus,
  isAiGatewayEnabled,
  normalizeKind,
  sortProviders,
} from "@/lib/ai/config";
export { buildAgentSystemPrompt } from "@/lib/ai/agent-prompt";
export { routeChatCompletion } from "@/lib/ai/router";
export type {
  AiChatMessage,
  AiChatRequest,
  AiChatResult,
  AiProviderConfig,
  AiProviderKind,
  AiRouterStatus,
} from "@/lib/ai/types";
