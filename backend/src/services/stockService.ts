import { StockTransactionType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

/**
 * Adjusts a stock size's available quantity and records the transaction in
 * the same DB call. This is the ONLY place quantityAvailable should be
 * written from — controllers must go through this, never
 * `prisma.stockSize.update({ data: { quantityAvailable: n } })` directly.
 */
export async function adjustStock(params: {
  stockSizeId: string;
  quantityDelta: number;
  type: StockTransactionType;
  reason?: string;
  referenceProformaId?: string;
  userId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const stockSize = await tx.stockSize.findUnique({ where: { id: params.stockSizeId } });
    if (!stockSize) throw new ApiError(404, "Stock size not found.");

    const newQuantity = stockSize.quantityAvailable + params.quantityDelta;
    if (newQuantity < 0) {
      throw new ApiError(
        400,
        `Insufficient stock: have ${stockSize.quantityAvailable}, tried to remove ${-params.quantityDelta}.`
      );
    }

    const updated = await tx.stockSize.update({
      where: { id: params.stockSizeId },
      data: { quantityAvailable: newQuantity },
    });

    await tx.stockTransaction.create({
      data: {
        stockSizeId: params.stockSizeId,
        type: params.type,
        quantityDelta: params.quantityDelta,
        previousQuantity: stockSize.quantityAvailable,
        newQuantity,
        reason: params.reason,
        referenceProformaId: params.referenceProformaId,
        userId: params.userId,
      },
    });

    return updated;
  });
}

/** Dashboard hierarchy: material -> (product type ->) stock sizes, with status. */
export async function getStockHierarchy(category: "GRANITE" | "CERAMIC") {
  const materials = await prisma.material.findMany({
    where: { category, active: true },
    include: {
      productTypes: {
        include: { stockSizes: true },
      },
      stockSizes: { where: { productTypeId: null } },
    },
    orderBy: { name: "asc" },
  });

  return materials.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    // Granite: grouped under product types. Ceramic: flat stock sizes.
    productTypes: m.productTypes.map((pt) => ({
      id: pt.id,
      name: pt.name,
      stockSizes: pt.stockSizes.map(withStatus),
    })),
    stockSizes: m.stockSizes.map(withStatus),
  }));
}

function withStatus<T extends { quantityAvailable: number; lowStockThreshold: number }>(
  s: T
): T & { status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" } {
  const status =
    s.quantityAvailable === 0
      ? "OUT_OF_STOCK"
      : s.quantityAvailable <= s.lowStockThreshold
      ? "LOW_STOCK"
      : "IN_STOCK";
  return { ...s, status };
}

export async function getDashboardSummary() {
  const stockSizes = await prisma.stockSize.findMany({ include: { material: true } });

  const materialTypeCount = new Set(stockSizes.map((s) => s.materialId)).size;
  const totalPieces = stockSizes.reduce((sum, s) => sum + s.quantityAvailable, 0);
  const lowStock = stockSizes.filter(
    (s) => s.quantityAvailable > 0 && s.quantityAvailable <= s.lowStockThreshold
  ).length;
  const outOfStock = stockSizes.filter((s) => s.quantityAvailable === 0).length;

  return { materialTypeCount, totalPieces, lowStock, outOfStock };
}
