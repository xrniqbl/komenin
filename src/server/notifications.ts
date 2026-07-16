"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";

export async function listNotifications(limit = 50) {
  const { workspace } = await requireActiveWorkspace();
  return db.notification.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(id: string) {
  const { workspace } = await requireActiveWorkspace();
  await db.notification.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { status: "read", readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}

export async function markAllNotificationsRead() {
  const { workspace } = await requireActiveWorkspace();
  await db.notification.updateMany({
    where: { workspaceId: workspace.id, status: "unread" },
    data: { status: "read", readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}
