"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TemplateEditor } from "@/components/templates/template-editor";
import { createCommentTemplate } from "@/server/templates";

export function NewTemplateClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
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
