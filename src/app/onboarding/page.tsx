import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { auth } from "@/lib/auth";
import { getTemplateById } from "@/data/onboarding-templates";
import { createInvite } from "@/server/invites";
import { createWorkspace, listWorkspacesForUser } from "@/server/workspaces";
import { createCampaign } from "@/server/campaigns";
import type { Platform } from "@prisma/client";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    step?: string;
    workspaceName?: string;
    timezone?: string;
    invites?: string;
    goals?: string | string[];
    platforms?: string | string[];
    templateId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaces = await listWorkspacesForUser();
  if (workspaces.length > 0) redirect("/app");

  const params = await searchParams;
  const validSteps = ["welcome", "workspace", "goals", "template", "launch"];
  const initialStep = validSteps.includes(params.step ?? "")
    ? (params.step as "welcome" | "workspace" | "goals" | "template" | "launch")
    : "welcome";

  // Data dari URL params (untuk navigasi tanpa JS)
  const urlData = {
    workspaceName: String(params.workspaceName ?? ""),
    timezone: String(params.timezone ?? "Asia/Jakarta"),
    invites: String(params.invites ?? ""),
    goals: params.goals
      ? (Array.isArray(params.goals) ? params.goals : [params.goals]).join(",")
      : "",
    platforms: params.platforms
      ? (Array.isArray(params.platforms) ? params.platforms : [params.platforms]).join(",")
      : "",
    templateId: String(params.templateId ?? ""),
  };

  // Validasi server-side untuk navigasi tanpa JS:
  // jangan biarkan user lompat ke step berikutnya dengan data kosong.
  const qp = new URLSearchParams();
  if (urlData.workspaceName) qp.set("workspaceName", urlData.workspaceName);
  if (urlData.timezone) qp.set("timezone", urlData.timezone);
  if (urlData.invites) qp.set("invites", urlData.invites);
  if (urlData.goals) qp.set("goals", urlData.goals);
  if (urlData.platforms) qp.set("platforms", urlData.platforms);
  if (urlData.templateId) qp.set("templateId", urlData.templateId);
  const qs = qp.toString() ? `&${qp.toString()}` : "";
  if (
    ["goals", "template", "launch"].includes(initialStep) &&
    urlData.workspaceName.trim().length < 2
  ) {
    redirect(`/onboarding?step=workspace${qs}`);
  }
  if (
    ["template", "launch"].includes(initialStep) &&
    (!urlData.goals || !urlData.platforms)
  ) {
    redirect(`/onboarding?step=goals${qs}`);
  }

  async function completeOnboarding(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const timezone = String(formData.get("timezone") || "Asia/Jakarta");
    const invitesRaw = String(formData.get("invites") || "");
    const templateId = String(formData.get("templateId") || "");

    if (name.length < 2) {
      throw new Error("Workspace name must be at least 2 characters");
    }

    // Retry-safe: a previous Launch attempt may have created the workspace
    // and then thrown before redirect. Don't stack duplicates — finish setup
    // in the workspace the user already has.
    const existing = await listWorkspacesForUser();
    let workspaceId = existing[0]?.id;
    if (!workspaceId) {
      const workspace = await createWorkspace({ name, timezone });
      workspaceId = workspace.id;
    }

    // Send invites — best effort per email. One bad address must never abort
    // onboarding or block the redirect below.
    const emails = invitesRaw
      .split(/[,\n]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (!emailPattern.test(email)) continue;
      try {
        await createInvite({
          workspaceId,
          email,
          role: "operator",
        });
      } catch {
        // Non-critical: the user can re-invite from Settings > Members.
        continue;
      }
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
      initialStep={initialStep}
      urlData={urlData}
    />
  );
}
