import { Router } from "express";
import jwt from "jsonwebtoken";
import { DEMO_LANDLORD, DEMO_LANDLORD_EMAIL } from "../config/authConfig";

const router = Router();

router.get("/ping", (_req, res) => res.json({ ok: true, dev: true }));

router.post("/auth/token", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[dev-auth] JWT_SECRET missing");
    return res.status(500).json({ error: "JWT_SECRET not configured" });
  }

  const email = String(req.body?.email ?? DEMO_LANDLORD_EMAIL);
  const role = String(req.body?.role ?? "landlord");
  const sub = String(req.body?.sub ?? DEMO_LANDLORD.id);
  const landlordId = String(req.body?.landlordId ?? sub);
  const plan = String(req.body?.plan ?? "screening");

  const token = jwt.sign({ sub, email, role, landlordId, plan }, secret, {
    expiresIn: "24h",
  });

  res.json({ token, user: { sub, email, role, landlordId, plan } });
});

export default router;
