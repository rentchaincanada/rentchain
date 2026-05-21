import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isRestrictedLogKey, sanitizeLogPayload } from "../../lib/logging/safeLogger";

const SERVER_ONLY_ENV_NAMES = [
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "INTERNAL_JOB_TOKEN",
  "AUTH_BOOTSTRAP_TOKEN",
  "MAILGUN_API_KEY",
  "SENDGRID_API_KEY",
  "SCREENING_ENCRYPTION_KEY",
  "TRANSUNION_CREDENTIALS_ENCRYPTION_KEY",
  "TU_REFERRAL_SIGNING_SECRET",
  "OPENAI_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
];

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    return [absolute];
  });
}

describe("secret and environment governance", () => {
  it("keeps known server-only env names out of frontend client source", () => {
    const frontendSrc = path.resolve(process.cwd(), "../rentchain-frontend/src");
    const sourceFiles = listSourceFiles(frontendSrc);

    const offenders = sourceFiles.flatMap((file) => {
      const content = fs.readFileSync(file, "utf8");
      return SERVER_ONLY_ENV_NAMES.filter((name) => content.includes(name)).map((name) => ({
        file: path.relative(path.resolve(process.cwd(), ".."), file),
        name,
      }));
    });

    expect(offenders).toEqual([]);
  });

  it("redacts secret and env-like keys without removing safe operational metadata", () => {
    const sanitized = sanitizeLogPayload({
      route: "/api/auth/login",
      requestId: "req-1",
      jwtSecret: "jwt-secret-sensitive",
      stripeSecretKey: "sk_live_sensitive",
      stripeWebhookSecret: "whsec_sensitive",
      internalJobToken: "internal-job-sensitive",
      authBootstrapToken: "bootstrap-sensitive",
      mailgunApiKey: "mailgun-sensitive",
      sendgridApiKey: "sendgrid-sensitive",
      firebaseApiKey: "firebase-sensitive",
      googleApplicationCredentials: "/private/service-account.json",
      transunionCredentialsEncryptionKey: "tu-key-sensitive",
      tuReferralSigningSecret: "tu-signing-sensitive",
    });

    expect(sanitized).toEqual({
      route: "/api/auth/login",
      requestId: "req-1",
    });
  });

  it("classifies secret-like key names as restricted log keys", () => {
    expect(isRestrictedLogKey("jwtSecret")).toBe(true);
    expect(isRestrictedLogKey("stripeSecretKey")).toBe(true);
    expect(isRestrictedLogKey("firebaseApiKey")).toBe(true);
    expect(isRestrictedLogKey("googleApplicationCredentials")).toBe(true);
    expect(isRestrictedLogKey("serviceAccountJson")).toBe(true);
    expect(isRestrictedLogKey("requestId")).toBe(false);
  });
});
