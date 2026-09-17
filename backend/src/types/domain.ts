// Single source of truth for cross-cutting domain shapes used by the
// calculation/optimization services and the API responses. The frontend
// mirrors these in frontend/src/types/domain.ts — keep the two in sync.
// (This exists specifically to avoid the "StockCombination defined three
// different ways in three different files" bug from the original prototype.)

export type MaterialCategory = "GRANITE" | "CERAMIC";

export interface StockSizeDTO {
  id: string;
  materialId: string;
  productTypeId: string | null;
  lengthCm: number;
  widthCm: number;
  thickness: number;
  /** Riser piece dimensions when this stock is a Thread & Riser set — see schema comment. */
  secondaryWidthCm?: number | null;
  secondaryThickness?: number | null;
  unit: string;
  quantityAvailable: number;
  quantityReserved: number;
  lowStockThreshold: number;
  /** Per-piece/per-set price for PIECE-priced applications (Thread & Riser). Null otherwise. */
  pricePerUnit?: number | null;
}

/** One requirement the optimizer needs to satisfy for a single proforma row. */
export interface StockRequirement {
  lengthCm: number;
  widthCm: number;
  quantity: number;
}

/**
 * Which of the two optimization modes produced a given result. These are
 * deliberately different operations and must never be blended:
 *
 *   CUT      — one stock piece is cut into one or more identical customer
 *              pieces (e.g. a 140cm stock piece yields two 67cm pieces plus
 *              6cm of waste). Used when the customer length fits inside a
 *              single available stock piece.
 *
 *   ASSEMBLE — several whole stock pieces are placed end-to-end to reach one
 *              long customer length (e.g. 200cm + 220cm covers a 405cm
 *              requirement). Used when no single stock piece is long enough.
 *
 * Waste produced by a CUT is never reused as ASSEMBLE material, and an
 * ASSEMBLE combination is never "topped up" with another unit's leftover.
 */
export type OptimizationMode = "CUT" | "ASSEMBLE";

/**
 * The canonical "how do we cover this requirement out of available stock"
 * result, one entry per stock size involved. ONE definition, used by
 * stockOptimizer, proformaService, the controllers, and mirrored on the
 * frontend for display. Do not redeclare this shape anywhere else.
 */
export interface StockCombination {
  stockSizeId: string;
  stockSizeLabel: string; // e.g. "220 x 34 x 1.5 cm"
  stockLengthCm: number;
  stockWidthCm: number;

  /** Physical stock pieces of this size consumed. */
  stockPiecesUsed: number;

  /**
   * Finished customer pieces this stock size contributes.
   * CUT mode: pieces actually cut from these stockPiecesUsed.
   * ASSEMBLE mode: equals the requirement quantity (every stock size in the
   * combination contributes to every assembled customer unit).
   */
  customerPiecesProduced: number;

  /** Total waste length across stockPiecesUsed pieces of this size. */
  wasteLengthCm: number;
  totalStockArea: number; // m2, across stockPiecesUsed
  totalWasteArea: number; // m2
}

export interface OptimizationResult {
  feasible: boolean;
  mode: OptimizationMode;
  combination: StockCombination[];

  totalCustomerPiecesRequested: number;
  totalCustomerPiecesProduced: number;
  totalStockPiecesUsed: number;
  totalWasteLengthCm: number;

  /** Present only when feasible is false. */
  shortfall?: {
    requestedPieces: number;
    producedPieces: number;
    shortagePieces: number;
  };
}

export interface ProformaItemCalculation {
  billableAreaM2: number;
  unitPrice: number;
  totalPrice: number;
}
