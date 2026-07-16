import { PageHeader } from "@/components/app/page-header";
import { NewTemplateClient } from "@/components/templates/new-template-client";

export default function NewTemplatePage() {
  return (
    <div>
      <PageHeader title="New Template" description="Create a reusable reply template with variables." />
      <div className="rounded-2xl border bg-background p-6">
        <NewTemplateClient />
      </div>
    </div>
  );
}
