import { isMicroLiveEnabledForLandlord } from "../services/microLive";

export async function requireMicroLiveAccess(req: any, res: any, next: any) {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

    const ok = await isMicroLiveEnabledForLandlord(landlordId);
    if (!ok) return res.status(403).json({ error: "Micro-Live access not enabled" });

    return next();
  } catch (e: any) {
    console.error("[requireMicroLiveAccess] error", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
}
