import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import {
  addProformaItem,
  removeProformaItem,
  finalizeProforma,
  cancelProforma,
  reopenProforma,
  previewStockCombination,
  setCuttingCharge,
} from "../services/proformaService";
import { streamProformaPdf } from "../services/proformaPdf";

export const listProformas = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const proformas = await prisma.proforma.findMany({
    where: status ? { status: status as never } : undefined,
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(proformas);
});

export const getProforma = asyncHandler(async (req: Request, res: Response) => {
  const proforma = await prisma.proforma.findUnique({
    where: { id: req.params.id },
    include: { customer: true, items: { include: { stockAllocations: true } }, createdBy: true },
  });
  if (!proforma) throw new ApiError(404, "Proforma not found.");
  res.json(proforma);
});

const createSchema = z.object({ customerId: z.string() });

export const createProforma = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = createSchema.parse(req.body);
  if (!req.user) throw new ApiError(401, "Not authenticated.");
  const proforma = await prisma.proforma.create({
    data: { customerId, createdById: req.user.id, status: "DRAFT" },
  });
  res.status(201).json(proforma);
});

const itemSchema = z
  .object({
    materialId: z.string(),
    productTypeId: z.string().nullable().optional(),
    itemLabel: z.string().min(1),
    customerLengthCm: z.number().positive(),
    customerWidthCm: z.number().positive(),
    thickness: z.number().positive(),
    unit: z.string().default("pcs"),
    // Required for PIECE / AREA_PER_PIECE. Ignored (computed) for AREA_TOTAL.
    quantity: z.number().int().min(1).optional(),
    pricingMode: z.enum(["PIECE", "AREA_PER_PIECE", "AREA_TOTAL"]).default("AREA_PER_PIECE"),
    // Required for AREA_TOTAL — total area the customer needs, in m2.
    requestedAreaM2: z.number().positive().optional(),
    // Optional manual price for this line (per m2, or per piece for PIECE
    // mode). If omitted, the backend falls back to the material's
    // configured Price. If provided, it's remembered for next time.
    pricePerM2: z.number().positive().optional(),
  })
  .refine((data) => data.pricingMode === "AREA_TOTAL" || !!data.quantity, {
    message: "Quantity is required for this pricing mode.",
    path: ["quantity"],
  })
  .refine((data) => data.pricingMode !== "AREA_TOTAL" || !!data.requestedAreaM2, {
    message: "Total area needed (m²) is required for this pricing mode.",
    path: ["requestedAreaM2"],
  });

// Adding an item never changes proforma status — it stays editable
// (DRAFT/REVIEW) until POST /:id/finalize is called explicitly.
export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const data = itemSchema.parse(req.body);
  const item = await addProformaItem({
    proformaId: req.params.id,
    materialId: data.materialId,
    productTypeId: data.productTypeId ?? null,
    itemLabel: data.itemLabel,
    customerLengthCm: data.customerLengthCm,
    customerWidthCm: data.customerWidthCm,
    thickness: data.thickness,
    unit: data.unit,
    quantity: data.quantity,
    pricingMode: data.pricingMode,
    requestedAreaM2: data.requestedAreaM2,
    pricePerM2: data.pricePerM2,
  });
  res.status(201).json(item);
});

const cuttingChargeSchema = z.object({ cuttingCharge: z.number().min(0) });

export const updateCuttingCharge = asyncHandler(async (req: Request, res: Response) => {
  const { cuttingCharge } = cuttingChargeSchema.parse(req.body);
  const proforma = await setCuttingCharge(req.params.id, cuttingCharge);
  res.json(proforma);
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  await removeProformaItem(req.params.id, req.params.itemId);
  res.status(204).send();
});

export const previewItemStock = asyncHandler(async (req: Request, res: Response) => {
  const result = await previewStockCombination(req.params.itemId);
  res.json(result);
});

export const finalize = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Not authenticated.");
  const proforma = await finalizeProforma(req.params.id, req.user.id);
  res.json(proforma);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Not authenticated.");
  const proforma = await cancelProforma(req.params.id, req.user.id);
  res.json(proforma);
});

export const reopen = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Not authenticated.");
  const proforma = await reopenProforma(req.params.id, req.user.id);
  res.json(proforma);
});

// PDF is available for any status so a draft can be previewed too, but the
// number only appears once the proforma has actually been finalized.
export const downloadPdf = asyncHandler(async (req: Request, res: Response) => {
  const proforma = await prisma.proforma.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { material: true } }, customer: true },
  });
  if (!proforma) throw new ApiError(404, "Proforma not found.");
  streamProformaPdf(proforma, res);
});
