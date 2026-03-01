const DEFAULT_SAMPLE_RATE = 0;
const DEFAULT_TIMEOUT_MS = 600;

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_SAMPLE_RATE;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const parseNumber = (raw: unknown, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fnv1a32 = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export function isShadowModeEnabled(): boolean {
  return String(import.meta.env.VITE_BUREAU_ADAPTER_SHADOW_MODE || "false")
    .trim()
    .toLowerCase() === "true";
}

export function getShadowSampleRate(): number {
  return clamp01(parseNumber(import.meta.env.VITE_BUREAU_ADAPTER_SHADOW_SAMPLE_RATE, DEFAULT_SAMPLE_RATE));
}

export function getShadowTimeoutMs(): number {
  const value = parseNumber(import.meta.env.VITE_BUREAU_ADAPTER_SHADOW_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.round(value);
}

export function shouldShadowRun(seedKey: string): boolean {
  if (!isShadowModeEnabled()) return false;
  const sampleRate = getShadowSampleRate();
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  const normalizedSeed = String(seedKey || "global");
  const bucket = fnv1a32(normalizedSeed) / 0xffffffff;
  return bucket <= sampleRate;
}

export function redactSeed(seedKey: string): string {
  return fnv1a32(String(seedKey || "global")).toString(16).padStart(8, "0");
}
