import { getApiBaseUrl } from "./getApiBaseUrl.js";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const RESPONSE_HEADERS_TO_FORWARD = [
  "content-type",
  "cache-control",
  "x-route-source",
  "x-landlord-decision-queue-route-version",
];

export default async function handler(req: any, res: any) {
  let upstream = "";
  try {
    upstream = getApiBaseUrl();
  } catch (err: any) {
    console.error("[vercel] missing api proxy base", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "API_PROXY_BASE_MISSING",
      detail: String(err?.message || err),
    });
  }

  const targetUrl = buildUpstreamUrl(req, upstream);
  const headers = forwardRequestHeaders(req.headers || {});
  const body = requestBodyForProxy(req);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method || "GET",
      headers,
      body,
      redirect: "manual",
    });
    const text = await upstreamResponse.text();

    for (const headerName of RESPONSE_HEADERS_TO_FORWARD) {
      const value = upstreamResponse.headers.get(headerName);
      if (value) res.setHeader(headerName, value);
    }
    res.setHeader("x-rentchain-api-proxy", "vercel-catchall");

    return res.status(upstreamResponse.status).send(text);
  } catch (err: any) {
    console.error("[vercel] api proxy failed", { message: err?.message || "failed" });
    return res.status(502).json({ ok: false, error: "API_PROXY_FAILED" });
  }
}

export function buildUpstreamUrl(req: any, upstream: string): string {
  const base = String(upstream || "").trim().replace(/\/$/, "").replace(/\/api$/i, "");
  const requestUrl = typeof req?.url === "string" ? req.url : "";
  const [rawPath, rawQuery = ""] = requestUrl.split("?");
  const path = rawPath.startsWith("/api/")
    ? rawPath
    : `/api/${pathSegments(req).join("/")}`;
  return `${base}${path}${rawQuery ? `?${rawQuery}` : ""}`;
}

function pathSegments(req: any): string[] {
  const rawPath = req?.query?.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  return segments
    .map((segment) => String(segment || "").trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
}

function forwardRequestHeaders(input: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) continue;
    if (Array.isArray(value)) {
      headers[key] = value.join(", ");
    } else if (typeof value === "string") {
      headers[key] = value;
    }
  }
  headers["x-rentchain-api-proxy"] = "vercel-catchall";
  return headers;
}

function requestBodyForProxy(req: any): BodyInit | undefined {
  const method = String(req?.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const body = req?.body;
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer || body instanceof Blob || body instanceof FormData) return body;
  if (ArrayBuffer.isView(body)) return body as BodyInit;

  return JSON.stringify(body);
}
