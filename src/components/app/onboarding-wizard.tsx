"use client";

import Image from "next/image";
import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Loader2,
  MessageSquare,
  Rocket,
  Shield,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
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
    icon: <Sparkles className="size-4" />,
  },
  workspace: {
    title: "Workspace",
    description: "Set up your space",
    icon: <Globe className="size-4" />,
  },
  goals: {
    title: "Goals",
    description: "What are you here for?",
    icon: <Zap className="size-4" />,
  },
  template: {
    title: "Template",
    description: "Pick a campaign",
    icon: <MessageSquare className="size-4" />,
  },
  launch: {
    title: "Launch",
    description: "You're all set",
    icon: <Rocket className="size-4" />,
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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingWizard({
  userName,
  completeOnboarding,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Form state
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [invites, setInvites] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<UserGoal[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<CampaignTemplate | null>(null);

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
        return true;
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
      await completeOnboarding(formData);
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
    <div className="bg-marketing relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8">
      {/* Progress header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/komenin-robot-waving.png"
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
                    ? "font-medium text-white"
                    : isCompleted
                      ? "text-neutral-500"
                      : "text-neutral-300"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] transition-all duration-300 ${
                    isActive
                      ? "bg-electric-500 text-white shadow-md"
                      : isCompleted
                        ? "bg-neutral-200 text-neutral-600"
                        : "bg-white/10 text-neutral-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-3" />
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
          <WorkspaceStep
            workspaceName={workspaceName}
            setWorkspaceName={setWorkspaceName}
            timezone={timezone}
            setTimezone={setTimezone}
            invites={invites}
            setInvites={setInvites}
          />
        )}
        {currentStep === "goals" && (
          <GoalsStep
            selectedGoals={selectedGoals}
            toggleGoal={toggleGoal}
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
          />
        )}
        {currentStep === "template" && (
          <TemplateStep
            templates={templatesToShow}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
          />
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
        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={isPending}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {currentStep === "launch" ? (
            <Button
              onClick={handleLaunch}
              disabled={isPending || !canGoNext()}
              size="lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Launching…
                </>
              ) : (
                <>
                  <Rocket className="size-4" />
                  Launch command center
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!canGoNext() || isPending}
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      )}

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
          0%   { box-shadow: 0 0 0 0 rgba(23,23,23,0.2); }
          70%  { box-shadow: 0 0 0 8px rgba(23,23,23,0); }
          100% { box-shadow: 0 0 0 0 rgba(23,23,23,0); }
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
  const greeting = userName ? `Hi ${userName.split(" ")[0]}! 👋` : "Welcome! 👋";

  return (
    <div className="flex flex-col items-center justify-center pt-8 text-center">
      <div
        className="mb-6 flex size-24 items-center justify-center"
        style={{ animation: "scaleIn 0.5s ease-out" }}
      >
        <Image
          src="/brand/komenin-robot-waving.png"
          alt="Komenin robot waving"
          width={96}
          height={96}
          className="size-24 object-contain"
          priority
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
          { icon: <Shield className="size-3" />, label: "Approval-safe" },
          { icon: <Zap className="size-3" />, label: "AI-powered" },
          { icon: <MessageSquare className="size-3" />, label: "Multi-platform" },
        ].map((feature) => (
          <Badge key={feature.label} variant="secondary" className="gap-1 px-3 py-1.5">
            {feature.icon}
            {feature.label}
          </Badge>
        ))}
      </div>
      <div style={{ animation: "fadeInUp 0.5s ease-out 0.4s both" }}>
        <Button size="lg" onClick={onContinue} className="gap-2">
          Get started
          <ArrowRight className="size-4" />
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
              <Field name="name">
                <FieldLabel htmlFor="onboarding-name">
                  Workspace name
                </FieldLabel>
                <Input
                  id="onboarding-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Growth"
                  autoFocus
                />
                <FieldDescription>
                  Your team or brand name. This appears throughout the app.
                </FieldDescription>
              </Field>

              <Field name="timezone">
                <FieldLabel htmlFor="onboarding-timezone">Timezone</FieldLabel>
                <Input
                  id="onboarding-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
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
              <UserPlus className="size-4 text-muted-foreground" />
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
              value={invites}
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
  icon: string;
}[] = [
  {
    value: "engagement",
    label: "Boost Engagement",
    description:
      "Increase likes, comments, and followers through strategic commenting",
    icon: "💬",
  },
  {
    value: "leads",
    label: "Generate Leads",
    description:
      "Capture potential customers through intent-based comment targeting",
    icon: "🎯",
  },
  {
    value: "brand",
    label: "Build Brand Awareness",
    description:
      "Strengthen your brand presence through consistent engagement",
    icon: "📢",
  },
  {
    value: "support",
    label: "Customer Support",
    description:
      "Respond quickly to brand mentions and customer inquiries",
    icon: "🛟",
  },
];

const PLATFORM_OPTIONS: {
  value: Platform;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    value: "instagram",
    label: "Instagram",
    icon: "📸",
    color: "from-purple-500/10 to-pink-500/10",
  },
  {
    value: "tiktok",
    label: "TikTok",
    icon: "🎵",
    color: "from-cyan-500/10 to-neutral-500/10",
  },
  {
    value: "threads",
    label: "Threads",
    icon: "🧵",
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
              <button
                key={goal.value}
                type="button"
                onClick={() => toggleGoal(goal.value)}
                className={`group relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-electric-500 bg-electric-500/[0.03] shadow-sm"
                    : "border-white/10 hover:border-white/25 hover:shadow-sm"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Selection indicator */}
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-200 ${
                    isSelected
                      ? "bg-electric-500 text-white"
                      : "border border-white/15 bg-white/5"
                  }`}
                >
                  {isSelected && <Check className="size-3" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{goal.icon}</span>
                    <span className="text-sm font-semibold">{goal.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {goal.description}
                  </p>
                </div>
              </button>
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
              <button
                key={platform.value}
                type="button"
                onClick={() => togglePlatform(platform.value)}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-all duration-200 ${
                  isSelected
                    ? "border-electric-500 bg-electric-500/[0.03] shadow-sm"
                    : "border-white/10 hover:border-white/25 hover:shadow-sm"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${(index + 4) * 0.05}s both`,
                }}
              >
                <span
                  className={`absolute right-2 top-2 flex size-4 items-center justify-center rounded-full text-[10px] transition-all duration-200 ${
                    isSelected
                      ? "bg-electric-500 text-white"
                      : "border border-white/15 bg-white/5"
                  }`}
                >
                  {isSelected && <Check className="size-2.5" />}
                </span>
                <span className="text-2xl">{platform.icon}</span>
                <span className="text-sm font-medium">{platform.label}</span>
              </button>
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
            <MessageSquare className="mb-3 size-10 text-muted-foreground/40" />
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
              <button
                key={template.id}
                type="button"
                onClick={() =>
                  setSelectedTemplate(isSelected ? null : template)
                }
                className={`group relative flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-electric-500 bg-electric-500/[0.03] shadow-sm"
                    : "border-white/10 hover:border-white/25 hover:shadow-sm"
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Icon */}
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-xl transition-all ${
                    isSelected ? "bg-electric-500 shadow-md" : "bg-white/10"
                  }`}
                >
                  {template.icon}
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
                        ⭐ Popular
                      </Badge>
                    )}
                    {template.tags.includes("high-roi") && (
                      <Badge variant="secondary" className="text-[10px]">
                        📈 High ROI
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {template.description}
                  </p>
                  {isSelected && (
                    <div
                      className="mt-3 flex flex-wrap gap-4 rounded-lg bg-white/5 p-3 text-xs text-neutral-400"
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
                      : "border border-white/15 bg-white/5"
                  }`}
                >
                  {isSelected && <Check className="size-3" />}
                </span>
              </button>
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
          <Rocket className="size-7" />
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
                <span className="font-semibold">
                  {selectedTemplate.icon} {selectedTemplate.name}
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
              icon: "1️⃣",
              text: "Connect your first social account",
            },
            {
              icon: "2️⃣",
              text: "Set up a proxy for session health",
            },
            {
              icon: "3️⃣",
              text: selectedTemplate
                ? `Launch "${selectedTemplate.name}" campaign`
                : "Create your first campaign",
            },
            {
              icon: "4️⃣",
              text: "Review and approve AI-generated comments",
            },
          ].map((step) => (
            <div
              key={step.icon}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <span className="text-base">{step.icon}</span>
              <span>{step.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
