"use server";

import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export type OnboardingChecklist = {
  enabled: boolean;
  complete: boolean;
  completedCount: number;
  total: number;
  steps: OnboardingStep[];
};

/**
 * First-15-minute guided path for a new workspace.
 * Purely derived from existing data — no extra persistence required.
 */
export async function getOnboardingChecklist(): Promise<OnboardingChecklist> {
  const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.guidedOnboarding);
  if (!enabled) {
    return { enabled: false, complete: true, completedCount: 0, total: 0, steps: [] };
  }

  const { workspace } = await requireActiveWorkspace();

  const [accounts, proxies, campaigns, approvals, sessions] = await Promise.all([
    db.socialAccount.count({
      where: { workspaceId: workspace.id, deletedAt: null },
    }),
    db.proxyEndpoint.count({
      where: { workspaceId: workspace.id, deletedAt: null },
    }),
    db.campaign.count({ where: { workspaceId: workspace.id } }),
    db.approval.count({ where: { workspaceId: workspace.id } }),
    db.accountSession.count({
      where: { workspaceId: workspace.id, isActive: true },
    }),
  ]);

  const steps: OnboardingStep[] = [
    {
      id: "connect_account",
      title: "Connect a social account",
      description: "Import session cookies for Instagram, Threads, or TikTok.",
      href: "/app/accounts",
      done: accounts > 0,
    },
    {
      id: "add_proxy",
      title: "Add a proxy (recommended)",
      description: "Attach a proxy endpoint so sessions stay healthy under load.",
      href: "/app/proxies",
      done: proxies > 0,
    },
    {
      id: "active_session",
      title: "Confirm an active session",
      description: "Ensure at least one account has an active encrypted session vault entry.",
      href: "/app/sessions",
      done: sessions > 0,
    },
    {
      id: "first_campaign",
      title: "Create your first campaign",
      description: "Launch a comment campaign with approval-first controls.",
      href: "/app/campaigns",
      done: campaigns > 0,
    },
    {
      id: "first_approval",
      title: "Review an approval",
      description: "Generate drafts, then approve or reject in the queue.",
      href: "/app/approvals",
      done: approvals > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  return {
    enabled: true,
    complete: completedCount === steps.length,
    completedCount,
    total: steps.length,
    steps,
  };
}
