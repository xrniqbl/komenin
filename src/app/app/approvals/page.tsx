import { PageHeader } from "@/components/app/page-header";
import { ApprovalsQueueClient } from "@/components/approvals/approvals-queue-client";
import { listApprovals } from "@/server/comment-pipeline";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop queue before comments are scheduled to send. Select multiple to bulk approve or reject. Edit the draft, then approve or reject."
      />
      <ApprovalsQueueClient approvals={approvals} />
    </div>
  );
}
