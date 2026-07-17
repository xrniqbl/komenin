import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { EditTemplateClient } from "@/components/templates/edit-template-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCommentTemplate } from "@/server/templates";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = await getCommentTemplate(templateId);
  if (!template) notFound();

  return (
    <div>
      <PageHeader
        title={template.name}
        description={`${template.category} · ${template.usageCount} uses · ${template.variables.length} variables`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/app/templates" />} nativeButton={false}>
              Back
            </Button>
            <Badge variant="secondary">{template.isActive ? "active" : "inactive"}</Badge>
          </div>
        }
      />
      <Card><CardContent className="p-6">
        <EditTemplateClient template={template} />
      </CardContent></Card>
    </div>
  );
}
