import { getApiBaseUrl } from "../getApiBaseUrl.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  let upstream = "";
  try {
    upstream = getApiBaseUrl();
  } catch (err: any) {
    console.error("[vercel] missing api base", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: "API_BASE_URL_MISSING", detail: String(err?.message || err) });
  }

  const auth = req.headers.authorization || req.headers.Authorization;
  const bodyObj = typeof req.body === "string" ? safeParse(req.body) : req.body || {};

  try {
    const resp = await fetch(`${upstream.replace(/\/$/, "")}/api/landlord/application-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth as string } : {}),
      },
      body: JSON.stringify(bodyObj),
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    res.status(resp.status).json(data);
  } catch (err: any) {
    console.error("[vercel] application-links proxy failed", err?.message || err);
    return res
      .status(502)
      .json({ ok: false, error: "APPLICATION_LINK_PROXY_FAILED", detail: String(err?.message || err) });
  }
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
