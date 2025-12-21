import express from "express";

const router = express.Router();

router.get("/", async (req: any, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({
    landlordId: req.user?.landlordId || req.user?.id,
    email: req.user?.email,
    role: req.user?.role,
    plan: req.user?.plan || "starter",
  });
});

export default router;
