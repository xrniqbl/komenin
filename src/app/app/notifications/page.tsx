import { PageHeader } from "@/components/app/page-header";

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications" description="Workspace alerts and system events." />
      <div className="rounded-2xl border border bg-background p-6 text-sm text-muted-foreground">
        No notifications yet.
      </div>
    </div>
  );
}
