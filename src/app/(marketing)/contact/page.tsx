"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const { t } = useLocale();
  const copy = t.contactPage;
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          email: String(formData.get("email") || ""),
          message: String(formData.get("message") || ""),
          // Honeypot — leave empty; bots often fill hidden fields.
          company: String(formData.get("company") || ""),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error || copy.errorGeneric);
        return;
      }
      setSent(true);
    } catch {
      setError(copy.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-transparent">
    <div className="mx-auto max-w-xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-8 flex flex-col gap-3">
        <Badge className="w-fit border-white/10 bg-white/5 text-neutral-300">
          {copy.badge}
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-white">{copy.title}</h1>
        <p className="text-lg text-neutral-400">{copy.subtitle}</p>
      </div>

      {sent ? (
        <Card className="glass border-white/10 bg-white/5 shadow-none backdrop-blur-xl">
          <CardContent className="pt-6 text-sm text-neutral-400">
            {copy.success}
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-white/10 bg-white/5 shadow-none backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">{copy.formTitle}</CardTitle>
            <CardDescription className="text-neutral-400">{copy.formSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className="text-neutral-300">{copy.name}</Label>
                <Input id="name" name="name" autoComplete="name" required disabled={submitting} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-neutral-300">{copy.email}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="message" className="text-neutral-300">{copy.message}</Label>
                <Textarea id="message" name="message" required rows={5} disabled={submitting} />
              </div>
              {/* Honeypot — visually hidden from users */}
              <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden>
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" variant="electric" disabled={submitting} className="rounded-full">
                {submitting ? copy.submitting : copy.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
