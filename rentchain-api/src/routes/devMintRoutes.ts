import { Router } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/authConfig";
import { db } from "../config/firebase";

const router = Router();

router.post("/mint-tenant-token", async (req, res) => {
  if (process.env.DEV_TOKEN_MINT_ENABLED !== "true") {
    return res.status(404).json({ error: "Not found" });
  }

  const headerSecret = req.header("x-dev-mint-secret");
  if (!headerSecret || headerSecret !== process.env.DEV_MINT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { tenantId, email } = req.body || {};
  if (!tenantId) {
    return res.status(400).json({ error: "tenantId required" });
  }

  // Optional existence check (best-effort)
  try {
    const snap = await db.collection("tenants").doc(String(tenantId)).get();
    if (!snap.exists) {
      // Allow minting even if doc missing (pilot flexibility), but signal warning
      console.warn("[dev mint] tenant doc not found for", tenantId);
    }
  } catch (err) {
    console.warn("[dev mint] tenant existence check failed", err);
  }

  const payload: any = {
    sub: String(tenantId),
    role: "tenant",
    tenantId: String(tenantId),
  };
  if (email) payload.email = String(email);

  const secret: Secret = JWT_SECRET;
  const expiresIn = (JWT_EXPIRES_IN as SignOptions["expiresIn"]) || "2h";
  const token = jwt.sign(payload, secret, { expiresIn });
  return res.json({ ok: true, token });
});

export default router;
