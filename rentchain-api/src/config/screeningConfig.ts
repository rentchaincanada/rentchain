import dotenv from "dotenv";

dotenv.config();

const DEFAULT_SCREENING_PRICE_CENTS = 1999;
const DEFAULT_SCREENING_CURRENCY = "cad";
const DEFAULT_FRONTEND_URL = "http://localhost:5173";

const RAW_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const RAW_FRONTEND_URL = process.env.FRONTEND_URL || "";
const RAW_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export const STRIPE_SECRET_KEY: string = RAW_STRIPE_SECRET_KEY;
export const STRIPE_SECRET_CONFIGURED = !!RAW_STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET: string = RAW_WEBHOOK_SECRET;
export const STRIPE_WEBHOOK_CONFIGURED = !!RAW_WEBHOOK_SECRET;
export const FRONTEND_URL: string =
  RAW_FRONTEND_URL || DEFAULT_FRONTEND_URL;
export const FRONTEND_URL_CONFIGURED = !!RAW_FRONTEND_URL;

export const SCREENING_PRICE_CENTS: number = Number(
  process.env.SCREENING_PRICE_CENTS || DEFAULT_SCREENING_PRICE_CENTS
);

export const SCREENING_CURRENCY: string =
  process.env.SCREENING_CURRENCY || DEFAULT_SCREENING_CURRENCY;
