import type { WatchlistEntryV1 } from "./watchlistTypes";
import { saveWatchlistEntry } from "./saveWatchlistEntry";

export async function updateWatchlistEntry(
  entry: WatchlistEntryV1,
  input: {
    isActive?: boolean;
    notes?: string | null;
    tags?: string[];
  }
) {
  const next: WatchlistEntryV1 = {
    ...entry,
    updatedAt: new Date().toISOString(),
    isActive: typeof input.isActive === "boolean" ? input.isActive : entry.isActive,
    notes: input.notes == null ? entry.notes ?? null : String(input.notes || "").trim() || null,
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : entry.tags || [],
  };
  return await saveWatchlistEntry(next);
}
