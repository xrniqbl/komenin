"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TemplateEditor } from "@/components/templates/template-editor";
import { createCommentTemplate } from "@/server/templates";

export function NewTemplateClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      {error ? (
        <Alert variant="error" className="mb-4">
          <AlertTitle>Template error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <TemplateEditor
        submitLabel="Create template"
        pending={pending}
        onSubmit={(data) =>
          startTransition(async () => {
            try {
              const t = await createCommentTemplate(data);
              router.push(`/app/templates/${t.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to create");
            }
          })
        }
      />
    </div>
  );
}
