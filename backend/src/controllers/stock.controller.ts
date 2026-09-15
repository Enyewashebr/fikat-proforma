import { Request, Response } from "express";
import { z } from "zod";
import { StockTransactionType } from "@prisma/client";
import { adjustStock, getStockHierarchy, getDashboardSummary } from "../services/stockService";
import { asyncHandler } from "../middleware/errorHandler";

export const getHierarchy = asyncHandler(async (req: Request, res: Response) => {
  const category = (req.query.category as "GRANITE" | "CERAMIC") || "GRANITE";
  const hierarchy = await getStockHierarchy(category);
  res.json(hierarchy);
});

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  res.json(summary);
});

const adjustSchema = z.object({
  quantityDelta: z.number().int(),
  type: z.nativeEnum(StockTransactionType).default(StockTransactionType.ADJUSTMENT),
  reason: z.string().optional(),
});

export const adjust = asyncHandler(async (req: Request, res: Response) => {
  const { quantityDelta, type, reason } = adjustSchema.parse(req.body);
  const updated = await adjustStock({
    stockSizeId: req.params.stockSizeId,
    quantityDelta,
    type,
    reason,
    userId: req.user?.id,
  });
  res.json(updated);
});
