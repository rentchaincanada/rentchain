const envBase = (import.meta as any).env?.VITE_API_BASE?.trim() || "";
const fallbackProd = "https://rentchain-landlord-api-915921057662.us-central1.run.app";
const fallbackDev = "http://localhost:3000";

export const API_BASE = (envBase || (import.meta.env.DEV ? fallbackDev : fallbackProd)).replace(/\/$/, "");

if (import.meta.env.DEV && !envBase) {
  console.warn("[RentChain] VITE_API_BASE not set; defaulting to localhost:3000");
}

export default API_BASE;
