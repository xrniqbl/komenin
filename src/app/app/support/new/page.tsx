import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { NewTicketForm } from "@/components/support/new-ticket-form";
import { createSupportTicket } from "@/server/support";

export default async function NewSupportTicketPage() {
  async function submit(formData: FormData) {
    "use server";
    return createSupportTicket({
      category: String(formData.get("category") || "other") as
        | "bug"
        | "billing"
        | "account"
        | "feature"
        | "other",
      subject: String(formData.get("subject") || ""),
      body: String(formData.get("body") || ""),
    });
  }

  return (
    <div>
      <PageHeader
        title="New support ticket"
        description="Your name, email, workspace, and plan are attached automatically — no need to repeat them."
        action={
          <Button variant="link" render={<Link href="/app/support" />} nativeButton={false}>
            Back to tickets
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <NewTicketForm action={submit} />
        </CardContent>
      </Card>
    </div>
  );
}
