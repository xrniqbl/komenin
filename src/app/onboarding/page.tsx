import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { auth } from "@/lib/auth";
import { getTemplateById } from "@/data/onboarding-templates";
import { createInvite } from "@/server/invites";
import { createWorkspace, listWorkspacesForUser } from "@/server/workspaces";
import { createCampaign } from "@/server/campaigns";
import type { Platform } from "@prisma/client";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspaces = await listWorkspacesForUser();
  if (workspaces.length > 0) redirect("/app");

  async function completeOnboarding(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const timezone = String(formData.get("timezone") || "Asia/Jakarta");
    const invitesRaw = String(formData.get("invites") || "");
    const templateId = String(formData.get("templateId") || "");

    const workspace = await createWorkspace({ name, timezone });

    // Send invites
    const emails = invitesRaw
      .split(/[,\n]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    for (const email of emails) {
      await createInvite({
        workspaceId: workspace.id,
        email,
        role: "operator",
      });
    }

    // Create campaign from template if selected
    if (templateId) {
      const template = getTemplateById(templateId);
      if (template) {
        try {
          await createCampaign({
            name: template.name,
            platform: template.platform as Platform,
            mode: "approval_required",
            goal: template.goal,
            dailyLimit: template.dailyLimit,
            minDelaySec: template.minDelaySec,
            maxDelaySec: template.maxDelaySec,
            listenerQuery: template.listenerQuery || undefined,
          });
        } catch {
          // Non-critical: campaign creation failure shouldn't block onboarding.
          // User can create campaigns manually from the dashboard.
        }
      }
    }

    redirect("/app");
  }

  return (
    <OnboardingWizard
      userName={session.user.name ?? undefined}
      completeOnboarding={completeOnboarding}
    />
  );
}
