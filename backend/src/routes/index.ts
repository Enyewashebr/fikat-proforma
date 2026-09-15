import { Router } from "express";
import authRoutes from "./auth.routes";
import customerRoutes from "./customers.routes";
import materialRoutes from "./materials.routes";
import stockRoutes from "./stock.routes";
import proformaRoutes from "./proformas.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/materials", materialRoutes);
router.use("/stock", stockRoutes);
router.use("/proformas", proformaRoutes);

export default router;
