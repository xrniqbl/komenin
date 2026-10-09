import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAgent } from "@/server/agents";
import { listWorkspaceAiProviders } from "@/server/ai-providers";

export default async function NewAgentPage() {
  const providers = await listWorkspaceAiProviders();

  async function action(formData: FormData) {
    "use server";
    const agent = await createAgent({
      name: String(formData.get("name") || ""),
      tone: String(formData.get("tone") || "professional"),
      language: String(formData.get("language") || "id"),
      systemPrompt: String(formData.get("systemPrompt") || ""),
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
    redirect(`/app/agents/${agent.id}`);
  }

  return (
    <div>
      <PageHeader
        title="New agent"
        description="Create a comment bot persona with tone, characteristics, and optional model override."
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form action={action} className="space-y-4">
            <Field name="name">
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="tone">
                <FieldLabel htmlFor="tone">Tone</FieldLabel>
                <Input id="tone" name="tone" defaultValue="professional" />
              </Field>
              <Field name="language">
                <FieldLabel htmlFor="language">Language</FieldLabel>
                <Input id="language" name="language" defaultValue="id" />
              </Field>
              <Field name="style">
                <FieldLabel htmlFor="style">Style</FieldLabel>
                <select
                  id="style"
                  name="style"
                  defaultValue="balanced"
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0d1322] px-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                >
                  <option value="concise">concise</option>
                  <option value="balanced">balanced</option>
                  <option value="detailed">detailed</option>
                  <option value="expert">expert</option>
                </select>
              </Field>
              <Field name="formality">
                <FieldLabel htmlFor="formality">Formality</FieldLabel>
                <select
                  id="formality"
                  name="formality"
                  defaultValue="neutral"
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0d1322] px-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                >
                  <option value="casual">casual</option>
                  <option value="neutral">neutral</option>
                  <option value="formal">formal</option>
                </select>
              </Field>
              <Field name="emojiPolicy">
                <FieldLabel htmlFor="emojiPolicy">Emoji policy</FieldLabel>
                <select
                  id="emojiPolicy"
                  name="emojiPolicy"
                  defaultValue="light"
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0d1322] px-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                >
                  <option value="none">none</option>
                  <option value="light">light</option>
                  <option value="ok">ok</option>
                </select>
              </Field>
              <Field name="ctaStyle">
                <FieldLabel htmlFor="ctaStyle">CTA style</FieldLabel>
                <select
                  id="ctaStyle"
                  name="ctaStyle"
                  defaultValue="soft"
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0d1322] px-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                >
                  <option value="none">none</option>
                  <option value="soft">soft</option>
                  <option value="direct">direct</option>
                </select>
              </Field>
              <Field name="maxSentences">
                <FieldLabel htmlFor="maxSentences">Max sentences</FieldLabel>
                <Input id="maxSentences" name="maxSentences" type="number" defaultValue={3} />
              </Field>
            </div>
            <Field name="systemPrompt">
              <FieldLabel htmlFor="systemPrompt">System prompt</FieldLabel>
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                rows={5}
                defaultValue="Kamu asisten engagement brand. Tulis komentar relevan, sopan, dan tidak spam."
              />
              <FieldDescription>
                Core persona instructions. Characteristics below are appended automatically.
              </FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="bannedTopics">
                <FieldLabel htmlFor="bannedTopics">Banned topics</FieldLabel>
                <Input id="bannedTopics" name="bannedTopics" placeholder="diskon palsu, medical" />
              </Field>
              <Field name="mustInclude">
                <FieldLabel htmlFor="mustInclude">Must include (optional)</FieldLabel>
                <Input id="mustInclude" name="mustInclude" placeholder="brand phrase" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="aiProviderId">
                <FieldLabel htmlFor="aiProviderId">AI provider override</FieldLabel>
                <select
                  id="aiProviderId"
                  name="aiProviderId"
                  defaultValue=""
                  className="h-9 w-full rounded-md border border-white/10 bg-[#0d1322] px-3 text-sm text-neutral-100 placeholder:text-neutral-500"
                >
                  <option value="">Workspace default</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.kind})
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="model">
                <FieldLabel htmlFor="model">Custom model ID</FieldLabel>
                <Input id="model" name="model" placeholder="gpt-4o-mini / claude-sonnet-4-6" />
              </Field>
              <Field name="temperature">
                <FieldLabel htmlFor="temperature">Temperature</FieldLabel>
                <Input id="temperature" name="temperature" placeholder="0.5" />
              </Field>
              <Field name="maxTokens">
                <FieldLabel htmlFor="maxTokens">Max tokens</FieldLabel>
                <Input id="maxTokens" name="maxTokens" placeholder="220" />
              </Field>
            </div>
            <Button variant="electric" type="submit">Create agent</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
