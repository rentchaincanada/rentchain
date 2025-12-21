// src/services/authService.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  DEMO_LANDLORD,
  DEMO_LANDLORD_EMAIL,
  DEMO_LANDLORD_PASSWORD_HASH,
  JWT_EXPIRES_IN,
  JWT_SECRET,
} from "../config/authConfig";

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
  if (email !== DEMO_LANDLORD_EMAIL) {
    return null;
  }

  const isValid = await bcrypt.compare(password, DEMO_LANDLORD_PASSWORD_HASH);
  if (!isValid) {
    return null;
  }

  return DEMO_LANDLORD;
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
