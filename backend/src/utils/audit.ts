import { prisma } from "../db/prisma";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : undefined,
      newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : undefined,
    },
  });
}
