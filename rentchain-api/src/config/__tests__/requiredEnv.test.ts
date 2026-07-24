import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRequiredEnv, getEnvFlags } from "../requiredEnv";

const ENV_BACKUP = { ...process.env };

function resetEnv() {
  process.env = { ...ENV_BACKUP };
}

function setCommonRequiredEnv() {
  process.env.NODE_ENV = "production";
  process.env.APP_ENV = "production";
  process.env.GOOGLE_CLOUD_PROJECT = "project-0d9658de-af29-4dc0-a99";
  process.env.JWT_SECRET = "test_jwt";
  process.env.PUBLIC_APP_URL = "https://app.example.com";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.INTERNAL_JOB_TOKEN = "internal_token";
  process.env.FIREBASE_API_KEY = "firebase_test";
  process.env.STRIPE_PRICE_STARTER_MONTHLY_LIVE = "price_starter";
  process.env.STRIPE_PRICE_PRO_MONTHLY_LIVE = "price_pro";
  process.env.STRIPE_PRICE_ELITE_MONTHLY_LIVE = "price_elite";
  process.env.EMAIL_REPLY_TO = "dev@rentchain.local";
  process.env.MAINTENANCE_NOTIFY_EMAIL = "dev@rentchain.local";
  process.env.VERIFIED_SCREENING_NOTIFY_EMAIL = "dev@rentchain.local";
  process.env.ADMIN_EMAILS = "dev@rentchain.local";
  process.env.AUTH_BOOTSTRAP_TOKEN = "local_dev_bootstrap_token";
  process.env.AUTH_LOGIN_ENABLED = "true";
  process.env.PASSWORD_LOGIN_ENABLED = "true";
}

describe("requiredEnv provider-aware email requirements", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetEnv();
  });

  it("fails closed in production when hard requirements are missing", () => {
    process.env = {
      ...ENV_BACKUP,
      NODE_ENV: "production",
      APP_ENV: "production",
      GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      ALLOW_LOCAL_PROD_FIRESTORE: "false",
    };

    expect(() => assertRequiredEnv()).toThrow(/\[boot\] missing required env vars:/);
  });

  it("warns but continues outside production when hard and recommended requirements are missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env = {
      ...ENV_BACKUP,
      NODE_ENV: "development",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      ALLOW_LOCAL_PROD_FIRESTORE: "false",
    };

    expect(() => assertRequiredEnv()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[boot] missing required env vars:"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[boot] missing recommended env vars:"));
  });

  it("accepts completed local template placeholders without startup warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env = {
      ...ENV_BACKUP,
      NODE_ENV: "development",
      APP_BASE_URL: "http://localhost:3000",
      FRONTEND_URL: "http://localhost:5173",
      PUBLIC_APP_URL: "http://localhost:5173",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      ALLOW_LOCAL_PROD_FIRESTORE: "false",
      JWT_SECRET: "local_dev_jwt_secret",
      STRIPE_SECRET_KEY: "sk_test_local_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_local_placeholder",
      INTERNAL_JOB_TOKEN: "local_dev_internal_job_token",
      FIREBASE_API_KEY: "local_dev_firebase_api_key",
      STRIPE_PRICE_STARTER_MONTHLY_LIVE: "price_local_starter",
      STRIPE_PRICE_PRO_MONTHLY_LIVE: "price_local_pro",
      STRIPE_PRICE_ELITE_MONTHLY_LIVE: "price_local_elite",
      EMAIL_PROVIDER: "sendgrid",
      SENDGRID_API_KEY: "sg_local_placeholder",
      SENDGRID_FROM_EMAIL: "dev@rentchain.local",
      EMAIL_REPLY_TO: "dev@rentchain.local",
      MAINTENANCE_NOTIFY_EMAIL: "dev@rentchain.local",
      VERIFIED_SCREENING_NOTIFY_EMAIL: "dev@rentchain.local",
      ADMIN_EMAILS: "dev@rentchain.local",
      AUTH_BOOTSTRAP_TOKEN: "local_dev_bootstrap_token",
      AUTH_LOGIN_ENABLED: "true",
      PASSWORD_LOGIN_ENABLED: "true",
    };

    expect(() => assertRequiredEnv()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("passes for mailgun with mailgun env only and no sendgrid env", () => {
    setCommonRequiredEnv();
    process.env.EMAIL_PROVIDER = "mailgun";
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.EMAIL_FROM = "no-reply@example.com";
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;

    expect(() => assertRequiredEnv()).not.toThrow();
    const flags = getEnvFlags();
    expect(flags.emailProvider).toBe("mailgun");
    expect(flags.mailgunConfigured).toBe(true);
    expect(flags.sendgridConfigured).toBe(false);
    expect(flags.emailConfigured).toBe(true);
  });

  it("passes for sendgrid with sendgrid env", () => {
    setCommonRequiredEnv();
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "sg_test";
    process.env.SENDGRID_FROM_EMAIL = "no-reply@example.com";
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    delete process.env.EMAIL_FROM;

    expect(() => assertRequiredEnv()).not.toThrow();
    const flags = getEnvFlags();
    expect(flags.emailProvider).toBe("sendgrid");
    expect(flags.sendgridConfigured).toBe(true);
    expect(flags.mailgunConfigured).toBe(false);
    expect(flags.emailConfigured).toBe(true);
  });

  it("defaults to sendgrid when provider is unset", () => {
    setCommonRequiredEnv();
    delete process.env.EMAIL_PROVIDER;
    process.env.SENDGRID_API_KEY = "sg_test";
    process.env.SENDGRID_FROM_EMAIL = "no-reply@example.com";
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    delete process.env.EMAIL_FROM;

    expect(() => assertRequiredEnv()).not.toThrow();
    const flags = getEnvFlags();
    expect(flags.emailProvider).toBe("sendgrid");
    expect(flags.emailConfigured).toBe(true);
  });
});
