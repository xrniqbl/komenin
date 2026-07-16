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

  return (
    <div className="mx-auto max-w-xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-8 flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          {copy.badge}
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-lg text-muted-foreground">{copy.subtitle}</p>
      </div>

      {sent ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {copy.success}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{copy.formTitle}</CardTitle>
            <CardDescription>{copy.formSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setSent(true);
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{copy.name}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{copy.email}</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="message">{copy.message}</Label>
                <Textarea id="message" name="message" required />
              </div>
              <Button type="submit" size="lg">
                {copy.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
