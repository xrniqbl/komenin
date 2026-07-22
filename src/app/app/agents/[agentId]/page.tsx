import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addKnowledgeDocument,
  addMemoryEntry,
  getAgent,
  runAgentPlayground,
  updateAgent,
} from "@/server/agents";
import { listWorkspaceAiProviders } from "@/server/ai-providers";

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ playground?: string; citations?: string }>;
}) {
  const { agentId } = await params;
  const sp = await searchParams;
  const [agent, providers] = await Promise.all([
    getAgent(agentId),
    listWorkspaceAiProviders(),
  ]);
  if (!agent) notFound();

  async function saveAgent(formData: FormData) {
    "use server";
    await updateAgent({
      agentId,
      name: String(formData.get("name") || ""),
      tone: String(formData.get("tone") || ""),
      language: String(formData.get("language") || ""),
      systemPrompt: String(formData.get("systemPrompt") || ""),
      status: String(formData.get("status") || "active"),
      style: String(formData.get("style") || "balanced"),
      formality: String(formData.get("formality") || "neutral"),
      emojiPolicy: String(formData.get("emojiPolicy") || "light"),
      ctaStyle: String(formData.get("ctaStyle") || "soft"),
      maxSentences: Number(formData.get("maxSentences") || 3),
      bannedTopics: String(formData.get("bannedTopics") || ""),
      mustInclude: String(formData.get("mustInclude") || ""),
      aiProviderId: String(formData.get("aiProviderId") || "") || null,
      model: String(formData.get("model") || "") || null,
      temperature: formData.get("temperature")
        ? Number(formData.get("temperature"))
        : null,
      maxTokens: formData.get("maxTokens") ? Number(formData.get("maxTokens")) : null,
    });
  }

  async function addDoc(formData: FormData) {
    "use server";
    await addKnowledgeDocument({
      agentId,
      title: String(formData.get("title") || "Untitled"),
      rawText: String(formData.get("rawText") || ""),
      sourceType: "text",
    });
  }

  async function addMemory(formData: FormData) {
    "use server";
    await addMemoryEntry({
      agentId,
      entityType: String(formData.get("entityType") || "handle"),
      entityKey: String(formData.get("entityKey") || ""),
      fact: String(formData.get("fact") || ""),
    });
  }

  async function playground(formData: FormData) {
    "use server";
    const result = await runAgentPlayground({
      agentId,
      postContent: String(formData.get("postContent") || ""),
    });
    const q = new URLSearchParams({
      playground: result.draft.content,
      citations: String(result.citations.length),
    });
    redirect(`/app/agents/${agentId}?${q.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={agent.name} description="Persona, knowledge, memory ledger, and safe playground." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Persona</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAgent} className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={agent.name} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" defaultValue={agent.status} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tone">Tone</Label>
              <Input id="tone" name="tone" defaultValue={agent.tone} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="language">Language</Label>
              <Input id="language" name="language" defaultValue={agent.language} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="style">Style</Label>
              <select
                id="style"
                name="style"
                defaultValue={agent.style || "balanced"}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="concise">concise</option>
                <option value="balanced">balanced</option>
                <option value="detailed">detailed</option>
                <option value="expert">expert</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="formality">Formality</Label>
              <select
                id="formality"
                name="formality"
                defaultValue={agent.formality || "neutral"}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="casual">casual</option>
                <option value="neutral">neutral</option>
                <option value="formal">formal</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emojiPolicy">Emoji policy</Label>
              <select
                id="emojiPolicy"
                name="emojiPolicy"
                defaultValue={agent.emojiPolicy || "light"}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="none">none</option>
                <option value="light">light</option>
                <option value="ok">ok</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ctaStyle">CTA style</Label>
              <select
                id="ctaStyle"
                name="ctaStyle"
                defaultValue={agent.ctaStyle || "soft"}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="none">none</option>
                <option value="soft">soft</option>
                <option value="direct">direct</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxSentences">Max sentences</Label>
              <Input
                id="maxSentences"
                name="maxSentences"
                type="number"
                defaultValue={agent.maxSentences ?? 3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aiProviderId">AI provider override</Label>
              <select
                id="aiProviderId"
                name="aiProviderId"
                defaultValue={agent.aiProviderId || ""}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Workspace default</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.kind})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">Custom model ID</Label>
              <Input id="model" name="model" defaultValue={agent.model || ""} placeholder="gpt-4o-mini" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                name="temperature"
                defaultValue={agent.temperature ?? ""}
                placeholder="workspace default"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="maxTokens">Max tokens</Label>
              <Input
                id="maxTokens"
                name="maxTokens"
                defaultValue={agent.maxTokens ?? ""}
                placeholder="workspace default"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="systemPrompt">System prompt</Label>
              <Textarea id="systemPrompt" name="systemPrompt" rows={4} defaultValue={agent.systemPrompt} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bannedTopics">Banned topics</Label>
              <Input
                id="bannedTopics"
                name="bannedTopics"
                defaultValue={(agent.bannedTopics || []).join(", ")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mustInclude">Must include</Label>
              <Input
                id="mustInclude"
                name="mustInclude"
                defaultValue={(agent.mustInclude || []).join(", ")}
              />
            </div>
            <div>
              <Button type="submit">Save persona</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Knowledge</CardTitle>
            <CardDescription>Upload text knowledge. Run worker knowledge.ingest to chunk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addDoc} className="space-y-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Document title</Label>
                <Input id="title" name="title" placeholder="Document title" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rawText">Knowledge text</Label>
                <Textarea id="rawText" name="rawText" rows={5} placeholder="Paste knowledge text" />
              </div>
              <Button type="submit" variant="outline">
                Add document
              </Button>
            </form>
            <div className="space-y-2">
              {agent.knowledgeDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {doc.status} · chunks {doc.chunkCount}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Memory ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addMemory} className="space-y-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="entityType">Entity type</Label>
                <Input id="entityType" name="entityType" defaultValue="handle" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entityKey">Entity key</Label>
                <Input id="entityKey" name="entityKey" placeholder="@username" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fact">Fact</Label>
                <Textarea id="fact" name="fact" rows={3} placeholder="Durable fact" />
              </div>
              <Button type="submit" variant="outline">
                Add memory
              </Button>
            </form>
            <div className="space-y-2">
              {agent.memoryEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {entry.entityType}:{entry.entityKey}
                  </div>
                  <div>{entry.fact}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Playground</CardTitle>
          <CardDescription>Generate a draft without publishing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={playground} className="space-y-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="postContent">Target post</Label>
              <Textarea
                id="postContent"
                name="postContent"
                rows={4}
                placeholder="Paste a target post..."
                required
              />
            </div>
            <Button type="submit">Generate draft</Button>
          </form>
          {sp.playground ? (
            <div className="rounded-lg bg-muted/40 p-4 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">
                Draft · citations {sp.citations || 0}
              </div>
              <div className="whitespace-pre-wrap">{sp.playground}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
