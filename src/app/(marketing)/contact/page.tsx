"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-8 flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          Contact
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">Book a demo</h1>
        <p className="text-lg text-muted-foreground">
          Ask about enterprise onboarding, security review, or custom quotas.
        </p>
      </div>

      {sent ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Thanks. Your message is ready for sales follow-up.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Send a message</CardTitle>
            <CardDescription>We will respond with next steps.</CardDescription>
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
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="message">How can we help?</Label>
                <Textarea id="message" name="message" required />
              </div>
              <Button type="submit" size="lg">Send message</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
