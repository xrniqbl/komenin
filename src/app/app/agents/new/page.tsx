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

export default function NewAgentPage() {
  async function action(formData: FormData) {
    "use server";
    const agent = await createAgent({
      name: String(formData.get("name") || ""),
      tone: String(formData.get("tone") || "professional"),
      language: String(formData.get("language") || "id"),
      systemPrompt: String(formData.get("systemPrompt") || ""),
    });
    redirect(`/app/agents/${agent.id}`);
  }

  return (
    <div>
      <PageHeader title="New agent" description="Create a persona with tone and guardrail-friendly prompt." />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <Form action={action} className="space-y-4">
            <Field name="name">
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" required />
            </Field>
            <Field name="tone">
              <FieldLabel htmlFor="tone">Tone</FieldLabel>
              <Input id="tone" name="tone" defaultValue="professional" />
            </Field>
            <Field name="language">
              <FieldLabel htmlFor="language">Language</FieldLabel>
              <Input id="language" name="language" defaultValue="id" />
            </Field>
            <Field name="systemPrompt">
              <FieldLabel htmlFor="systemPrompt">System prompt</FieldLabel>
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                rows={5}
                defaultValue="Kamu asisten engagement brand. Tulis komentar relevan, sopan, dan tidak spam."
              />
              <FieldDescription>
                Keep it brand-safe. High-risk claims should still pass risk rules and approval.
              </FieldDescription>
            </Field>
            <Button type="submit">Create agent</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
