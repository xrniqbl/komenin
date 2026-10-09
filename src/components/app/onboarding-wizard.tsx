"use client";

import { useCallback, useState, useTransition } from "react";
import Image from "next/image";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import LoopRoundedIcon from "@mui/icons-material/LoopRounded";
import MessageRoundedIcon from "@mui/icons-material/MessageRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import SupportRoundedIcon from "@mui/icons-material/SupportRounded";
import TrackChangesRoundedIcon from "@mui/icons-material/TrackChangesRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { createSvgIcon } from "@mui/material/utils";
import type { TemplateIconName } from "@/data/onboarding-templates";

// ---------------------------------------------------------------------------
// Brand icons (MUI SvgIcon via createSvgIcon — theme-aware, inherits color)
// ---------------------------------------------------------------------------

const InstagramIcon = createSvgIcon(
  <>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  "Instagram",
);

const TiktokIcon = createSvgIcon(
  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />,
  "Tiktok",
);

const ThreadsIcon = createSvgIcon(
  <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161" />,
  "Threads",
);

// Map template icon names (from @/data/onboarding-templates) to MUI Rounded icons
function TemplateIcon({ name, className }: { name: TemplateIconName; className?: string }) {
  const cls = className ?? "size-5";
  switch (name) {
    case "MessageSquare":
      return <MessageRoundedIcon className={cls} />;
    case "Target":
      return <TrackChangesRoundedIcon className={cls} />;
    case "Megaphone":
      return <CampaignRoundedIcon className={cls} />;
    case "LifeBuoy":
      return <SupportRoundedIcon className={cls} />;
    case "Music":
      return <MusicNoteRoundedIcon className={cls} />;
    case "Search":
      return <SearchRoundedIcon className={cls} />;
    case "Threads":
      return <ThreadsIcon className={cls} />;
    case "Sparkles":
      return <AutoAwesomeRoundedIcon className={cls} />;
    default:
      return <AutoAwesomeRoundedIcon className={cls} />;
  }
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMPAIGN_TEMPLATES,
  getTemplatesByPlatform,
  type CampaignTemplate,
} from "@/data/onboarding-templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingStep = "welcome" | "workspace" | "goals" | "template" | "launch";

const STEPS: OnboardingStep[] = [
  "welcome",
  "workspace",
  "goals",
  "template",
  "launch",
];

const STEP_META: Record<
  OnboardingStep,
  { title: string; description: string; icon: React.ReactNode }
> = {
  welcome: {
    title: "Welcome",
    description: "Let's get started",
    icon: <AutoAwesomeRoundedIcon className="size-4" />,
  },
  workspace: {
    title: "Workspace",
    description: "Set up your space",
    icon: <PublicRoundedIcon className="size-4" />,
  },
  goals: {
    title: "Goals",
    description: "What are you here for?",
    icon: <BoltRoundedIcon className="size-4" />,
  },
  template: {
    title: "Template",
    description: "Pick a campaign",
    icon: <MessageRoundedIcon className="size-4" />,
  },
  launch: {
    title: "Launch",
    description: "You're all set",
    icon: <RocketLaunchRoundedIcon className="size-4" />,
  },
};

