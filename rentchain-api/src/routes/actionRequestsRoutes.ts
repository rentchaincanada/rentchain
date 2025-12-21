import express from "express";

const router = express.Router();

router.get("/", async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const { propertyId } = req.query as { propertyId?: string };

  res.json({
    items: [],
    propertyId: propertyId || null,
    landlordId,
  });
});

export default router;
