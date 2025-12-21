import express from "express";

const router = express.Router();

router.get("/", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const { tenantId, propertyId, limit = "25" } = req.query as any;

  res.json({
    items: [],
    landlordId,
    tenantId: tenantId || null,
    propertyId: propertyId || null,
    limit: Number(limit),
  });
});

export default router;