type UserGoal = "engagement" | "leads" | "brand" | "support";
type Platform = "instagram" | "tiktok" | "threads";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type OnboardingWizardProps = {
  userName?: string;
  completeOnboarding: (formData: FormData) => Promise<void>;
  initialStep?: OnboardingStep;
  urlData?: {
    workspaceName: string;
    timezone: string;
    invites: string;
    goals: string;
    platforms: string;
    templateId: string;
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingWizard({
  userName,
  completeOnboarding,
  initialStep = "welcome",
  urlData,
}: OnboardingWizardProps) {
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Form state (diisi dari URL params untuk navigasi tanpa JS)
  const [workspaceName, setWorkspaceName] = useState(urlData?.workspaceName ?? "");
  const [timezone, setTimezone] = useState(urlData?.timezone ?? "Asia/Jakarta");
  const [invites, setInvites] = useState(urlData?.invites ?? "");
  const [selectedGoals, setSelectedGoals] = useState<UserGoal[]>(() =>
    (urlData?.goals ? urlData.goals.split(",") : []).filter(
      (g): g is UserGoal =>
        g === "engagement" || g === "leads" || g === "brand" || g === "support",
    ),
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(() =>
    (urlData?.platforms ? urlData.platforms.split(",") : []).filter(
      (p): p is Platform =>
        p === "instagram" || p === "tiktok" || p === "threads",
    ),
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<CampaignTemplate | null>(() => {
      if (!urlData?.templateId) return null;
      return (
        CAMPAIGN_TEMPLATES.find((t) => t.id === urlData.templateId) ?? null
      );
    });

  const currentIndex = STEPS.indexOf(currentStep);
  const progressPercent = ((currentIndex + 1) / STEPS.length) * 100;

  const canGoNext = useCallback((): boolean => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "workspace":
        return workspaceName.trim().length >= 2;
      case "goals":
        return selectedGoals.length > 0 && selectedPlatforms.length > 0;
      case "template":
        // Template is optional
        return true;
      case "launch":
        return workspaceName.trim().length >= 2;
      default:
        return false;
    }
  }, [currentStep, workspaceName, selectedGoals, selectedPlatforms]);

  function goNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setDirection("forward");
      setCurrentStep(STEPS[nextIndex]);
    }
  }

  function goBack() {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setDirection("backward");
      setCurrentStep(STEPS[prevIndex]);
    }
  }

  // URL builder untuk navigasi tanpa JS (native anchor).
  // Semua data form dipertahankan di query params.
  function buildStepUrl(step: OnboardingStep): string {
    const params = new URLSearchParams();
    params.set("step", step);
    if (workspaceName.trim()) params.set("workspaceName", workspaceName.trim());
    if (timezone) params.set("timezone", timezone);
    if (invites.trim()) params.set("invites", invites.trim());
    if (selectedGoals.length > 0) params.set("goals", selectedGoals.join(","));
    if (selectedPlatforms.length > 0) params.set("platforms", selectedPlatforms.join(","));
    if (selectedTemplate) params.set("templateId", selectedTemplate.id);
    return "/onboarding?" + params.toString();
  }

  function toggleGoal(goal: UserGoal) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
    // Reset template when platforms change
    setSelectedTemplate(null);
  }

  function handleLaunch() {
    if (workspaceName.trim().length < 2) {
      setLaunchError("Workspace name must be at least 2 characters.");
      return;
    }
    setLaunchError(null);
    const formData = new FormData();
    formData.set("name", workspaceName.trim());
    formData.set("timezone", timezone);
    formData.set("invites", invites);
    formData.set("goals", selectedGoals.join(","));
    formData.set("platforms", selectedPlatforms.join(","));
    if (selectedTemplate) {
      formData.set("templateId", selectedTemplate.id);
    }
    startTransition(async () => {
      try {
        await completeOnboarding(formData);
      } catch (error) {
        // completeOnboarding ends in redirect("/app"), which Next surfaces as
        // NEXT_REDIRECT — that must propagate. Anything else is a real
        // failure, so surface it inline instead of hitting the error boundary.
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          typeof (error as { digest?: unknown }).digest === "string" &&
          ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
            (error as { digest: string }).digest.includes("NEXT_REDIRECT"))
        ) {
          throw error;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong while launching. Please try again.";
        setLaunchError(message);
      }
    });
  }

  // Template suggestions filtered by selected platforms
  const filteredTemplates = selectedPlatforms.flatMap((p) =>
    getTemplatesByPlatform(p).filter((t) =>
      selectedGoals.includes(t.category as UserGoal),
    ),
  );

  const allTemplatesForPlatforms = selectedPlatforms.flatMap((p) =>
    getTemplatesByPlatform(p),
  );

  const templatesToShow =
    filteredTemplates.length > 0 ? filteredTemplates : allTemplatesForPlatforms;

  return (
    <div className="bg-marketing relative flex min-h-screen flex-col overflow-hidden px-4 py-8 text-neutral-100">
      {/* Ambient glows ala landing */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-electric-600/15 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-electric-500/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-electric-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col">
      {/* Progress header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/komenin-welcome-256.png"
              alt="Komenin"
              width={32}
              height={32}
              className="size-8 object-contain"
            />
            <span className="font-semibold text-lg">Komenin</span>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            Step {currentIndex + 1} of {STEPS.length}
          </span>
        </div>

        {/* Step indicator bar */}
        <Progress value={progressPercent}>
          <ProgressTrack className="h-1.5 bg-white/10">
            <ProgressIndicator className="bg-electric-500 transition-all duration-500 ease-out" />
          </ProgressTrack>
        </Progress>

        {/* Step labels */}
        <div className="mt-3 flex justify-between">
          {STEPS.map((step, index) => {
            const meta = STEP_META[step];
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            return (
              <div
                key={step}
                className={`flex items-center gap-1.5 text-xs transition-colors duration-300 ${
                  isActive
                    ? "font-medium text-foreground"
                    : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] transition-all duration-300 ${
                    isActive
                      ? "bg-electric-500 text-white shadow-md"
                      : isCompleted
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted text-muted-foreground/60"
                  }`}
                >
                  {isCompleted ? (
                    <CheckRoundedIcon className="size-3" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                <span className="hidden sm:inline">{meta.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div
        className="flex-1"
        key={currentStep}
        style={{
          animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.3s ease-out`,
        }}
      >
        {currentStep === "welcome" && (
          <WelcomeStep userName={userName} onContinue={goNext} />
        )}
        {currentStep === "workspace" && (
          <form id="workspace-form" method="GET" action="/onboarding">
            <input type="hidden" name="step" value="goals" />
            <WorkspaceStep
              workspaceName={workspaceName}
              setWorkspaceName={setWorkspaceName}
              timezone={timezone}
              setTimezone={setTimezone}
              invites={invites}
              setInvites={setInvites}
            />
          </form>
        )}
        {currentStep === "goals" && (
          <form id="goals-form" method="GET" action="/onboarding">
            <input type="hidden" name="step" value="template" />
            <input type="hidden" name="workspaceName" value={workspaceName} />
            <input type="hidden" name="timezone" value={timezone} />
            <input type="hidden" name="invites" value={invites} />
            <GoalsStep
              selectedGoals={selectedGoals}
              toggleGoal={toggleGoal}
              selectedPlatforms={selectedPlatforms}
              togglePlatform={togglePlatform}
            />
          </form>
        )}
        {currentStep === "template" && (
          <form id="template-form" method="GET" action="/onboarding">
            <input type="hidden" name="step" value="launch" />
            <input type="hidden" name="workspaceName" value={workspaceName} />
            <input type="hidden" name="timezone" value={timezone} />
            <input type="hidden" name="invites" value={invites} />
            {selectedGoals.map((g) => (
              <input key={g} type="hidden" name="goals" value={g} />
            ))}
            {selectedPlatforms.map((p) => (
              <input key={p} type="hidden" name="platforms" value={p} />
            ))}
            <TemplateStep
              templates={templatesToShow}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
            />
          </form>
        )}
        {currentStep === "launch" && (
          <LaunchStep
            workspaceName={workspaceName}
            selectedGoals={selectedGoals}
            selectedPlatforms={selectedPlatforms}
            selectedTemplate={selectedTemplate}
          />
        )}
      </div>

      {/* Navigation footer */}
      {currentStep !== "welcome" && (
        <div className="mt-8 border-t pt-4">
          {currentStep === "launch" && launchError && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {launchError}
            </p>
          )}
          <div className="flex items-center justify-between">
          <Button
            variant="glass"
            render={<a href={buildStepUrl(STEPS[Math.max(0, currentIndex - 1)])} />}
            nativeButton={false}
          >
            <ArrowBackRoundedIcon className="size-4" />
            Back
          </Button>
          {currentStep === "launch" ? (
            <Button
              variant="electric"
              type="button"
              onClick={handleLaunch}
              disabled={!canGoNext()}
              size="lg"
              className="rounded-full"
            >
              <RocketLaunchRoundedIcon className="size-4" />
              Launch command center
            </Button>
          ) : (
            <Button
              variant="electric"
              type="submit"
              form={`${currentStep}-form`}
            >
              Continue
              <ArrowForwardRoundedIcon className="size-4" />
            </Button>
          )}
          </div>
        </div>
      )}

      </div>
      {/* Animations */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 20%, transparent); }
          70%  { box-shadow: 0 0 0 8px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Welcome
// ---------------------------------------------------------------------------

function WelcomeStep({
  userName,
  onContinue,
}: {
  userName?: string;
  onContinue: () => void;
}) {
  const greeting = userName ? `Hi ${userName.split(" ")[0]}!` : "Welcome!";

  return (
    <div className="flex flex-col items-center justify-center pt-8 text-center">
      <div
        className="mb-6"
        style={{ animation: "scaleIn 0.5s ease-out" }}
      >
        <Image
          src="/brand/komenin-welcome-512.png"
          alt="Komenin welcome"
          width={160}
          height={160}
          priority
          className="size-32 object-contain md:size-36"
        />
      </div>
      <h1
        className="mb-3 text-3xl font-bold tracking-tight md:text-4xl"
        style={{ animation: "fadeInUp 0.5s ease-out 0.1s both" }}
      >
        {greeting}
      </h1>
      <p
        className="mb-2 max-w-md text-lg text-muted-foreground"
        style={{ animation: "fadeInUp 0.5s ease-out 0.2s both" }}
      >
        Let&apos;s set up your social operations command center in less than 5 minutes.
      </p>
      <div
        className="mb-8 flex flex-wrap items-center justify-center gap-2"
        style={{ animation: "fadeInUp 0.5s ease-out 0.3s both" }}
      >
        {[
          { icon: <ShieldRoundedIcon className="size-3" />, label: "Approval-safe" },
          { icon: <BoltRoundedIcon className="size-3" />, label: "AI-powered" },
          { icon: <MessageRoundedIcon className="size-3" />, label: "Multi-platform" },
        ].map((feature) => (
          <Badge key={feature.label} variant="secondary" className="gap-1 px-3 py-1.5">
            {feature.icon}
            {feature.label}
          </Badge>
        ))}
      </div>
      <div style={{ animation: "fadeInUp 0.5s ease-out 0.4s both" }}>
        <Button size="lg" variant="electric" render={<a href="/onboarding?step=workspace" />} nativeButton={false} className="gap-2 rounded-full">
          Get started
          <ArrowForwardRoundedIcon className="size-4" />
        </Button>
      </div>
      <p
        className="mt-6 text-xs text-muted-foreground"
        style={{ animation: "fadeInUp 0.5s ease-out 0.5s both" }}
      >
        You can change all settings later from the Settings page.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Workspace
// ---------------------------------------------------------------------------

function WorkspaceStep({
  workspaceName,
  setWorkspaceName,
  timezone,
  setTimezone,
  invites,
  setInvites,
}: {
  workspaceName: string;
  setWorkspaceName: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  invites: string;
  setInvites: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Create your workspace
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace is the central hub for all social operations.
        </p>
      </div>

      <div className="space-y-5">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Field name="workspaceName">
                <FieldLabel htmlFor="onboarding-name">
                  Workspace name
                </FieldLabel>
                <Input
                  id="onboarding-name"
                  name="workspaceName"
                  defaultValue={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Growth"
                  autoFocus
                  required
                  minLength={2}
                />
                <FieldDescription>
                  Your team or brand name. This appears throughout the app.
                </FieldDescription>
              </Field>

              <Field name="timezone">
                <FieldLabel htmlFor="onboarding-timezone">Timezone</FieldLabel>
                <select
                  id="onboarding-timezone"
                  name="timezone"
                  defaultValue={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>option]:bg-neutral-900 [&>option]:text-neutral-100"
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur</option>
                  <option value="Asia/Bangkok">Asia/Bangkok</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="Asia/Seoul">Asia/Seoul</option>
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                  <option value="UTC">UTC</option>
                </select>
                <FieldDescription>
                  Used for schedules, audit timestamps, and digests.
                </FieldDescription>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PersonAddRoundedIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Invite teammates
                <Badge variant="secondary" className="ml-2">
                  Optional
                </Badge>
              </CardTitle>
            </div>
            <CardDescription>
              Add your team now or do it later from Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="onboarding-invites"
              name="invites"
              defaultValue={invites}
              onChange={(e) => setInvites(e.target.value)}
              placeholder="ops@company.com, analyst@company.com"
              rows={3}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Comma-separated emails. They&apos;ll receive an invite link.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Goals
// ---------------------------------------------------------------------------

const GOAL_OPTIONS: {
  value: UserGoal;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "engagement",
    label: "Boost Engagement",
    description:
      "Increase likes, comments, and followers through strategic commenting",
    icon: <FavoriteRoundedIcon className="size-5" />,
  },
  {
    value: "leads",
    label: "Generate Leads",
    description:
      "Capture potential customers through intent-based comment targeting",
    icon: <TrackChangesRoundedIcon className="size-5" />,
  },
  {
    value: "brand",
    label: "Build Brand Awareness",
    description:
      "Strengthen your brand presence through consistent engagement",
    icon: <CampaignRoundedIcon className="size-5" />,
  },
  {
    value: "support",
    label: "Customer Support",
    description:
      "Respond quickly to brand mentions and customer inquiries",
    icon: <SupportRoundedIcon className="size-5" />,
  },
];

const PLATFORM_OPTIONS: {
  value: Platform;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "instagram",
    label: "Instagram",
    icon: <InstagramIcon className="size-7" />,
    color: "from-purple-500/10 to-pink-500/10",
  },
  {
    value: "tiktok",
    label: "TikTok",
    icon: <TiktokIcon className="size-7" />,
    color: "from-cyan-500/10 to-neutral-500/10",
  },
  {
    value: "threads",
    label: "Threads",
    icon: <ThreadsIcon className="size-7" />,
    color: "from-neutral-500/10 to-neutral-300/10",
  },
];

function GoalsStep({
  selectedGoals,
  toggleGoal,
  selectedPlatforms,
  togglePlatform,
}: {
  selectedGoals: UserGoal[];
  toggleGoal: (goal: UserGoal) => void;
  selectedPlatforms: Platform[];
  togglePlatform: (platform: Platform) => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          What are your goals?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select your goals and platforms. We&apos;ll suggest the best campaign templates.
        </p>
      </div>

      {/* Goals */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Goals
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {GOAL_OPTIONS.map((goal, index) => {
            const isSelected = selectedGoals.includes(goal.value);
            return (
              <label
                key={goal.value}
                className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 has-checked:border-electric-500/50 has-checked:bg-electric-500/10 has-checked:shadow-sm ${
                  isSelected ? "" : "border-border hover:border-electric-500/40 hover:shadow-sm"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                <input
                  type="checkbox"
                  name="goals"
                  value={goal.value}
                  defaultChecked={isSelected}
                  onChange={() => toggleGoal(goal.value)}
                  className="sr-only"
                />
                {/* Selection indicator */}
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-200 ${
                    isSelected
                      ? "bg-electric-500 text-white"
                      : "border border-input bg-muted"
                  }`}
                >
                  {isSelected && <CheckRoundedIcon className="size-3" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex shrink-0">{goal.icon}</span>
                    <span className="text-sm font-semibold">{goal.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {goal.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Platforms */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Platforms
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {PLATFORM_OPTIONS.map((platform, index) => {
            const isSelected = selectedPlatforms.includes(platform.value);
            return (
              <label
                key={platform.value}
                className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-all duration-200 has-checked:border-electric-500/50 has-checked:bg-electric-500/10 has-checked:shadow-sm ${
                  isSelected ? "" : "border-border hover:border-electric-500/40 hover:shadow-sm"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${(index + 4) * 0.05}s both`,
                }}
              >
                <input
                  type="checkbox"
                  name="platforms"
                  value={platform.value}
                  defaultChecked={isSelected}
                  onChange={() => togglePlatform(platform.value)}
                  className="sr-only"
                />
                <span
                  className={`absolute right-2 top-2 flex size-4 items-center justify-center rounded-full text-[10px] transition-all duration-200 ${
                    isSelected
                      ? "bg-electric-500 text-white"
                      : "border border-input bg-muted"
                  }`}
                >
                  {isSelected && <CheckRoundedIcon className="size-2.5" />}
                </span>
                <span className="flex shrink-0">{platform.icon}</span>
                <span className="text-sm font-medium">{platform.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Template
// ---------------------------------------------------------------------------

function TemplateStep({
  templates,
  selectedTemplate,
  setSelectedTemplate,
}: {
  templates: CampaignTemplate[];
  selectedTemplate: CampaignTemplate | null;
  setSelectedTemplate: (t: CampaignTemplate | null) => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Pick a campaign template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with a pre-configured campaign or skip to create your own later.
        </p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <MessageRoundedIcon className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No templates match your selection. You can create a campaign from scratch after setup.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((template, index) => {
            const isSelected = selectedTemplate?.id === template.id;
            const platformLabel =
              template.platform === "instagram"
                ? "Instagram"
                : template.platform === "tiktok"
                  ? "TikTok"
                  : "Threads";

            return (
              <label
                key={template.id}
                className={`group relative flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 has-checked:border-electric-500/50 has-checked:bg-electric-500/10 has-checked:shadow-sm ${
                  isSelected ? "" : "border-border hover:border-electric-500/40 hover:shadow-sm"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                <input
                  type="radio"
                  name="templateId"
                  value={template.id}
                  defaultChecked={isSelected}
                  onChange={() =>
                    setSelectedTemplate(isSelected ? null : template)
                  }
                  className="sr-only"
                />
                {/* Icon */}
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-all ${
                    isSelected ? "bg-electric-500 text-white shadow-md" : "bg-muted text-foreground"
                  }`}
                >
                  <TemplateIcon name={template.icon} className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {template.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {platformLabel}
                    </Badge>
                    {template.tags.includes("popular") && (
                      <Badge variant="secondary" className="text-[10px]">
                        <StarRoundedIcon className="size-3" />
                        Popular
                      </Badge>
                    )}
                    {template.tags.includes("high-roi") && (
                      <Badge variant="secondary" className="text-[10px]">
                        <TrendingUpRoundedIcon className="size-3" />
                        High ROI
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {template.description}
                  </p>
                  {isSelected && (
                    <div
                      className="mt-3 flex flex-wrap gap-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground"
                      style={{ animation: "fadeInUp 0.2s ease-out" }}
                    >
                      <span>
                        <strong className="text-foreground">
                          {template.dailyLimit}
                        </strong>{" "}
                        comments/day
                      </span>
                      <span>
                        <strong className="text-foreground">
                          {Math.round(template.minDelaySec / 60)}-
                          {Math.round(template.maxDelaySec / 60)}
                        </strong>{" "}
                        min delay
                      </span>
                      <span>
                        Mode:{" "}
                        <strong className="text-foreground">
                          Approval required
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Selection indicator */}
                <span
                  className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-200 ${
                    isSelected
                      ? "bg-electric-500 text-white"
                      : "border border-input bg-muted"
                  }`}
                >
                  {isSelected && <CheckRoundedIcon className="size-3" />}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Don&apos;t see what you need? Skip this and create a custom campaign later.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Launch
// ---------------------------------------------------------------------------

function LaunchStep({
  workspaceName,
  selectedGoals,
  selectedPlatforms,
  selectedTemplate,
}: {
  workspaceName: string;
  selectedGoals: UserGoal[];
  selectedPlatforms: Platform[];
  selectedTemplate: CampaignTemplate | null;
}) {
  const goalLabels: Record<UserGoal, string> = {
    engagement: "Engagement",
    leads: "Lead Generation",
    brand: "Brand Awareness",
    support: "Customer Support",
  };

  const platformLabels: Record<Platform, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    threads: "Threads",
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-electric-500 text-white shadow-lg"
          style={{ animation: "scaleIn 0.5s ease-out" }}
        >
          <RocketLaunchRoundedIcon className="size-7" />
        </div>
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ animation: "fadeInUp 0.4s ease-out 0.1s both" }}
        >
          Ready to launch!
        </h2>
        <p
          className="mt-1 text-sm text-muted-foreground"
          style={{ animation: "fadeInUp 0.4s ease-out 0.2s both" }}
        >
          Review your setup and hit Launch to create your workspace.
        </p>
      </div>

      <Card
        className="overflow-hidden"
        style={{ animation: "fadeInUp 0.4s ease-out 0.3s both" }}
      >
        <CardContent className="divide-y pt-6">
          {/* Workspace */}
          <div className="pb-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspace
            </div>
            <div className="mt-1 text-sm font-semibold">{workspaceName}</div>
          </div>

          {/* Goals */}
          <div className="py-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Goals
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedGoals.map((g) => (
                <Badge key={g} variant="secondary">
                  {goalLabels[g]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div className="py-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Platforms
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedPlatforms.map((p) => (
                <Badge key={p} variant="secondary">
                  {platformLabels[p]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Template */}
          <div className="pt-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Starting template
            </div>
            <div className="mt-1 text-sm">
              {selectedTemplate ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                  <TemplateIcon name={selectedTemplate.icon} className="size-4" />
                  {selectedTemplate.name}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No template — start from scratch
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next steps preview */}
      <Card
        className="mt-4"
        style={{ animation: "fadeInUp 0.4s ease-out 0.4s both" }}
      >
        <CardHeader>
          <CardTitle className="text-base">
            After launch, you&apos;ll:
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              step: 1,
              text: "Connect your first social account",
            },
            {
              step: 2,
              text: "Set up a proxy for session health",
            },
            {
              step: 3,
              text: selectedTemplate
                ? `Launch "${selectedTemplate.name}" campaign`
                : "Create your first campaign",
            },
            {
              step: 4,
              text: "Review and approve AI-generated comments",
            },
          ].map((step) => (
            <div
              key={step.step}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                {step.step}
              </span>
              <span>{step.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
