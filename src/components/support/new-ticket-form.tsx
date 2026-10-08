"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support";

const CATEGORY_OPTIONS: { value: SupportCategory; label: string }[] = [
  { value: "bug", label: "Bug / something is not working" },
  { value: "billing", label: "Billing & subscription" },
  { value: "account", label: "Account & access" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
];

export function NewTicketForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; id?: string; error?: string }>;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok && result.id) {
        router.push(`/app/support/${result.id}`);
      } else {
        setError(result.error || "Failed to create the ticket.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? (
        <Alert variant="error">
          <AlertTitle>Could not create ticket</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={category}
          onValueChange={(value) => {
            if (typeof value === "string" && value) setCategory(value as SupportCategory);
          }}
        >
          <SelectTrigger id="category" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <input type="hidden" name="category" value={category} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          required
          minLength={5}
          maxLength={150}
          placeholder="Short summary of the problem"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Details</Label>
        <Textarea
          id="body"
          name="body"
          required
          minLength={20}
          maxLength={5000}
          rows={8}
          placeholder={
            "What happened, what you expected, and when it started. " +
            "Your name, email, workspace, and plan are attached automatically."
          }
        />
      </div>

      <div>
        <Button variant="electric" type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit ticket"}
        </Button>
      </div>
    </form>
  );
}
