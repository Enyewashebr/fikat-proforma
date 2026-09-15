import { StockTransactionType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import {
  calculateAreaPerPieceItem,
  calculateAreaTotalItem,
  calculatePieceItem,
  calculateProformaTotals,
  piecesNeededForArea,
} from "./proformaCalculator";
import { optimizeStock } from "./stockOptimizer";
import { nextProformaNumber } from "../utils/proformaNumber";
import { logAudit } from "../utils/audit";
import { StockSizeDTO } from "../types/domain";

export type PricingMode = "PIECE" | "AREA_PER_PIECE" | "AREA_TOTAL";

async function getVatRate(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: "vatRate" } });
  return setting ? parseFloat(setting.value) : 0.15;
}

async function getPricePerM2(materialId: string, productTypeId: string | null): Promise<number> {
  const price = await prisma.price.findFirst({
    where: { materialId, productTypeId: productTypeId ?? null, active: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!price) {
    throw new ApiError(
      400,
      "No price is configured for this material/product yet. Enter a price for this line, " +
        "or set one under Materials first."
    );
  }
  return price.pricePerM2;
}

/** Remembers whatever price the user typed so the next row for the same
 * material/application doesn't need it re-entered (spec: "the fixed price is
 * not changed so don't make the user enter it every row"). */
async function rememberPrice(materialId: string, productTypeId: string | null, pricePerM2: number) {
  await prisma.price.updateMany({
    where: { materialId, productTypeId: productTypeId ?? null },
    data: { active: false },
  });
  await prisma.price.create({ data: { materialId, productTypeId, pricePerM2, active: true } });
}

/**
 * Adds one row to a DRAFT proforma. This is intentionally the ONLY effect —
 * it does not touch status, does not allocate stock, and does not prevent
 * the caller from adding more rows afterward. The proforma stays a draft
 * until finalizeProforma() is called explicitly (spec rule #8/#12).
 */
export async function addProformaItem(params: {
  proformaId: string;
  materialId: string;
  productTypeId: string | null;
  itemLabel: string;
  customerLengthCm: number;
  customerWidthCm: number;
  thickness: number;
  unit: string;
  /** Required for PIECE and AREA_PER_PIECE. Ignored (computed) for AREA_TOTAL. */
  quantity?: number;
  pricingMode: PricingMode;
  /** Required for AREA_TOTAL — the total square meters the customer needs. */
  requestedAreaM2?: number;
  /** If provided, used directly instead of the material's configured Price, and remembered for next time. */
  pricePerM2?: number;
}) {
  const proforma = await prisma.proforma.findUnique({ where: { id: params.proformaId } });
  if (!proforma) throw new ApiError(404, "Proforma not found.");
  if (proforma.status !== "DRAFT" && proforma.status !== "REVIEW") {
    throw new ApiError(400, "This proforma is already finalized or cancelled and can't be edited.");
  }

  const pricePerM2 =
    params.pricePerM2 !== undefined && params.pricePerM2 !== null
      ? params.pricePerM2
      : await getPricePerM2(params.materialId, params.productTypeId);

  // Whatever price is used for this row becomes the new remembered default
  // for this material/application, whether the user typed it or it came
  // from the last remembered value — keeps every row consistent.
  if (params.pricePerM2 !== undefined && params.pricePerM2 !== null) {
    await rememberPrice(params.materialId, params.productTypeId, params.pricePerM2);
  }

  let calc: { billableAreaM2: number; unitPrice: number; totalPrice: number };
  let quantity: number;

  if (params.pricingMode === "PIECE") {
    if (!params.quantity || params.quantity < 1) throw new ApiError(400, "Enter a quantity (pieces).");
    quantity = params.quantity;
    calc = calculatePieceItem(pricePerM2, quantity);
  } else if (params.pricingMode === "AREA_TOTAL") {
    if (!params.requestedAreaM2 || params.requestedAreaM2 <= 0) {
      throw new ApiError(400, "Enter the total area needed (m²).");
    }
    quantity = piecesNeededForArea(params.requestedAreaM2, params.customerLengthCm, params.customerWidthCm);
    calc = calculateAreaTotalItem(params.requestedAreaM2, pricePerM2);
  } else {
    if (!params.quantity || params.quantity < 1) throw new ApiError(400, "Enter a quantity (pieces).");
    quantity = params.quantity;
    calc = calculateAreaPerPieceItem(params.customerLengthCm, params.customerWidthCm, quantity, pricePerM2);
  }

  const item = await prisma.proformaItem.create({
    data: {
      proformaId: params.proformaId,
      materialId: params.materialId,
      productTypeId: params.productTypeId,
      itemLabel: params.itemLabel,
      customerLengthCm: params.customerLengthCm,
      customerWidthCm: params.customerWidthCm,
      thickness: params.thickness,
      unit: params.unit,
      quantity,
      pricingMode: params.pricingMode,
      requestedAreaM2: params.pricingMode === "AREA_TOTAL" ? params.requestedAreaM2 : null,
      pricePerM2,
      billableAreaM2: calc.billableAreaM2,
      unitPrice: calc.unitPrice,
      totalPrice: calc.totalPrice,
    },
  });

  await recalculateTotals(params.proformaId);
  return item;
}

export async function setCuttingCharge(proformaId: string, cuttingCharge: number) {
  const proforma = await prisma.proforma.findUnique({ where: { id: proformaId } });
  if (!proforma) throw new ApiError(404, "Proforma not found.");
  if (proforma.status !== "DRAFT" && proforma.status !== "REVIEW") {
    throw new ApiError(400, "This proforma is already finalized or cancelled and can't be edited.");
  }
  if (cuttingCharge < 0) throw new ApiError(400, "Cutting charge can't be negative.");

  await prisma.proforma.update({ where: { id: proformaId }, data: { cuttingCharge } });
  return recalculateTotals(proformaId);
}

export async function removeProformaItem(proformaId: string, itemId: string) {
  const proforma = await prisma.proforma.findUnique({ where: { id: proformaId } });
  if (!proforma) throw new ApiError(404, "Proforma not found.");
  if (proforma.status !== "DRAFT" && proforma.status !== "REVIEW") {
    throw new ApiError(400, "This proforma is already finalized or cancelled and can't be edited.");
  }
  await prisma.proformaItem.delete({ where: { id: itemId } });
  await recalculateTotals(proformaId);
}

async function recalculateTotals(proformaId: string) {
  const proforma = await prisma.proforma.findUniqueOrThrow({ where: { id: proformaId } });
  const items = await prisma.proformaItem.findMany({ where: { proformaId } });
  const vatRate = await getVatRate();
  const totals = calculateProformaTotals(items, proforma.cuttingCharge, vatRate);
  return prisma.proforma.update({
    where: { id: proformaId },
    data: { ...totals, vatRate },
  });
}

/** Preview-only: what stock combination would cover this item right now. Doesn't allocate anything. */
export async function previewStockCombination(itemId: string) {
  const item = await prisma.proformaItem.findUnique({ where: { id: itemId } });
  if (!item) throw new ApiError(404, "Proforma item not found.");

  const stockSizes = await prisma.stockSize.findMany({
    where: { materialId: item.materialId, productTypeId: item.productTypeId },
  });

  return optimizeStock(
    { lengthCm: item.customerLengthCm, widthCm: item.customerWidthCm, quantity: item.quantity },
    stockSizes as StockSizeDTO[]
  );
}

/**
 * Explicit user action only — this is the one place a proforma stops being
 * editable. Assigns the proforma number, computes final stock combinations
 * for every item, and allocates (deducts) stock — all inside one DB
 * transaction so a partial finalize can never happen (spec rule #33/#35).
 */
export async function finalizeProforma(proformaId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const proforma = await tx.proforma.findUnique({
      where: { id: proformaId },
      include: { items: true },
    });
    if (!proforma) throw new ApiError(404, "Proforma not found.");
    if (proforma.status === "FINALIZED") throw new ApiError(400, "Already finalized.");
    if (proforma.status === "CANCELLED") throw new ApiError(400, "This proforma was cancelled.");
    if (proforma.items.length === 0) {
      throw new ApiError(400, "Add at least one item before finalizing.");
    }

    for (const item of proforma.items) {
      const stockSizes = await tx.stockSize.findMany({
        where: { materialId: item.materialId, productTypeId: item.productTypeId },
      });

      const result = optimizeStock(
        { lengthCm: item.customerLengthCm, widthCm: item.customerWidthCm, quantity: item.quantity },
        stockSizes as StockSizeDTO[]
      );

      if (!result.feasible) {
        throw new ApiError(
          400,
          `Insufficient stock for "${item.itemLabel}": need ${result.shortfall?.requestedPieces ?? "?"} pieces, ` +
            `can currently produce ${result.shortfall?.producedPieces ?? 0}.`
        );
      }

      for (const combo of result.combination) {
        await tx.proformaStockAllocation.create({
          data: {
            proformaItemId: item.id,
            stockSizeId: combo.stockSizeId,
            piecesNeeded: combo.stockPiecesUsed,
            usedLengthCm: combo.stockPiecesUsed * combo.stockLengthCm,
            wasteLengthCm: combo.wasteLengthCm,
            totalStockArea: combo.totalStockArea,
            totalWasteArea: combo.totalWasteArea,
            mode: result.mode,
            customerPiecesProduced: combo.customerPiecesProduced,
          },
        });

        const stockSize = await tx.stockSize.findUniqueOrThrow({ where: { id: combo.stockSizeId } });
        const newQuantity = stockSize.quantityAvailable - combo.stockPiecesUsed;
        if (newQuantity < 0) {
          throw new ApiError(400, `Insufficient stock for "${item.itemLabel}".`);
        }
        await tx.stockSize.update({
          where: { id: combo.stockSizeId },
          data: { quantityAvailable: newQuantity },
        });
        await tx.stockTransaction.create({
          data: {
            stockSizeId: combo.stockSizeId,
            type: StockTransactionType.PROFORMA_ALLOCATION,
            quantityDelta: -combo.stockPiecesUsed,
            previousQuantity: stockSize.quantityAvailable,
            newQuantity,
            reason: `Proforma ${proformaId}`,
            referenceProformaId: proformaId,
            userId,
          },
        });
      }
    }

    // A reopened proforma already has a number — reuse it rather than
    // minting a new one on re-finalize.
    const number = proforma.number ?? (await nextProformaNumber(tx));
    const finalized = await tx.proforma.update({
      where: { id: proformaId },
      data: { status: "FINALIZED", number, finalizedAt: new Date() },
    });

    await logAudit({
      userId,
      action: "PROFORMA_FINALIZED",
      entityType: "Proforma",
      entityId: proformaId,
      newValue: { number },
    });

    return finalized;
  });
}

