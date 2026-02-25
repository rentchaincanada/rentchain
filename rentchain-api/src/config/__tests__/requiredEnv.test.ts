import { afterEach, describe, expect, it } from "vitest";
import { assertRequiredEnv, getEnvFlags } from "../requiredEnv";

const ENV_BACKUP = { ...process.env };

function resetEnv() {
  process.env = { ...ENV_BACKUP };
}

function setCommonRequiredEnv() {
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "test_jwt";
  process.env.PUBLIC_APP_URL = "https://app.example.com";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.INTERNAL_JOB_TOKEN = "internal_token";
  process.env.FIREBASE_API_KEY = "firebase_test";
  process.env.STRIPE_PRICE_STARTER_MONTHLY_LIVE = "price_starter";
  process.env.STRIPE_PRICE_PRO_MONTHLY_LIVE = "price_pro";
  process.env.STRIPE_PRICE_BUSINESS_MONTHLY_LIVE = "price_business";
}

describe("requiredEnv provider-aware email requirements", () => {
  afterEach(() => {
    resetEnv();
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
