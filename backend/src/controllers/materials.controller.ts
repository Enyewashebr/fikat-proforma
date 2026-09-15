import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

const materialSchema = z.object({
  category: z.enum(["GRANITE", "CERAMIC"]),
  name: z.string().min(1),
  code: z.string().optional(),
});

export const listMaterials = asyncHandler(async (req: Request, res: Response) => {
  const category = req.query.category as "GRANITE" | "CERAMIC" | undefined;
  const materials = await prisma.material.findMany({
    where: { active: true, ...(category ? { category } : {}) },
    include: { productTypes: true, stockSizes: true },
    orderBy: { name: "asc" },
  });
  res.json(materials);
});

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  const data = materialSchema.parse(req.body);
  const material = await prisma.material.create({ data });
  res.status(201).json(material);
});

const productTypeSchema = z.object({ name: z.string().min(1) });

export const addProductType = asyncHandler(async (req: Request, res: Response) => {
  const { name } = productTypeSchema.parse(req.body);
  const material = await prisma.material.findUnique({ where: { id: req.params.materialId } });
  if (!material) throw new ApiError(404, "Material not found.");
  if (material.category !== "GRANITE") {
    throw new ApiError(400, "Product types only apply to granite materials.");
  }
  const productType = await prisma.productType.create({
    data: { materialId: material.id, name },
  });
  res.status(201).json(productType);
});

const stockSizeSchema = z.object({
  productTypeId: z.string().nullable().optional(),
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  thickness: z.number().positive(),
  // Riser piece dimensions for a Thread & Riser set — see schema comment on StockSize.
  secondaryWidthCm: z.number().positive().nullable().optional(),
  secondaryThickness: z.number().positive().nullable().optional(),
  unit: z.string().default("pcs"),
  quantityAvailable: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

export const addStockSize = asyncHandler(async (req: Request, res: Response) => {
  const data = stockSizeSchema.parse(req.body);
  const material = await prisma.material.findUnique({ where: { id: req.params.materialId } });
  if (!material) throw new ApiError(404, "Material not found.");

  const stockSize = await prisma.stockSize.create({
    data: { materialId: material.id, ...data },
  });
  res.status(201).json(stockSize);
});

const priceSchema = z.object({
  materialId: z.string(),
  productTypeId: z.string().nullable().optional(),
  pricePerM2: z.number().positive(),
  currency: z.string().default("ETB"),
});

export const setPrice = asyncHandler(async (req: Request, res: Response) => {
  const data = priceSchema.parse(req.body);
  // Deactivate previous price for the same material/product type, then insert new.
  await prisma.price.updateMany({
    where: { materialId: data.materialId, productTypeId: data.productTypeId ?? null },
    data: { active: false },
  });
  const price = await prisma.price.create({ data: { ...data, active: true } });
  res.status(201).json(price);
});

// The fixed price per m2 the proforma calculator multiplies by billable area
// to get unit price. Listed separately (not nested under /materials) because
// a material can have one price (ceramic) or one price per product type
// (granite) — the frontend matches these by materialId + productTypeId.
export const listPrices = asyncHandler(async (_req: Request, res: Response) => {
  const prices = await prisma.price.findMany({
    where: { active: true },
    orderBy: { effectiveFrom: "desc" },
  });
  res.json(prices);
});
