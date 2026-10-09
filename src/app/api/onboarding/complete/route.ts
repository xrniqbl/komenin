import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/api-errors";
import { assertSameOrigin } from "@/lib/csrf";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { parseInviteEmails } from "@/lib/invite-emails";
import { createWorkspace } from "@/server/workspaces";
import { createInvite } from "@/server/invites";
import { createCampaign } from "@/server/campaigns";
import { getTemplateById } from "@/data/onboarding-templates";
import { Platform } from "@prisma/client";

export const runtime = "nodejs";

const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z
    .string()
    .trim()
    .max(64)
    .refine(
      (tz) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid timezone" },
    ),
  invites: z.string().max(2000).optional().default(""),
  templateId: z.string().trim().max(64).optional().default(""),
});

export async function POST(request: Request) {
  // State-changing cookie-auth handler: reject cross-site forged posts.
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", 401);
  }

  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, `api:onboarding:complete:user:${session.user.id}`),
    limit: 10,
    windowMs: 3_600_000,
    failClosed: true,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429, undefined, {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
      },
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("INVALID_FORM", 400);
  }

  const parsed = onboardingSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    timezone: String(formData.get("timezone") ?? "Asia/Jakarta"),
    invites: String(formData.get("invites") ?? ""),
    templateId: String(formData.get("templateId") ?? ""),
  });
  if (!parsed.success) {
    return apiError(
      "INVALID_INPUT",
      400,
      parsed.error.issues[0]?.message || "Invalid input",
    );
  }
  const { name, timezone, invites: invitesRaw, templateId } = parsed.data;

  let workspace: { id: string };
  try {
    // C2: createWorkspace returns the existing workspace on retry, so a
    // replayed request converges instead of stacking duplicates.
    workspace = await createWorkspace({ name, timezone });
  } catch {
    return apiError("INTERNAL_ERROR", 500, "Failed to complete onboarding");
  }

  const { emails, skippedInvalid, truncated } = parseInviteEmails(invitesRaw);

  let invited = 0;
  const inviteErrors: string[] = [...skippedInvalid];
  if (truncated > 0) {
    inviteErrors.push(`${truncated} invite(s) skipped: batch limit reached`);
  }
  for (const email of emails) {
    try {
      await createInvite({
        workspaceId: workspace.id,
        email,
        role: "operator",
      });
      invited += 1;
    } catch {
      inviteErrors.push(email);
    }
  }

  let campaignCreated = false;
  if (templateId) {
    const template = getTemplateById(templateId);
    if (
      template &&
      Object.values(Platform).includes(template.platform as Platform)
    ) {
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
        campaignCreated = true;
      } catch {
        // Template campaign is optional — onboarding still succeeds.
      }
    }
  }

  return NextResponse.json(
    {
      data: {
        workspaceId: workspace.id,
        invited,
        inviteErrors,
        campaignCreated,
      },
    },
    { status: 201 },
  );
}
