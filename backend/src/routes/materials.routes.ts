import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  listMaterials,
  createMaterial,
  addProductType,
  addStockSize,
  setPrice,
  listPrices,
} from "../controllers/materials.controller";

const router = Router();

router.use(requireAuth);
router.get("/", listMaterials);
router.get("/prices", listPrices);
router.post("/", requireRole("ADMIN", "MANAGER"), createMaterial);
router.post("/:materialId/product-types", requireRole("ADMIN", "MANAGER"), addProductType);
router.post("/:materialId/stock-sizes", requireRole("ADMIN", "MANAGER", "STOREKEEPER"), addStockSize);
router.post("/prices", requireRole("ADMIN", "MANAGER"), setPrice);

export default router;
