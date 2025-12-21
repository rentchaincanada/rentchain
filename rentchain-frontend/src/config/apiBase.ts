const fromEnv =
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "";

const devFallback = "http://localhost:3000";

export const API_BASE = String(
  fromEnv || (import.meta.env.DEV ? devFallback : "")
).replace(/\/$/, "");

let warnedMissingApiBase = false;
if (!API_BASE && !import.meta.env.DEV && !warnedMissingApiBase) {
  console.warn(
    "[RentChain] API_BASE not set in production. Set VITE_API_URL to your API origin."
  );
  warnedMissingApiBase = true;
}

export const API_BASE_URL = API_BASE ? `${API_BASE}/api` : "";
