import type cors from "cors";

const ALLOWED_ORIGINS = new Set<string>([
  "https://www.rentchain.ai",
  "https://rentchain.ai",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:4174",
  "http://localhost:3000",
]);

const ALLOWED_LOCALHOST_PORTS = new Set<string>(["5173", "4173", "4174", "3000"]);

export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin) return true; // same-origin or non-browser request
  if (ALLOWED_ORIGINS.has(origin)) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost") {
    return ALLOWED_LOCALHOST_PORTS.has(url.port || "80");
  }
  if (hostname.endsWith(".vercel.app")) {
    return true;
  }
  return false;
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = isOriginAllowed(origin);
    callback(null, allowed);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-rc-auth",
    "x-api-client",
    "x-rentchain-apiclient",
    "x-requested-with",
  ],
};