/**
 * Reopens a FINALIZED proforma for editing. Releases every stock piece that
 * finalize allocated back to available inventory (recorded as a
 * PROFORMA_RELEASE transaction, mirroring the original allocation) and drops
 * the proforma back to DRAFT. The proforma keeps its assigned number — if
 * it's finalized again, finalizeProforma() reuses that number rather than
 * minting a new one.
 */
export async function reopenProforma(proformaId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const proforma = await tx.proforma.findUnique({
      where: { id: proformaId },
      include: { items: { include: { stockAllocations: true } } },
    });
    if (!proforma) throw new ApiError(404, "Proforma not found.");
    if (proforma.status !== "FINALIZED") {
      throw new ApiError(400, "Only a finalized proforma needs to be reopened — this one is already editable.");
    }

    for (const item of proforma.items) {
      for (const allocation of item.stockAllocations) {
        const stockSize = await tx.stockSize.findUniqueOrThrow({ where: { id: allocation.stockSizeId } });
        const newQuantity = stockSize.quantityAvailable + allocation.piecesNeeded;
        await tx.stockSize.update({
          where: { id: allocation.stockSizeId },
          data: { quantityAvailable: newQuantity },
        });
        await tx.stockTransaction.create({
          data: {
            stockSizeId: allocation.stockSizeId,
            type: StockTransactionType.PROFORMA_RELEASE,
            quantityDelta: allocation.piecesNeeded,
            previousQuantity: stockSize.quantityAvailable,
            newQuantity,
            reason: `Proforma ${proformaId} reopened for editing`,
            referenceProformaId: proformaId,
            userId,
          },
        });
        await tx.proformaStockAllocation.delete({ where: { id: allocation.id } });
      }
    }

    const reopened = await tx.proforma.update({
      where: { id: proformaId },
      data: { status: "DRAFT", finalizedAt: null },
      // number is intentionally left as-is — see docstring above
    });

    await logAudit({
      userId,
      action: "PROFORMA_REOPENED",
      entityType: "Proforma",
      entityId: proformaId,
      oldValue: { status: "FINALIZED" },
      newValue: { status: "DRAFT" },
    });

    return reopened;
  });
}

export async function cancelProforma(proformaId: string, userId: string) {
  const proforma = await prisma.proforma.findUnique({ where: { id: proformaId } });
  if (!proforma) throw new ApiError(404, "Proforma not found.");
  if (proforma.status === "FINALIZED") {
    throw new ApiError(400, "A finalized proforma can't be cancelled here — use a credit note process instead.");
  }
  const updated = await prisma.proforma.update({
    where: { id: proformaId },
    data: { status: "CANCELLED" },
  });
  await logAudit({ userId, action: "PROFORMA_CANCELLED", entityType: "Proforma", entityId: proformaId });
  return updated;
}
