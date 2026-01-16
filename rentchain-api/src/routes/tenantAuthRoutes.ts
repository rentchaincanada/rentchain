import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { db } from "../config/firebase";
import { JWT_SECRET } from "../config/authConfig";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const snap = await db.collection("tenants").where("email", "==", String(email)).limit(1).get();
    if (snap.empty) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const doc = snap.docs[0];
    const tenant = doc.data() as any;
    const tenantId = doc.id;

    if (tenant.status && tenant.status !== "active") {
      return res.status(403).json({ error: "Account inactive" });
    }

    const hash = tenant.passwordHash;
    const ok = hash ? await bcrypt.compare(String(password), String(hash)) : false;
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload = {
      sub: tenantId,
      role: "tenant",
      tenantId,
      email: tenant.email || email,
    };
    const secret: Secret = JWT_SECRET;
    const expiresIn: SignOptions["expiresIn"] = "7d";
    const token = jwt.sign(payload, secret, { expiresIn });

    return res.json({ ok: true, token });
  } catch (err) {
    console.error("[tenant auth] login error", err);
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", (_req, res) => {
  return res.json({ ok: true });
});

export default router;
