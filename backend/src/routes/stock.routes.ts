import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { getHierarchy, getSummary, adjust } from "../controllers/stock.controller";

const router = Router();

router.use(requireAuth);
router.get("/hierarchy", getHierarchy);
router.get("/summary", getSummary);
router.post("/:stockSizeId/adjust", requireRole("ADMIN", "MANAGER", "STOREKEEPER"), adjust);

export default router;
