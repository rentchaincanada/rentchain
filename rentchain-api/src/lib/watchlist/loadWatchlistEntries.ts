import { db } from "../../config/firebase";
import type { WatchlistEntryV1 } from "./watchlistTypes";

export const ADMIN_WATCHLISTS_COLLECTION = "adminWatchlists";

export async function loadWatchlistEntries(): Promise<WatchlistEntryV1[]> {
  const snap = await db.collection(ADMIN_WATCHLISTS_COLLECTION).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as WatchlistEntryV1);
}
