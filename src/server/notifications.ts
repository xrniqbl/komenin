"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";

export async function listNotifications(limit = 50, filters?: { status?: string; q?: string }) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (filters?.status && filters.status !== "all") where.status = filters.status as never;
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" as const } },
      { body: { contains: q, mode: "insensitive" as const } },
    ];
  }
  return db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function listNotificationsPage(page: number, pageSize = 10, filters?: { status?: string; q?: string }) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> = { workspaceId: workspace.id };
  if (filters?.status && filters.status !== "all") where.status = filters.status;
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
    ];
  }
  const total = await db.notification.count({ where });
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / safeSize)));
  const items = await db.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * safeSize,
    take: safeSize,
  });
  return { items, total };
}

export async function archiveNotification(id: string) {
  const { workspace } = await requireActiveWorkspace();
  await db.notification.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { status: "archived", readAt: new Date() },
  });
  revalidatePath("/app/notifications");
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
