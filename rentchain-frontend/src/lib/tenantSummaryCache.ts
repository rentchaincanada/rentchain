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

  // skip fresh cache
  const need = ids.filter((id) => {
    const entry = cache.get(key(id));
    if (!entry) return true;
    return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
  });

  if (!need.length) return;

  const reqKey = need.slice().sort().join(',');
  if (inflight.has(reqKey)) return inflight.get(reqKey);

  const p = (async () => {
    try {
      const resp = await apiFetch<{ ok: boolean; itemsByTenantId: Record<string, TenantSummary | null> }>(
        "/api/tenant-summaries/batch",
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantIds: need }),
        }
      );

      const items = resp?.itemsByTenantId || {};
      for (const id of need) {
        setCachedTenantSummary(id, items[id] ?? null);
      }
    } finally {
      inflight.delete(reqKey);
    }
  })();

  inflight.set(reqKey, p);
  return p;
}

export function scoreDotColor(tier?: string | null) {
  if (tier === 'excellent') return '#16A34A';
  if (tier === 'good') return '#22C55E';
  if (tier === 'watch') return '#F59E0B';
  if (tier === 'risk') return '#DC2626';
  return '#9CA3AF';
}

