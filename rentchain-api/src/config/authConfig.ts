// src/config/authConfig.ts
import dotenv from "dotenv";

dotenv.config();

export const DEMO_LANDLORD_EMAIL = "demo@rentchain.dev";
export const DEMO_LANDLORD_PASSWORD_HASH =
  "$2a$10$U0BwAWPG66gvdxsBmR8tX.UiTp.IF4RpK8Xd3QSLlHvaBPW5OaCaq";

export const JWT_SECRET: string =
  process.env.JWT_SECRET || "rentchain-dev-jwt-secret";

export const JWT_EXPIRES_IN: string = "2h";

export interface DemoLandlord {
  id: string;
  email: string;
}

export const DEMO_LANDLORD: DemoLandlord = {
  id: "landlord-demo",
  email: DEMO_LANDLORD_EMAIL,
};
