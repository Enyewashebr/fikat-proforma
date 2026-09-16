import { ProformaItemCalculation } from "../types/domain";

/**
 * All proforma money math lives here, server-side, on purpose — the
 * frontend never computes a total it then trusts.
 *
 * Three pricing modes, chosen per row based on what's actually sold:
 *
 * PIECE — e.g. Thread & Riser sets, sold and priced per piece regardless of
 * area. total = pricePerPiece x quantity. Length/width are still recorded
 * (needed for the stock optimizer's cutting/substitution logic) but do not
 * factor into the price.
 *
 * AREA_PER_PIECE — the default for most granite applications (Window Sill,
 * Doorsill, Landing, Kitchen Top): each piece is cut to the customer's own
 * length x width, and billed by area x quantity of pieces.
 *   billable area (m2) = customer length (m) x customer width (m)
 *   unit price          = billable area x seller price-per-m2
 *   total price          = unit price x quantity
 *
 * AREA_TOTAL — ceramic tiles (and anything else sold by the square meter
 * rather than cut to size): the customer states a total area needed, not a
 * per-piece length/width. total = pricePerM2 x requestedAreaM2. The number
 * of physical tiles needed is derived separately (see proformaService) from
 * the selected stock tile's own area, purely for inventory purposes — it
 * never affects the price.
 */

export function calculatePieceItem(pricePerPiece: number, quantity: number): ProformaItemCalculation {
  return {
    billableAreaM2: 0, // not used for pricing; length/width are stored separately for the optimizer
    unitPrice: round2(pricePerPiece),
    totalPrice: round2(pricePerPiece * quantity),
  };
}

export function calculateAreaPerPieceItem(
  customerLengthCm: number,
  customerWidthCm: number,
  quantity: number,
  pricePerM2: number
): ProformaItemCalculation {
  const lengthM = customerLengthCm / 100;
  const widthM = customerWidthCm / 100;
  const billableAreaM2 = round2(lengthM * widthM);
  const unitPrice = round2(billableAreaM2 * pricePerM2);
  const totalPrice = round2(unitPrice * quantity);

  return { billableAreaM2, unitPrice, totalPrice };
}

export function calculateAreaTotalItem(
  requestedAreaM2: number,
  pricePerM2: number
): ProformaItemCalculation {
  return {
    billableAreaM2: round2(requestedAreaM2),
    unitPrice: round2(pricePerM2),
    totalPrice: round2(pricePerM2 * requestedAreaM2),
  };
}

/** How many whole tiles/pieces of `tileLengthCm x tileWidthCm` are needed to cover `requestedAreaM2`. */
export function piecesNeededForArea(
  requestedAreaM2: number,
  tileLengthCm: number,
  tileWidthCm: number
): number {
  const tileAreaM2 = (tileLengthCm / 100) * (tileWidthCm / 100);
  if (tileAreaM2 <= 0) return 0;
  return Math.ceil(requestedAreaM2 / tileAreaM2);
}

export function calculateProformaTotals(
  items: { totalPrice: number }[],
  cuttingCharge: number,
  vatRate: number
): { subtotal: number; vatAmount: number; grandTotal: number } {
  const itemsSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const subtotal = round2(itemsSubtotal + cuttingCharge);
  // VAT applies to the goods (items) only — the cutting/fabrication charge
  // is not subject to VAT, so it's deliberately excluded here even though
  // it's included in the displayed "Subtotal" above.
  const vatAmount = round2(itemsSubtotal * vatRate);
  const grandTotal = round2(subtotal + vatAmount);
  return { subtotal, vatAmount, grandTotal };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
