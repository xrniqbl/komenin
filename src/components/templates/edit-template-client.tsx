"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { TemplateEditor } from "@/components/templates/template-editor";
import { deleteCommentTemplate, updateCommentTemplate } from "@/server/templates";

export function EditTemplateClient({
  template,
}: {
  template: { id: string; name: string; body: string; category: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <TemplateEditor
        defaultName={template.name}
        defaultBody={template.body}
        defaultCategory={template.category}
        submitLabel="Update template"
        pending={pending}
        onSubmit={(data) =>
          startTransition(async () => {
            try {
              await updateCommentTemplate(template.id, data);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to update");
            }
          })
        }
      />

      <div className="border-t pt-6">
        <div className="text-sm font-medium text-destructive">Danger zone</div>
        <div className="mt-2 text-xs text-muted-foreground">Delete this template — this action cannot be undone.</div>
        <ConfirmAction
          title="Delete this template?"
          description="This action cannot be undone."
          confirmLabel="Delete template"
          destructive
          disabled={pending}
          trigger={<Button variant="destructive" className="mt-3">Delete template</Button>}
          onConfirm={async () => {
            try {
              await deleteCommentTemplate(template.id);
              toastManager.add({ title: "Template deleted", type: "success" });
              router.push("/app/templates");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to delete");
              throw e;
            }
          }}
        />
      </div>
    </div>
  );
}
