// Mirrors backend/src/types/domain.ts — keep these two files in sync.
// This is the ONE definition of these shapes on the frontend; components
// import from here rather than redeclaring StockCombination/ProformaItem etc.

export type MaterialCategory = "GRANITE" | "CERAMIC";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface StockSize {
  id: string;
  lengthCm: number;
  widthCm: number;
  thickness: number;
  /** Riser piece dimensions when this is a Thread & Riser set (see backend schema comment). */
  secondaryWidthCm?: number | null;
  secondaryThickness?: number | null;
  unit: string;
  quantityAvailable: number;
  quantityReserved: number;
  lowStockThreshold: number;
  status: StockStatus;

  /** Per-piece/per-set price for PIECE-priced applications (Thread & Riser). Null otherwise. */
  pricePerUnit?: number | null;
}

export interface ProductType {
  id: string;
  name: string;
  stockSizes: StockSize[];
}

export interface MaterialHierarchy {
  id: string;
  name: string;
  category: MaterialCategory;
  productTypes: ProductType[];
  stockSizes: StockSize[]; // used directly for CERAMIC
}

export interface Material {
  id: string;
  category: MaterialCategory;
  name: string;
  code?: string | null;
  productTypes: ProductType[];
  stockSizes: StockSize[];
}

export interface Price {
  id: string;
  materialId: string;
  productTypeId: string | null;
  pricePerM2: number;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export type ProformaStatus = "DRAFT" | "REVIEW" | "FINALIZED" | "CANCELLED";

export type PricingMode = "PIECE" | "AREA_PER_PIECE" | "AREA_TOTAL";

export interface ProformaItem {
  id: string;
  materialId: string;
  productTypeId: string | null;
  itemLabel: string;
  customerLengthCm: number;
  customerWidthCm: number;
  thickness: number;
  unit: string;
  quantity: number;
  pricingMode: PricingMode;
  requestedAreaM2: number | null;
  pricePerM2: number;
  billableAreaM2: number;
  unitPrice: number;
  totalPrice: number;
  material?: { code: string | null };
}

export interface Proforma {
  id: string;
  number: string | null;
  status: ProformaStatus;
  customerId: string;
  customer?: Customer;
  items: ProformaItem[];
  subtotal: number;
  cuttingCharge: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
}

export type OptimizationMode = "CUT" | "ASSEMBLE";

/** Single canonical shape for "how stock covers a requirement" — mirrors backend/src/types/domain.ts. */
export interface StockCombination {
  stockSizeId: string;
  stockSizeLabel: string;
  stockLengthCm: number;
  stockWidthCm: number;
  stockPiecesUsed: number;
  customerPiecesProduced: number;
  wasteLengthCm: number;
  totalStockArea: number;
  totalWasteArea: number;
}

export interface OptimizationResult {
  feasible: boolean;
  mode: OptimizationMode;
  combination: StockCombination[];
  totalCustomerPiecesRequested: number;
  totalCustomerPiecesProduced: number;
  totalStockPiecesUsed: number;
  totalWasteLengthCm: number;
  shortfall?: { requestedPieces: number; producedPieces: number; shortagePieces: number };
}

export interface DashboardSummary {
  materialTypeCount: number;
  totalPieces: number;
  lowStock: number;
  outOfStock: number;
}

export type UserRole = "ADMIN" | "MANAGER" | "SALES" | "STOREKEEPER";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
