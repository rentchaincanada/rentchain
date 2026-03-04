import { BureauProvider } from "./types";
import { TransUnionProvider } from "./transunionProvider";
import { TransUnionReferralProvider } from "./transunionReferralProvider";

class DisabledProvider implements BureauProvider {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  isConfigured() {
    return false;
  }
  async preflight() {
    return { ok: false, detail: `unknown_provider:${this.name}` };
  }
  async createRequest(): Promise<any> {
    throw new Error(`provider_not_configured:${this.name}`);
  }
  async fetchReportPdf(): Promise<any> {
    throw new Error(`provider_not_configured:${this.name}`);
  }
}

function isProdEnv() {
  const appEnv = String(process.env.APP_ENV || "").trim().toLowerCase();
  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return appEnv === "production" || nodeEnv === "production";
}

function normalizeProviderKey(raw: string) {
  const key = String(raw || "")
    .trim()
    .toLowerCase();
  if (key === "tu_referral" || key === "transunion-referral") {
    return "transunion_referral";
  }
  return key;
}

export function getBureauProvider(): BureauProvider {
  const explicitRaw = String(process.env.BUREAU_PROVIDER || process.env.SCREENING_PROVIDER || "").trim();
  const explicit = normalizeProviderKey(explicitRaw);
  let key = explicit;
  if (!key) {
    if (isProdEnv()) {
      key = "disabled";
      console.warn("[screening] provider fallback: missing BUREAU_PROVIDER in production; defaulting to disabled");
    } else {
      key = "transunion";
    }
  }
  if (key === "transunion_referral") return new TransUnionReferralProvider();
  if (key === "transunion") return new TransUnionProvider();
  return new DisabledProvider(key);
}
