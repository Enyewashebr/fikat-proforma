import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
} from "../controllers/customers.controller";

const router = Router();

router.use(requireAuth);
router.get("/", listCustomers);
router.get("/:id", getCustomer);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);

export default router;
