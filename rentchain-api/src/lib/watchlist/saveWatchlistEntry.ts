import { db } from "../../firebase";
import type { WatchlistEntryV1 } from "./watchlistTypes";
import { ADMIN_WATCHLISTS_COLLECTION } from "./loadWatchlistEntries";

export async function saveWatchlistEntry(entry: WatchlistEntryV1) {
  await db.collection(ADMIN_WATCHLISTS_COLLECTION).doc(entry.id).set(entry, { merge: false });
  return entry;
}
