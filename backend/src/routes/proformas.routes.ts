import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listProformas,
  getProforma,
  createProforma,
  addItem,
  removeItem,
  previewItemStock,
  finalize,
  cancel,
  reopen,
  downloadPdf,
  updateCuttingCharge,
} from "../controllers/proformas.controller";

const router = Router();

router.use(requireAuth);
router.get("/", listProformas);
router.get("/:id", getProforma);
router.get("/:id/pdf", downloadPdf);
router.post("/", requireRole("ADMIN", "MANAGER", "SALES"), createProforma);
router.post("/:id/items", requireRole("ADMIN", "MANAGER", "SALES"), addItem);
router.delete("/:id/items/:itemId", requireRole("ADMIN", "MANAGER", "SALES"), removeItem);
router.get("/items/:itemId/preview-stock", previewItemStock);
// Flat cutting/fabrication fee, entered before finalize — added into the
// subtotal ahead of VAT. Only while the proforma is still editable.
router.put("/:id/cutting-charge", requireRole("ADMIN", "MANAGER", "SALES"), updateCuttingCharge);
router.post("/:id/finalize", requireRole("ADMIN", "MANAGER", "SALES"), finalize);
router.post("/:id/cancel", requireRole("ADMIN", "MANAGER", "SALES"), cancel);
// Reopening a finalized proforma releases its allocated stock back to
// inventory and drops it to DRAFT so it can be edited again — gated to
// ADMIN/MANAGER since it reverses a financial/inventory record.
router.post("/:id/reopen", requireRole("ADMIN", "MANAGER"), reopen);

export default router;
