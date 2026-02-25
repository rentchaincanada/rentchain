import { getPricingHealth } from "./planMatrix";

type EnvRequirement =
  | { kind: "name"; name: string }
  | { kind: "oneOf"; label: string; names: string[] };

const BASE_HARD_REQUIREMENTS: EnvRequirement[] = [
  { kind: "name", name: "JWT_SECRET" },
  {
    kind: "oneOf",
    label: "APP_BASE_URL|FRONTEND_URL|PUBLIC_APP_URL",
    names: ["APP_BASE_URL", "FRONTEND_URL", "PUBLIC_APP_URL"],
  },
  { kind: "name", name: "STRIPE_SECRET_KEY" },
  { kind: "name", name: "STRIPE_WEBHOOK_SECRET" },
  { kind: "name", name: "INTERNAL_JOB_TOKEN" },
  { kind: "name", name: "FIREBASE_API_KEY" },
  { kind: "name", name: "STRIPE_PRICE_STARTER_MONTHLY_LIVE" },
  { kind: "name", name: "STRIPE_PRICE_PRO_MONTHLY_LIVE" },
  { kind: "name", name: "STRIPE_PRICE_BUSINESS_MONTHLY_LIVE" },
];

const SOFT_REQUIREMENTS = [
  "EMAIL_REPLY_TO",
  "MAINTENANCE_NOTIFY_EMAIL",
  "VERIFIED_SCREENING_NOTIFY_EMAIL",
  "ADMIN_EMAILS",
  "AUTH_BOOTSTRAP_TOKEN",
  "AUTH_LOGIN_ENABLED",
  "PASSWORD_LOGIN_ENABLED",
];

function hasEnv(name: string): boolean {
  const raw = process.env[name];
  return Boolean(raw && String(raw).trim());
}

function getEmailProvider(): "mailgun" | "sendgrid" {
  const provider = String(process.env.EMAIL_PROVIDER || "sendgrid")
    .trim()
    .toLowerCase();
  return provider === "mailgun" ? "mailgun" : "sendgrid";
}

function missingHardRequirements(): string[] {
  const missing: string[] = [];
  const provider = getEmailProvider();

  const providerEmailRequirements =
    provider === "mailgun"
      ? ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "EMAIL_FROM"]
      : ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"];

  const hardRequirements: EnvRequirement[] = [
    ...BASE_HARD_REQUIREMENTS,
    ...providerEmailRequirements.map((name) => ({ kind: "name", name } as const)),
  ];

  for (const req of hardRequirements) {
    if (req.kind === "name") {
      if (!hasEnv(req.name)) missing.push(req.name);
      continue;
    }
    const satisfied = req.names.some((name) => hasEnv(name));
    if (!satisfied) missing.push(req.label);
  }

  return missing;
}

function missingSoftRequirements(): string[] {
  return SOFT_REQUIREMENTS.filter((name) => !hasEnv(name));
}

export function getEnvFlags() {
  const pricingHealth = getPricingHealth();
  const emailProvider = getEmailProvider();

  const mailgunConfigured =
    hasEnv("MAILGUN_API_KEY") && hasEnv("MAILGUN_DOMAIN") && hasEnv("EMAIL_FROM");
  const sendgridConfigured =
    hasEnv("SENDGRID_API_KEY") && hasEnv("SENDGRID_FROM_EMAIL");

  return {
    emailProvider,
    jwtConfigured: hasEnv("JWT_SECRET"),
    firebaseConfigured: hasEnv("FIREBASE_API_KEY"),
    emailConfigured: emailProvider === "mailgun" ? mailgunConfigured : sendgridConfigured,
    mailgunConfigured,
    sendgridConfigured,
    stripeConfigured: hasEnv("STRIPE_SECRET_KEY") && hasEnv("STRIPE_WEBHOOK_SECRET"),
    pricingConfigured: pricingHealth.ok,
  };
}

export function assertRequiredEnv(): void {
  const missingHard = missingHardRequirements();
  const missingSoft = missingSoftRequirements();
  const isProd =
    String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

  if (missingHard.length > 0) {
    const message = `[boot] missing required env vars: ${missingHard.join(", ")}`;
    if (isProd) {
      throw new Error(message);
    }
    console.warn(`${message} (continuing because NODE_ENV is not production)`);
  }

  if (missingSoft.length > 0) {
    console.warn(`[boot] missing recommended env vars: ${missingSoft.join(", ")}`);
  }
}
