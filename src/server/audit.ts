import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function writeAuditLog(input: {
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  ip?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  // Audit adalah jalur observabilitas, bukan jalur kritis: kegagalan tulis
  // audit (DB blip, tabel belum migrate) tidak boleh menggagalkan operasi
  // utama (lead sudah tercipta, job sudah sukses) menjadi 500 / duplikat
  // saat retry. Best-effort: catat ke console lalu kembalikan null.
  try {
    return await db.auditLog.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ip: input.ip,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[audit] writeAuditLog failed (best-effort, swallowed)", {
      action: input.action,
      resourceType: input.resourceType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}