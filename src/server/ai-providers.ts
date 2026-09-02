"use server";

import { revalidatePath } from "next/cache";
import {
  defaultBaseForKind,
  getAiProviders,
  getAiRouterStatus,
  normalizeKind,
  sortProviders,
} from "@/lib/ai/config";
import { routeChatCompletion } from "@/lib/ai/router";
import type { AiProviderConfig, AiProviderKind } from "@/lib/ai/types";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import type { AiProviderKind as PrismaAiProviderKind } from "@prisma/client";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";

export type WorkspaceAiProviderSummary = {
  id: string;
  kind: AiProviderKind;
  label: string;
  baseUrl: string | null;
  models: string[];
  isEnabled: boolean;
  priority: number;
  hasApiKey: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toKind(kind: string): AiProviderKind {
  return normalizeKind(kind);
}

function resolveBaseUrl(kind: AiProviderKind, baseUrl?: string | null): string {
  const trimmed = baseUrl?.trim().replace(/\/$/, "") || "";
  if (trimmed) return trimmed;
  const fallback = defaultBaseForKind(kind);
  if (!fallback) {
    throw new Error("Base URL required for this provider kind");
  }
  return fallback.replace(/\/$/, "");
}

export async function listWorkspaceAiProviders(): Promise<WorkspaceAiProviderSummary[]> {
  const { workspace } = await requireActiveWorkspace();
  const rows = await db.workspaceAiProvider.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      kind: true,
      label: true,
      baseUrl: true,
      models: true,
      isEnabled: true,
      priority: true,
      apiKeyEnc: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map(({ apiKeyEnc, kind, ...rest }) => ({
    ...rest,
    kind: toKind(kind),
    hasApiKey: Boolean(apiKeyEnc),
  }));
}

export async function getWorkspaceAiSettings() {
  const { workspace } = await requireActiveWorkspace();
  const full = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: {
      aiDefaultProviderId: true,
      aiDefaultModel: true,
      aiFallbackModels: true,
      aiTemperature: true,
      aiMaxTokens: true,
    },
  });
  const providers = await listWorkspaceAiProviders();
  const envStatus = getAiRouterStatus();
  return {
    providers,
    defaults: {
      defaultProviderId: full?.aiDefaultProviderId ?? null,
      defaultModel: full?.aiDefaultModel ?? null,
      fallbackModels: full?.aiFallbackModels ?? [],
      temperature: full?.aiTemperature ?? 0.5,
      maxTokens: full?.aiMaxTokens ?? 280,
    },
    envBootstrap: envStatus,
  };
}

