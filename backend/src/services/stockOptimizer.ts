import {
  OptimizationMode,
  OptimizationResult,
  StockCombination,
  StockRequirement,
  StockSizeDTO,
} from "../types/domain";

/**
 * Stock optimizer — two deliberately separate modes. Do not blend them.
 *
 * CUT MODE (one stock piece -> several identical customer pieces)
 * -----------------------------------------------------------------
 * Used whenever at least one available stock size is long enough to contain
 * the customer's required length on its own. A stock piece can yield more
 * than one customer piece if they physically fit end to end:
 *
 *   customer needs 0.67 m, stock is 1.40 m
 *   floor(1.40 / 0.67) = 2 customer pieces per stock piece
 *   waste per stock piece = 1.40 - (2 x 0.67) = 0.06 m
 *
 * That 0.06 m of waste is NOT reusable. It can never be combined with the
 * next stock piece's leftover to make another customer piece — every
 * finished piece must come from one continuous stock piece.
 *
 * Business preference for which stock size to consume first (see spec):
 * higher yield (more customer pieces per stock piece) wins first; ties are
 * broken by the smaller stock length (less material and waste per piece).
 * This is why, with a 0.67 m requirement, 1.40 m stock (yield 2) is consumed
 * before 1.25 m stock (yield 1) even though 1.25 m is the smaller piece —
 * yield beats raw size. Among equal-yield sizes (1.40 vs 1.60, both yield
 * 2), the smaller one (1.40) goes first.
 *
 * ASSEMBLE MODE (several whole stock pieces -> one long customer piece)
 * -----------------------------------------------------------------
 * Used only when no single stock piece is long enough, e.g. a 4.05 m
 * requirement with stock topping out at 2.50 m. Whole stock pieces are
 * placed end to end (2.00 m + 2.20 m = 4.20 m). This is assembly, not
 * cutting — nothing here is "waste from a cut" being reused.
 *
 * Real production preference is not pure waste minimization: a plan using
 * FEWER stock pieces is preferred even if it leaves a little more excess
 * length, because it's simpler and more practical to fabricate. Only when
 * two plans use the same number of pieces does lower waste win the tie.
 *
 * Inventory availability is a hard constraint in both modes — the optimizer
 * never claims more physical stock than `quantityAvailable` actually holds,
 * and stock is only ever mutated at proforma finalize time, never here.
 */

const MAX_PIECES_PER_ASSEMBLED_UNIT = 4;

function label(s: StockSizeDTO): string {
  return `${s.lengthCm} x ${s.widthCm} x ${s.thickness} cm`;
}

function areaM2(lengthCm: number, widthCm: number): number {
  return (lengthCm / 100) * (widthCm / 100);
}

function emptyInfeasibleResult(mode: OptimizationMode, requestedPieces: number): OptimizationResult {
  return {
    feasible: false,
    mode,
    combination: [],
    totalCustomerPiecesRequested: requestedPieces,
    totalCustomerPiecesProduced: 0,
    totalStockPiecesUsed: 0,
    totalWasteLengthCm: 0,
    shortfall: { requestedPieces, producedPieces: 0, shortagePieces: requestedPieces },
  };
}

// ---------------------------------------------------------------------------
// CUT MODE
// ---------------------------------------------------------------------------

function optimizeCutting(requirement: StockRequirement, candidates: StockSizeDTO[]): OptimizationResult {
  const cuttable = candidates
    .map((s) => ({ stock: s, yieldPerPiece: Math.floor(s.lengthCm / requirement.lengthCm) }))
    .filter((c) => c.yieldPerPiece >= 1 && c.stock.quantityAvailable > 0);

  if (cuttable.length === 0) {
    return emptyInfeasibleResult("CUT", requirement.quantity);
  }

  // Higher yield first (more customer pieces per stock piece = more
  // efficient); among equal yield, smaller stock first (less waste/material).
  cuttable.sort((a, b) => b.yieldPerPiece - a.yieldPerPiece || a.stock.lengthCm - b.stock.lengthCm);

  let remaining = requirement.quantity;
  const combination: StockCombination[] = [];

  for (const { stock, yieldPerPiece } of cuttable) {
    if (remaining <= 0) break;

    const stockPiecesWanted = Math.ceil(remaining / yieldPerPiece);
    const stockPiecesUsed = Math.min(stockPiecesWanted, stock.quantityAvailable);
    if (stockPiecesUsed <= 0) continue;

    const customerPiecesProduced = Math.min(remaining, stockPiecesUsed * yieldPerPiece);
    remaining -= customerPiecesProduced;

    const wastePerStockPiece = stock.lengthCm - yieldPerPiece * requirement.lengthCm;

    combination.push({
      stockSizeId: stock.id,
      stockSizeLabel: label(stock),
      stockLengthCm: stock.lengthCm,
      stockWidthCm: stock.widthCm,
      stockPiecesUsed,
      customerPiecesProduced,
      wasteLengthCm: wastePerStockPiece * stockPiecesUsed,
      totalStockArea: areaM2(stock.lengthCm, stock.widthCm) * stockPiecesUsed,
      totalWasteArea: areaM2(wastePerStockPiece, stock.widthCm) * stockPiecesUsed,
    });
  }

  const totalCustomerPiecesProduced = requirement.quantity - remaining;
  const feasible = remaining <= 0;

  return {
    feasible,
    mode: "CUT",
    combination,
    totalCustomerPiecesRequested: requirement.quantity,
    totalCustomerPiecesProduced,
    totalStockPiecesUsed: combination.reduce((sum, c) => sum + c.stockPiecesUsed, 0),
    totalWasteLengthCm: combination.reduce((sum, c) => sum + c.wasteLengthCm, 0),
    shortfall: feasible
      ? undefined
      : {
          requestedPieces: requirement.quantity,
          producedPieces: totalCustomerPiecesProduced,
          shortagePieces: remaining,
        },
  };
}

