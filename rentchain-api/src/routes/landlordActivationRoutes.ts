import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { getLandlordActivation } from "../services/activation/landlordActivationController";

const router = Router();

router.use(requireLandlord);
router.get("/activation", getLandlordActivation);

export default router;
