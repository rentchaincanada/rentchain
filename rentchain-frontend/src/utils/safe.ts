export const arr = <T>(v: T[] | null | undefined) =>
  Array.isArray(v) ? v : [];

export const num = (v: any, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export const str = (v: any, fallback = "") =>
  typeof v === "string" ? v : fallback;
