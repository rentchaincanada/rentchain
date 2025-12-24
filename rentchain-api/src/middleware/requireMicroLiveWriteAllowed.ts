import { getWriteAllowlist, isMicroLiveEnabledForLandlord } from "../services/microLive";

function isWriteMethod(method: string) {
  const m = String(method || "").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(m);
}

export async function requireMicroLiveWriteAllowed(req: any, res: any, next: any) {
  try {
    if (!isWriteMethod(req.method)) return next();

    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

    const enabled = await isMicroLiveEnabledForLandlord(landlordId);
    if (!enabled) return res.status(403).json({ error: "Micro-Live access not enabled" });

    const allowlist = getWriteAllowlist();
    const path = String(req.baseUrl || "") + String(req.path || "");
    const allowed = allowlist.some((a) => a && path.startsWith(a));

    if (!allowed) {
      return res.status(403).json({
        error: "Writes disabled during Micro-Live",
        path,
      });
    }

    return next();
  } catch (e: any) {
    console.error("[requireMicroLiveWriteAllowed] error", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
}