// ---------------------------------------------------------------------------
// ASSEMBLE MODE
// ---------------------------------------------------------------------------

/**
 * Finds the best whole-piece combination for ONE assembled customer unit.
 * "Best" = fewest stock pieces first (practical to fabricate), then lowest
 * excess length as a tie-break — deliberately NOT pure waste minimization
 * (see module comment).
 */
function bestAssemblyForOneUnit(
  candidates: StockSizeDTO[],
  targetLengthCm: number
): StockSizeDTO[] | null {
  const sorted = [...candidates].sort((a, b) => b.lengthCm - a.lengthCm);
  let best: { pieces: StockSizeDTO[]; waste: number } | null = null;

  function isBetter(pieceCount: number, waste: number): boolean {
    if (!best) return true;
    if (pieceCount !== best.pieces.length) return pieceCount < best.pieces.length;
    return waste < best.waste;
  }

  function search(depth: number, chosen: StockSizeDTO[], sumLength: number) {
    if (sumLength >= targetLengthCm) {
      const waste = sumLength - targetLengthCm;
      if (isBetter(chosen.length, waste)) best = { pieces: [...chosen], waste };
      return; // covered — adding more pieces would only ever add waste
    }
    if (depth >= MAX_PIECES_PER_ASSEMBLED_UNIT) return;

    for (const candidate of sorted) {
      chosen.push(candidate);
      search(depth + 1, chosen, sumLength + candidate.lengthCm);
      chosen.pop();
    }
  }

  search(0, [], 0);
  return best ? (best as { pieces: StockSizeDTO[]; waste: number }).pieces : null;
}

function optimizeAssembly(requirement: StockRequirement, candidates: StockSizeDTO[]): OptimizationResult {
  const eligible = candidates.filter((s) => s.quantityAvailable > 0);
  const perUnitPieces = bestAssemblyForOneUnit(eligible, requirement.lengthCm);

  if (!perUnitPieces) {
    return emptyInfeasibleResult("ASSEMBLE", requirement.quantity);
  }

  // How many of each stock size does ONE assembled customer unit need?
  const countPerUnit = new Map<string, { stock: StockSizeDTO; count: number }>();
  for (const piece of perUnitPieces) {
    const entry = countPerUnit.get(piece.id);
    if (entry) entry.count += 1;
    else countPerUnit.set(piece.id, { stock: piece, count: 1 });
  }

  // Inventory is a hard constraint: we can only produce as many fully
  // assembled units as the scarcest required stock size allows.
  let unitsProducible = requirement.quantity;
  for (const { stock, count } of countPerUnit.values()) {
    unitsProducible = Math.min(unitsProducible, Math.floor(stock.quantityAvailable / count));
  }
  unitsProducible = Math.max(0, unitsProducible);

  const perUnitLengthTotal = perUnitPieces.reduce((sum, p) => sum + p.lengthCm, 0);
  const wastePerUnit = perUnitLengthTotal - requirement.lengthCm;

  const combination: StockCombination[] = Array.from(countPerUnit.values()).map(({ stock, count }) => ({
    stockSizeId: stock.id,
    stockSizeLabel: label(stock),
    stockLengthCm: stock.lengthCm,
    stockWidthCm: stock.widthCm,
    stockPiecesUsed: count * unitsProducible,
    // Every stock size in an assembled combination contributes to every
    // produced unit — there's no per-size "pieces cut", so we report the
    // units produced here rather than splitting waste per stock size.
    customerPiecesProduced: unitsProducible,
    wasteLengthCm: 0, // waste is reported once at the result level for ASSEMBLE
    totalStockArea: areaM2(stock.lengthCm, stock.widthCm) * count * unitsProducible,
    totalWasteArea: 0,
  }));

  const feasible = unitsProducible >= requirement.quantity;

  return {
    feasible,
    mode: "ASSEMBLE",
    combination,
    totalCustomerPiecesRequested: requirement.quantity,
    totalCustomerPiecesProduced: unitsProducible,
    totalStockPiecesUsed: combination.reduce((sum, c) => sum + c.stockPiecesUsed, 0),
    totalWasteLengthCm: wastePerUnit * unitsProducible,
    shortfall: feasible
      ? undefined
      : {
          requestedPieces: requirement.quantity,
          producedPieces: unitsProducible,
          shortagePieces: requirement.quantity - unitsProducible,
        },
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function optimizeStock(
  requirement: StockRequirement,
  availableStockSizes: StockSizeDTO[]
): OptimizationResult {
  // Width (and, by construction of the caller's query, material/product type
  // and thickness) compatibility is a hard filter before either mode runs.
  const candidates = availableStockSizes.filter((s) => s.widthCm >= requirement.widthCm);

  if (candidates.length === 0) {
    return emptyInfeasibleResult("CUT", requirement.quantity);
  }

  const longestAvailable = Math.max(...candidates.map((s) => s.lengthCm));

  // If any compatible stock piece can contain the whole customer length on
  // its own, this is a cutting problem. Otherwise it must be assembled from
  // multiple whole stock pieces.
  return longestAvailable >= requirement.lengthCm
    ? optimizeCutting(requirement, candidates)
    : optimizeAssembly(requirement, candidates);
}
