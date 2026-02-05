import { BureauProvider } from "./types";
import { TransUnionProvider } from "./transunionProvider";

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

export function getBureauProvider(): BureauProvider {
  const key = String(process.env.SCREENING_PROVIDER || "transunion").trim().toLowerCase();
  if (key === "transunion") return new TransUnionProvider();
  return new DisabledProvider(key);
}
