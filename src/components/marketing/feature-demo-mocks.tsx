"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Dot({ color = "bg-foreground" }: { color?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function MockRail({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border bg-card">
      <div className="w-1 shrink-0" style={{ background: color }} />
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold">{label}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">active</Badge>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export function SessionRoutingMock() {
  return (
    <div className="space-y-2 rounded-2xl border bg-muted/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Session Grid</div>
        <Badge variant="secondary" className="text-[10px]">3 healthy tunnels</Badge>
      </div>
      <MockRail label="@brand_id · instagram" color="#22c55e">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">185.142.34.x</span>
          <span>·</span><span>score 94</span><span>·</span><span>12/50 quota</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">HTTP</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">residential</span>
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-700">healthy</span>
        </div>
      </MockRail>
      <MockRail label="@growth_ops · threads" color="#6366f1">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">8.8.32.x</span><span>·</span><span>score 81</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">SOCKS5</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">degraded</span>
        </div>
      </MockRail>
      <MockRail label="@aether_lab · tiktok" color="#06b6d4">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">203.0.12.x</span><span>·</span><span>score 96</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">mobile</span>
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-700">healthy</span>
        </div>
      </MockRail>
    </div>
  );
}

export function CommentEngineMock() {
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Approval queue</div>
        <Badge variant="outline" className="text-[10px]">12 pending</Badge>
      </div>
      <Card>
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs">Growth Campaign · @techfounder_42</CardTitle>
            <span className="text-[10px] text-muted-foreground">2m ago</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <div className="rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
            &quot;Baru bahas AI infra scaling, ada best practice buat cost control?&quot;
          </div>
          <div className="rounded-lg border bg-background p-2 text-xs">
            Menarik insight soal AI infra. Untuk cost control, pendekatan FinOps bertahap biasanya lebih sustainable—mulai dari visibility, lalu guardrail. Happy to share playbook kami.
          </div>
          <div className="flex gap-2">
            <span className="h-7 flex-1 rounded-md bg-foreground text-center text-[11px] font-medium leading-7 text-background">Approve & schedule</span>
            <span className="h-7 flex-1 rounded-md border bg-background text-center text-[11px] leading-7">Reject</span>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-[11px]">
        <Dot color="bg-green-500" />
        <span>Delayed 87s via human-like pacing</span>
        <Badge variant="outline" className="ml-auto text-[10px]">scheduled → sent</Badge>
      </div>
    </div>
  );
}

export function AgentIntelligenceMock() {
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Agent Intelligence</div>
        <Badge className="text-[10px]">Sales Assist · professional</Badge>
      </div>
      <div className="space-y-2">
        <div className="rounded-xl rounded-bl-sm bg-foreground px-3 py-2 text-xs leading-relaxed text-background">
          System: You are Sales Assist. Tone professional. No spam. Max 3 sentences. Use knowledge if relevant.
        </div>
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] text-muted-foreground">
              <Badge variant="secondary" className="text-[9px]">knowledge</Badge>
              <span>3 chunks ranked</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="rounded bg-muted p-2 text-[11px]">
                <span className="font-medium">Coupon FAQ:</span> AETHER20 gives 20% off first month.
              </div>
              <div className="rounded bg-muted p-2 text-[11px]">
                <span className="font-medium">Brand FAQ:</span> Aether is enterprise social ops control plane.
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="rounded-xl rounded-br-sm border bg-card px-3 py-2 text-xs leading-relaxed">
          Thanks for asking! Aether supports approval-first workflows—good fit for enterprise ops. Our AETHER20 coupon gives 20% off first month if you want to pilot.
        </div>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="text-[9px]">tone: professional</Badge>
          <Badge variant="outline" className="text-[9px]">lang: id</Badge>
          <Badge variant="outline" className="text-[9px]">RAG grounded</Badge>
        </div>
      </div>
    </div>
  );
}

export function SkillExecutionMock() {
  const skills = [
    { name: "Coupon Lookup", triggers: ["coupon", "diskon", "promo"], runs: 342, status: "healthy" },
    { name: "Brand FAQ", triggers: ["harga", "price", "fitur"], runs: 580, status: "healthy" },
    { name: "Lead Qualifier", triggers: ["demo", "call", "meeting"], runs: 120, status: "high-risk" },
  ];
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Skill Registry</div>
        <Badge variant="secondary" className="text-[10px]">{skills.length} skills · 1 high-risk</Badge>
      </div>
      {skills.map((skill) => (
        <Card key={skill.name} className={skill.status === "high-risk" ? "border-amber-300" : ""}>
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{skill.name}</span>
                <Badge variant={skill.status === "high-risk" ? "destructive" : "secondary"} className="text-[9px]">
                  {skill.status}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {skill.triggers.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{t}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium">{skill.runs}</div>
              <div className="text-[10px] text-muted-foreground">runs</div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="rounded-xl border bg-card p-3">
        <div className="text-[11px] font-medium">Latest run — CoT timeline</div>
        <div className="mt-2 space-y-1.5 border-l-2 pl-3 text-[11px]">
          <div className="flex gap-2"><Dot color="bg-green-500" /><span>intent matched: &quot;coupon&quot; → coupon-lookup</span></div>
          <div className="flex gap-2"><Dot color="bg-blue-500" /><span>lookup: code AETHER20 valid 20%</span></div>
          <div className="flex gap-2"><Dot color="bg-purple-500" /><span>compose: friendly reply + guardrail pass</span></div>
        </div>
      </div>
    </div>
  );
}
