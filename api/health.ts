import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const upstream = "https://rentchain-landlord-api-915921057662.us-central1.run.app/health";
    const r = await fetch(upstream, { headers: { accept: "application/json" } });
    const text = await r.text();
    res.status(r.status).setHeader("content-type", r.headers.get("content-type") ?? "application/json");
    return res.send(text);
  } catch (e: any) {
    return res.status(502).json({ ok: false, error: "health_proxy_failed", detail: String(e?.message ?? e) });
  }
}
