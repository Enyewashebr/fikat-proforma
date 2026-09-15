import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required."),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string) || "";
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(customers);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { proformas: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) throw new ApiError(404, "Customer not found.");
  res.json(customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({ data });
  res.status(201).json(customer);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const data = customerSchema.partial().parse(req.body);
  const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
  res.json(customer);
});
