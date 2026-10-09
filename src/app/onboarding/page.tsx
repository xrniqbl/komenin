import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { auth } from "@/lib/auth";
import { getTemplateById } from "@/data/onboarding-templates";
import { createInvite } from "@/server/invites";
import { createWorkspace, listWorkspacesForUser } from "@/server/workspaces";
import { createCampaign } from "@/server/campaigns";
import { parseInviteEmails } from "@/lib/invite-emails";
import { Platform } from "@prisma/client";

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
  // M5: a TOTP-gated session sees no workspaces (listWorkspacesForUser
  // returns []), so without this the user renders the wizard and every
  // launch fails with no exit path. Send them to the 2FA challenge first.
  if (session.user.totpGate) redirect("/auth/totp-gate");

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
    const timezone = String(formData.get("timezone") || "Asia/Jakarta").trim();
    const invitesRaw = String(formData.get("invites") || "");
    const templateId = String(formData.get("templateId") || "").trim();

    // M7 companion: validate everything up front and throw readable errors.
    // The client shows these inline (handleLaunch catches non-redirect
    // throws); a direct POST still hits the error boundary, but the message
    // is now specific instead of a generic crash.
    if (name.length < 2 || name.length > 120) {
      throw new Error("Workspace name must be between 2 and 120 characters");
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    // C2: createWorkspace is retry-safe (returns the existing workspace when
    // the user already has one), so a double-submit converges instead of
    // stacking duplicates.
    const workspace = await createWorkspace({ name, timezone });
    const workspaceId = workspace.id;

    // N1: parse comma/semicolon/whitespace-separated pastes, dedupe, cap the
    // batch, and surface what happened via the audit log instead of silently
    // skipping or timing out on hundreds of sequential sends.
    const { emails } = parseInviteEmails(invitesRaw);

    for (const email of emails) {
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

    // Create campaign from template if selected.
    // N2: validate the platform against the Prisma enum (the API route
    // already does this) and surface failures — a swallowed catch would show
    // success while creating nothing.
    let campaignError: string | null = null;
    if (templateId) {
      const template = getTemplateById(templateId);
      if (!template) {
        campaignError = `Unknown template: ${templateId}`;
      } else if (!Object.values(Platform).includes(template.platform as Platform)) {
        campaignError = `Template platform is not supported: ${template.platform}`;
      } else {
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
        } catch (error) {
          campaignError =
            error instanceof Error ? error.message : "Failed to create campaign";
        }
      }
    }

    if (campaignError) {
      // Throw AFTER invites are done so the workspace + invites persist; the
      // client shows this inline and the user can retry from the dashboard.
      throw new Error(campaignError);
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
