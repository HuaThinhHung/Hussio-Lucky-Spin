import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "@/server/db";

export type AuditInput = {
  adminUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
};

/** Append-only admin audit trail. Never store raw phone numbers or secrets in `details`. */
export async function logAudit(input: AuditInput, client: DbOrTx = db): Promise<void> {
  try {
    await client.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: input.details,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write", input.action, error);
  }
}
