const envBase = (import.meta as any).env?.VITE_API_BASE_URL?.trim() || "";
const legacyBase = (import.meta as any).env?.VITE_API_BASE?.trim() || "";
const fallbackDev = "http://localhost:3000";

const host = (envBase || (import.meta.env.DEV ? legacyBase || fallbackDev : ""))
  .replace(/\/$/, "")
  .replace(/\/api$/i, "");
export const API_BASE = host ? `${host}/api` : "";

if (import.meta.env.DEV && !envBase) {
  console.warn("[RentChain] VITE_API_BASE_URL not set; defaulting to localhost:3000/api");
}
if (import.meta.env.PROD && !envBase) {
  console.error("[RentChain] VITE_API_BASE_URL is required in production.");
}

export default API_BASE;
