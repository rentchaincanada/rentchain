import { createHash } from "crypto";

const DEFAULT_PRIMARY_TIMEOUT_MS = 2000;

function toBool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashSeedKey(seedKey: string): string {
  return sha256Hex(String(seedKey || ""));
}

export function isPrimaryModeEnabled(): boolean {
  return toBool(process.env.BUREAU_ADAPTER_PRIMARY_MODE, false);
}

export function getPrimarySampleRate(): number {
  return clamp01(toNumber(process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE, 0));
}

export function getPrimaryTimeoutMs(): number {
  return Math.max(100, Math.floor(toNumber(process.env.BUREAU_ADAPTER_PRIMARY_TIMEOUT_MS, DEFAULT_PRIMARY_TIMEOUT_MS)));
}

export function isFallbackEnabled(): boolean {
  return toBool(process.env.BUREAU_ADAPTER_FALLBACK_ENABLED, true);
}

// Allowlist supports exact stable internal IDs or hashed forms: "<sha256>" or "sha256:<sha256>"
export function parseAllowlist(): Set<string> {
  const raw = String(process.env.BUREAU_ADAPTER_PRIMARY_ALLOWLIST || "");
  if (!raw.trim()) return new Set<string>();
  const values = raw
    .split(",")
    .map((part) => normalizeKey(part))
    .filter(Boolean);
  return new Set(values);
}

function isAllowlisted(seedKey: string, allowlist: Set<string>): boolean {
  if (!seedKey || allowlist.size === 0) return false;
  const normalizedSeed = normalizeKey(seedKey);
  if (allowlist.has(normalizedSeed)) return true;

  const hash = hashSeedKey(seedKey);
  if (allowlist.has(hash)) return true;
  if (allowlist.has(`sha256:${hash}`)) return true;
  return false;
}

export function isAllowlistedSeed(seedKey: string, allowlist?: Set<string>): boolean {
  const source = allowlist || parseAllowlist();
  return isAllowlisted(seedKey, source);
}

function ratioFromHash(seedKey: string): number {
  const hash = hashSeedKey(seedKey);
  const firstEightHex = hash.slice(0, 8);
  const value = Number.parseInt(firstEightHex, 16);
  if (!Number.isFinite(value)) return 0;
  return value / 0xffffffff;
}

export function shouldUseAdapterPrimary(seedKey: string): boolean {
  if (!isPrimaryModeEnabled()) return false;

  const allowlist = parseAllowlist();
  if (isAllowlisted(seedKey, allowlist)) return true;

  const sampleRate = getPrimarySampleRate();
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;

  return ratioFromHash(seedKey) < sampleRate;
}
