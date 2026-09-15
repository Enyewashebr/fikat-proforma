import { PrismaClient } from "@prisma/client";

/**
 * Generates PF-<year>-000123 style numbers. Never generated on the frontend —
 * counts existing finalized proformas for the year inside the same DB
 * transaction as the finalize write, so two concurrent finalizes can't
 * collide (see spec rule #35 on concurrency).
 */
export async function nextProformaNumber(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PF-${year}-`;

  const count = await tx.proforma.count({
    where: { number: { startsWith: prefix } },
  });

  const next = String(count + 1).padStart(6, "0");
  return `${prefix}${next}`;
}
