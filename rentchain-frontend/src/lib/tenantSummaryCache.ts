import { apiFetch } from '../api/apiFetch';
import type { TenantSummary } from '../api/tenantEvents';

type CacheEntry = {
  summary: TenantSummary | null;
  fetchedAt: number;
};

const CACHE_TTL_MS = 60_000; // 1 minute
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<void>>();

function key(tenantId: string) {
  return tenantId;
}

export function getCachedTenantSummary(tenantId: string): TenantSummary | null | undefined {
  const k = key(tenantId);
  const entry = cache.get(k);
  if (!entry) return undefined;
  // allow stale-but-usable when beyond TTL
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return entry.summary;
  return entry.summary;
}

export function setCachedTenantSummary(tenantId: string, summary: TenantSummary | null) {
  cache.set(key(tenantId), { summary, fetchedAt: Date.now() });
}

export async function hydrateTenantSummariesBatch(tenantIds: string[]) {
  const ids = Array.from(new Set(tenantIds.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!ids.length) return;

  // temporarily disable remote fetch to avoid tenant-summaries 403s; fill cache with nulls
  for (const id of ids) {
    setCachedTenantSummary(id, null);
  }
}

export function scoreDotColor(tier?: string | null) {
  if (tier === 'excellent') return '#16A34A';
  if (tier === 'good') return '#22C55E';
  if (tier === 'watch') return '#F59E0B';
  if (tier === 'risk') return '#DC2626';
  return '#9CA3AF';
}

