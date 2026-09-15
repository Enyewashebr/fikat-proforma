// Mirrors backend/prisma/seed.ts. Kept as plain data so the "Add stock size"
// dropdown offers the same standard sizes the seed generates. If you change
// the ranges here, update the seed script to match (or vice versa).

export const GRANITE_MATERIAL_SUGGESTIONS = [
  "603",
  "602",
  "651",
  "654",
  "G-640",
  "Galaxy",
  "Juprana",
  "Marquino",
];

export const CERAMIC_MATERIAL_SUGGESTIONS = [
  "GLM Polished White",
  "Mosic White",
  "Satin Grey",
  "Satinlux",
  "Satin Negro",
  "Aquwa Green",
  "White Rabit",
  "Satin White",
  "Rock Otwa",
  "Ivnone Bone",
];

export const GRANITE_PRODUCT_TYPES = [
  "Thread & Riser",
  "Window Sill",
  "Doorsill",
  "Landing",
  "Kitchen Top",
];

export interface StandardSize {
  lengthCm: number;
  widthCm: number;
  thickness: number;
  /**
   * Thread & Riser only: the riser piece sold as part of the same set at the
   * same length (e.g. thread 34cm/3cm + riser 15cm/2cm). Leave undefined for
   * every other application/ceramic product — those are a single physical size.
   */
  secondaryWidthCm?: number;
  secondaryThickness?: number;
}

const STANDARD_LENGTHS_CM = [120, 125, 140, 150, 160, 180, 200, 220];

const THREAD_RISER_SIZES: StandardSize[] = STANDARD_LENGTHS_CM.map((lengthCm) => ({
  lengthCm,
  widthCm: 34, // thread
  thickness: 3,
  secondaryWidthCm: 15, // riser — same length, sold together as one set
  secondaryThickness: 2,
}));

const WINDOW_SILL_WIDTHS = [20, 25, 28, 30];
const WINDOW_SILL_SIZES: StandardSize[] = STANDARD_LENGTHS_CM.flatMap((lengthCm) =>
  WINDOW_SILL_WIDTHS.map((widthCm) => ({ lengthCm, widthCm, thickness: 3 }))
);

// Doorsill uses a different width set than Window Sill — do not merge them.
const DOORSILL_WIDTHS = [15, 20, 25, 30];
const DOORSILL_SIZES: StandardSize[] = STANDARD_LENGTHS_CM.flatMap((lengthCm) =>
  DOORSILL_WIDTHS.map((widthCm) => ({ lengthCm, widthCm, thickness: 3 }))
);

const LANDING_SIZES: StandardSize[] = [
  { lengthCm: 40, widthCm: 40, thickness: 2 },
  { lengthCm: 60, widthCm: 60, thickness: 2 },
];

const KITCHEN_TOP_SIZES: StandardSize[] = [
  { lengthCm: 220, widthCm: 63, thickness: 2 },
  { lengthCm: 240, widthCm: 63, thickness: 2 },
  { lengthCm: 260, widthCm: 70, thickness: 2 },
];

const CERAMIC_COMMON_SIZES: StandardSize[] = [
  { lengthCm: 120, widthCm: 60, thickness: 0.9 },
  { lengthCm: 60, widthCm: 60, thickness: 0.9 },
  { lengthCm: 60, widthCm: 60, thickness: 1.5 },
  { lengthCm: 80, widthCm: 80, thickness: 0.1 },
  { lengthCm: 30, widthCm: 60, thickness: 0.9 },
  { lengthCm: 40, widthCm: 80, thickness: 0.1 },
];

/** Standard sizes for a granite application (product type name). Empty array = no preset list, use custom entry. */
export function getStandardSizesForProductType(productTypeName: string): StandardSize[] {
  switch (productTypeName) {
    case "Thread & Riser":
      return THREAD_RISER_SIZES;
    case "Window Sill":
      return WINDOW_SILL_SIZES;
    case "Doorsill":
      return DOORSILL_SIZES;
    case "Landing":
      return LANDING_SIZES;
    case "Kitchen Top":
      return KITCHEN_TOP_SIZES;
    default:
      return [];
  }
}

export function getStandardCeramicSizes(): StandardSize[] {
  return CERAMIC_COMMON_SIZES;
}

/** Shared label formatter — also used for real StockSize records from the API (same field names). */
export function formatSize(size: {
  lengthCm: number;
  widthCm: number;
  thickness: number;
  secondaryWidthCm?: number | null;
  secondaryThickness?: number | null;
}): string {
  if (size.secondaryWidthCm != null && size.secondaryThickness != null) {
    // Thread & Riser set notation: length, thread width/riser width, thread thickness/riser thickness.
    return `${size.lengthCm} × ${size.widthCm}/${size.secondaryWidthCm} × ${size.thickness}/${size.secondaryThickness} cm (set)`;
  }
  return `${size.lengthCm} × ${size.widthCm} × ${size.thickness} cm`;
}