export async function createWorkspaceAiProvider(input: {
  kind: string;
  label: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  models: string[];
  isEnabled?: boolean;
  priority?: number;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const kind = toKind(input.kind);
  const label = input.label.trim() || kind;
  const models = (input.models || []).map((m) => m.trim()).filter(Boolean);
  if (models.length === 0) throw new Error("At least one model is required");
  const baseUrl = resolveBaseUrl(kind, input.baseUrl);
  if (baseUrl) {
    try {
      assertSafeOutboundUrl(baseUrl);
    } catch {
      throw new UnsafeUrlError("Invalid or unsafe API base URL");
    }
  }
  const apiKey = input.apiKey?.trim();
  if ((kind === "openai" || kind === "anthropic") && !apiKey) {
    throw new Error("API key required for this provider");
  }

  const row = await db.workspaceAiProvider.create({
    data: {
      workspaceId: workspace.id,
      kind: kind as PrismaAiProviderKind,
      label,
      baseUrl,
      apiKeyEnc: apiKey ? encryptSecret(apiKey) : null,
      models,
      isEnabled: input.isEnabled ?? true,
      priority: input.priority ?? 100,
    },
    select: {
      id: true,
      kind: true,
      label: true,
      baseUrl: true,
      models: true,
      isEnabled: true,
      priority: true,
      apiKeyEnc: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "ai_provider.created",
    resourceType: "workspace_ai_provider",
    resourceId: row.id,
    metadata: { kind, label, models },
  });

  revalidatePath("/app/settings/ai");
  const { apiKeyEnc, ...rest } = row;
  return {
    ...rest,
    kind: toKind(row.kind),
    hasApiKey: Boolean(apiKeyEnc),
  } satisfies WorkspaceAiProviderSummary;
}

export async function updateWorkspaceAiProvider(input: {
  id: string;
  label?: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  clearApiKey?: boolean;
  models?: string[];
  isEnabled?: boolean;
  priority?: number;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.workspaceAiProvider.findFirst({
    where: { id: input.id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Provider not found");

  const kind = toKind(existing.kind);
  const models =
    input.models !== undefined
      ? input.models.map((m) => m.trim()).filter(Boolean)
      : existing.models;
  if (models.length === 0) throw new Error("At least one model is required");

  let apiKeyEnc = existing.apiKeyEnc;
  if (input.clearApiKey) apiKeyEnc = null;
  if (input.apiKey?.trim()) apiKeyEnc = encryptSecret(input.apiKey.trim());

  const baseUrl = input.baseUrl !== undefined ? resolveBaseUrl(kind, input.baseUrl) : existing.baseUrl;

  // Validate new/updated baseUrl against safe outbound URL policy
  if (baseUrl && baseUrl !== existing.baseUrl) {
    try {
      assertSafeOutboundUrl(baseUrl);
    } catch {
      throw new UnsafeUrlError("Invalid or unsafe API base URL");
    }
  }

  const row = await db.workspaceAiProvider.update({
    where: { id: existing.id },
    data: {
      label: input.label?.trim() || existing.label,
      baseUrl,
      apiKeyEnc,
      models,
      isEnabled: input.isEnabled ?? existing.isEnabled,
      priority: input.priority ?? existing.priority,
    },
    select: {
      id: true,
      kind: true,
      label: true,
      baseUrl: true,
      models: true,
      isEnabled: true,
      priority: true,
      apiKeyEnc: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "ai_provider.updated",
    resourceType: "workspace_ai_provider",
    resourceId: row.id,
  });

  revalidatePath("/app/settings/ai");
  const { apiKeyEnc: enc, ...rest } = row;
  return {
    ...rest,
    kind: toKind(row.kind),
    hasApiKey: Boolean(enc),
  } satisfies WorkspaceAiProviderSummary;
}

export async function deleteWorkspaceAiProvider(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");
  const existing = await db.workspaceAiProvider.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Provider not found");

  await db.workspaceAiProvider.delete({ where: { id } });
  await db.workspace.updateMany({
    where: { id: workspace.id, aiDefaultProviderId: id },
    data: { aiDefaultProviderId: null },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "ai_provider.deleted",
    resourceType: "workspace_ai_provider",
    resourceId: id,
  });
  revalidatePath("/app/settings/ai");
  return { ok: true as const };
}

export async function updateWorkspaceAiDefaults(input: {
  defaultProviderId?: string | null;
  defaultModel?: string | null;
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  if (input.defaultProviderId) {
    const ok = await db.workspaceAiProvider.findFirst({
      where: { id: input.defaultProviderId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!ok) throw new Error("Default provider not found in workspace");
  }

  await db.workspace.update({
    where: { id: workspace.id },
    data: {
      aiDefaultProviderId:
        input.defaultProviderId === undefined
          ? undefined
          : input.defaultProviderId,
      aiDefaultModel:
        input.defaultModel === undefined
          ? undefined
          : input.defaultModel?.trim() || null,
      aiFallbackModels:
        input.fallbackModels === undefined
          ? undefined
          : input.fallbackModels.map((m) => m.trim()).filter(Boolean),
      aiTemperature:
        input.temperature === undefined ? undefined : Number(input.temperature),
      aiMaxTokens:
        input.maxTokens === undefined ? undefined : Number(input.maxTokens),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "ai_settings.updated",
    resourceType: "workspace",
    resourceId: workspace.id,
  });
  revalidatePath("/app/settings/ai");
  return { ok: true as const };
}

/** Decrypt workspace providers for server-side routing only. */
export async function loadRuntimeAiProviders(workspaceId: string): Promise<{
  providers: AiProviderConfig[];
  defaultProviderId: string | null;
  defaultModel: string | null;
  fallbackModels: string[];
  temperature: number;
  maxTokens: number;
}> {
  const [workspace, rows] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        aiDefaultProviderId: true,
        aiDefaultModel: true,
        aiFallbackModels: true,
        aiTemperature: true,
        aiMaxTokens: true,
      },
    }),
    db.workspaceAiProvider.findMany({
      where: { workspaceId, isEnabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const { decryptSecret } = await import("@/lib/encryption");
  const providers: AiProviderConfig[] = [];
  for (const row of rows) {
    const kind = toKind(row.kind);
    let apiKey: string | undefined;
    if (row.apiKeyEnc) {
      try {
        apiKey = decryptSecret(row.apiKeyEnc);
      } catch {
        continue;
      }
    }
    const baseUrl = resolveBaseUrl(kind, row.baseUrl);
    providers.push({
      id: row.id,
      kind,
      baseUrl,
      apiKey,
      models: row.models,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
      priority: row.priority,
    });
  }

  // Bootstrap from env when workspace has no providers.
  const merged =
    providers.length > 0
      ? sortProviders(providers)
      : sortProviders(getAiProviders());

  return {
    providers: merged,
    defaultProviderId: workspace?.aiDefaultProviderId ?? null,
    defaultModel: workspace?.aiDefaultModel ?? null,
    fallbackModels: workspace?.aiFallbackModels ?? [],
    temperature: workspace?.aiTemperature ?? 0.5,
    maxTokens: workspace?.aiMaxTokens ?? 280,
  };
}

/** Read-only snapshot for the Settings → AI "Komenin AI" card. */
export async function getWorkspaceAiBillingStatus() {
  const { workspace } = await requireActiveWorkspace();
  const { getAiBalance } = await import("@/lib/ai/billing");
  const [balance, full] = await Promise.all([
    getAiBalance(workspace.id),
    db.workspace.findUnique({
      where: { id: workspace.id },
      select: { aiPreferOwnKey: true, aiPaygFallbackEnabled: true },
    }),
  ]);
  const sub = await db.workspaceAiSubscription.findUnique({
    where: { workspaceId: workspace.id },
    select: { status: true, quotaPeriodEnd: true, termEnd: true },
  });
  return {
    tier: balance.tier,
    monthlyCredits: balance.monthlyCredits.toString(),
    usedThisPeriod: balance.usedThisPeriod.toString(),
    remainingThisPeriod: (
      balance.monthlyCredits > balance.usedThisPeriod
        ? balance.monthlyCredits - balance.usedThisPeriod
        : 0n
    ).toString(),
    paygBalance: balance.paygBalance.toString(),
    quotaPeriodEnd: sub?.quotaPeriodEnd ?? null,
    termEnd: sub?.termEnd ?? null,
    subscriptionStatus: sub?.status ?? null,
    preferOwnKey: full?.aiPreferOwnKey ?? true,
    paygFallbackEnabled: full?.aiPaygFallbackEnabled ?? true,
  };
}

/** Toggle the Pro Max auto-fallback to PAYG (no-op effect on other tiers). */
export async function updateAiPaygFallback(enabled: boolean) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");
  await db.workspace.update({
    where: { id: workspace.id },
    data: { aiPaygFallbackEnabled: Boolean(enabled) },
  });
  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "ai_settings.payg_fallback",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { aiPaygFallbackEnabled: Boolean(enabled) },
  });
  revalidatePath("/app/settings/ai");
  return { ok: true as const, enabled: Boolean(enabled) };
}

/** Toggle the persisted BYOK preference ("prefer my own key"). */
export async function updateAiPreferOwnKey(preferOwnKey: boolean) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");
  await db.workspace.update({
    where: { id: workspace.id },
    data: { aiPreferOwnKey: Boolean(preferOwnKey) },
  });
  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "ai_settings.prefer_own_key",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { preferOwnKey: Boolean(preferOwnKey) },
  });
  revalidatePath("/app/settings/ai");
  return { ok: true as const, preferOwnKey: Boolean(preferOwnKey) };
}

export async function testWorkspaceAiProvider(input: {
  providerId?: string | null;
  model?: string | null;
}) {
  const { workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const runtime = await loadRuntimeAiProviders(workspace.id);
  const preferredProviderId = input.providerId || runtime.defaultProviderId;
  const preferredModel = input.model || runtime.defaultModel || runtime.providers[0]?.models[0];

  const result = await routeChatCompletion({
    providers: runtime.providers,
    preferredProviderId,
    preferredModel,
    temperature: 0,
    maxTokens: 32,
    messages: [
      { role: "system", content: "Reply with exactly: ok" },
      { role: "user", content: "ping" },
    ],
  });

  if (!result || !result.content.trim()) {
    return {
      ok: false as const,
      error: result?.attempts?.slice(-1)[0]?.error || "No AI response",
      attempts: result?.attempts || [],
    };
  }

  return {
    ok: true as const,
    providerId: result.providerId,
    model: result.model,
    sample: result.content.slice(0, 80),
    attempts: result.attempts,
  };
}
