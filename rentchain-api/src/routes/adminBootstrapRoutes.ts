import { Router } from "express";
import { db } from "../config/firebase";
import { signInWithPassword } from "../services/authService";

const router = Router();
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

async function firebaseSignUp(email: string, password: string) {
  if (!FIREBASE_API_KEY) return { ok: false, error: "FIREBASE_API_KEY missing" };
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text };
  }
  const data: any = await res.json();
  return { ok: true, uid: data.localId as string };
}

router.post("/bootstrap-landlord", async (req, res) => {
  const key = String(req.headers["x-admin-key"] || "");
  if (key !== process.env.ADMIN_BOOTSTRAP_KEY) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const plan = String(req.body?.plan || "starter");

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email+password required" });
  }

  let uid: string | null = null;
  let created = false;

  // Try to sign up; if already exists, fall back to sign-in to validate password.
  const signup = await firebaseSignUp(email, password);
  if (signup.ok && signup.uid) {
    uid = signup.uid;
    created = true;
  } else if (String(signup.error || "").includes("EMAIL_EXISTS")) {
    const existing = await signInWithPassword(email, password);
    if (!existing) {
      return res.status(409).json({ ok: false, error: "Email exists but password invalid" });
    }
    uid = existing.uid;
  } else if (!signup.ok) {
    return res.status(500).json({ ok: false, error: signup.error || "Signup failed" });
  }

  if (!uid) {
    return res.status(500).json({ ok: false, error: "Could not resolve uid" });
  }

  const landlordDoc = db.collection("landlords").doc(uid);
  await landlordDoc.set(
    {
      id: uid,
      landlordId: uid,
      email,
      role: "landlord",
      plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      screeningCredits: 0,
    },
    { merge: true }
  );

  return res.json({ ok: true, landlordId: uid, created, plan });
});

export default router;
