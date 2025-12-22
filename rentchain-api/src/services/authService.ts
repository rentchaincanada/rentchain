// src/services/authService.ts
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/authConfig";
import { db } from "../config/firebase";

export interface LandlordUser {
  id: string;
  email: string;
  screeningCredits?: number;
  role?: string;
  landlordId?: string;
  plan?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: "landlord";
  landlordId?: string;
  plan?: string;
}

export async function validateLandlordCredentials(
  email: string,
  password: string
): Promise<LandlordUser | null> {
  const fb = await firebaseSignInWithPassword(email, password);
  console.log("[auth] firebase signInWithPassword result", {
    ok: !!fb,
    email: fb?.email,
  });
  if (!fb) return null;

  const ref = db.collection("landlords").doc(fb.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const createdAt = new Date().toISOString();
    const landlord: LandlordUser = {
      id: fb.uid,
      landlordId: fb.uid,
      email: fb.email,
      role: "landlord",
      plan: "starter",
      screeningCredits: 0,
    };
    await ref.set({ ...landlord, createdAt }, { merge: true });
    return landlord;
  }

  const data = snap.data() as any;
  const landlord: LandlordUser = {
    id: data?.id || fb.uid,
    landlordId: data?.landlordId || fb.uid,
    email: data?.email || fb.email,
    role: data?.role || "landlord",
    plan: data?.plan || "starter",
    screeningCredits: data?.screeningCredits ?? 0,
  };
  return landlord;
}

export function generateJwtForLandlord(
  user: LandlordUser,
  expiresIn?: string
): string {
  const plan = user.plan || "starter";
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: (user.role as any) || "landlord",
    landlordId: user.landlordId || user.id,
    plan,
  };

  return jwt.sign(
    payload,
    JWT_SECRET as jwt.Secret,
    {
      expiresIn: expiresIn || JWT_EXPIRES_IN,
    } as jwt.SignOptions
  );
}

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

async function firebaseSignInWithPassword(
  email: string,
  password: string
): Promise<{ uid: string; email: string } | null> {
  if (!FIREBASE_API_KEY) {
    console.error("[auth] FIREBASE_API_KEY missing");
    return null;
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("[auth] firebase signInWithPassword failed", res.status, err);
    return null;
  }

  const data: any = await res.json();
  return { uid: data.localId, email: data.email };
}
