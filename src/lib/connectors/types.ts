export type RuntimeMode = "simulator" | "live";

export type ConnectorKind = "simulator" | "webhook" | "official" | "none";

export type ConnectorPolicy =
  | "prefer_official"
  | "prefer_webhook"
  | "webhook_only"
  | "official_only"
  | "simulator_only";

export type ConnectorAction =
  | "discoverPosts"
  | "sendComment"
  | "publishPost"
  | "healthProbe"
  | "rotateProxy";

export type ConnectorTarget = {
  platform: string;
  username?: string | null;
  accountId?: string | null;
  externalId?: string | null;
  workspaceId?: string | null;
};

export type ConnectorWebhookConfig = {
  url: string;
  token?: string | null;
};

export type ConnectorOfficialConfig = {
  provider: "instagram" | "threads" | "tiktok" | string;
  accessToken: string;
  apiBaseUrl?: string | null;
};

export type DiscoverPayload = {
  query: string;
  limit?: number;
  listenerId?: string;
};

export type CommentPayload = {
  body: string;
  targetPostExternalId?: string | null;
  targetPostUrl?: string | null;
  authorHandle?: string | null;
};

export type PublishPayload = {
  title?: string | null;
  body: string;
  hashtags?: string[];
  scheduledFor?: Date | null;
  /** Public media URL required for native Instagram/Threads image posts. */
  mediaUrl?: string | null;
};

export type HealthPayload = {
  hasSession?: boolean;
  proxyHealthy?: boolean | null;
};

export type RotatePayload = {
  proxyId?: string | null;
  seed?: string | null;
};

export type ConnectorActionPayload =
  | DiscoverPayload
  | CommentPayload
  | PublishPayload
  | HealthPayload
  | RotatePayload;

export type DiscoveredPost = {
  externalId: string;
  authorHandle: string;
  content: string;
  url: string;
  platform: string;
};

export type ConnectorResult = {
  ok: boolean;
  mode: RuntimeMode;
  connector: ConnectorKind;
  message: string;
  externalId?: string;
  posts?: DiscoveredPost[];
  healthy?: boolean;
  ip?: string;
  details?: Record<string, unknown>;
};

export type ConnectorActionInput = {
  action: ConnectorAction;
  runtimeMode: RuntimeMode;
  policy: ConnectorPolicy;
  target: ConnectorTarget;
  payload: ConnectorActionPayload;
  webhook?: ConnectorWebhookConfig | null;
  official?: ConnectorOfficialConfig | null;
  /**
   * Caller-chosen dedup key for mutating actions (sendComment/publishPost),
   * e.g. the commentActionId / contentDraftId. Sent as `x-komenin-idempotency-key`
   * so the bridge can recognize a retried delivery after a crash between the
   * side effect and its local result write, and return the original outcome
   * instead of posting twice.
   */
  idempotencyKey?: string | null;
};
