import crypto from "crypto";
import { createHash } from "crypto";

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashInviteToken(token) };
}

export function resolveFrontendBase() {
  const raw = String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "").trim();
  const fallback =
    process.env.NODE_ENV === "production" ? "https://www.rentchain.ai" : "http://localhost:5173";
  return (raw || fallback).replace(/\/$/, "");
}

export function buildTenantInviteUrl(token: string) {
  return `${resolveFrontendBase()}/verify/${encodeURIComponent(token)}`;
}
