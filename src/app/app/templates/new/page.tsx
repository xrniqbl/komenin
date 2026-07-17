import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { NewTemplateClient } from "@/components/templates/new-template-client";

export default function NewTemplatePage() {
  return (
    <div>
      <PageHeader title="New Template" description="Create a reusable reply template with variables." />
      <Card><CardContent className="p-6">
        <NewTemplateClient />
      </CardContent></Card>
    </div>
  );
}
