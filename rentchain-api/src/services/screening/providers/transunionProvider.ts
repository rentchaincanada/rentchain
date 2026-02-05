import {
  BureauProvider,
  BureauProviderPreflight,
  BureauProviderRequest,
  BureauProviderRequestResult,
  BureauProviderReport,
} from "./types";

type EnvConfig = {
  baseUrl: string;
  apiKey: string;
  clientId?: string;
};

function readEnv(): EnvConfig {
  return {
    baseUrl: String(process.env.TU_RESELLER_BASE_URL || "").trim(),
    apiKey: String(process.env.TU_RESELLER_API_KEY || "").trim(),
    clientId: String(process.env.TU_RESELLER_CLIENT_ID || "").trim() || undefined,
  };
}

export class TransUnionProvider implements BureauProvider {
  name = "transunion";

  isConfigured() {
    const env = readEnv();
    return Boolean(env.baseUrl && env.apiKey);
  }

  async preflight(): Promise<BureauProviderPreflight> {
    const env = readEnv();
    if (!env.baseUrl || !env.apiKey) {
      return { ok: false, detail: "missing_env:TU_RESELLER_BASE_URL or TU_RESELLER_API_KEY" };
    }
    if (String(process.env.SCREENING_PROVIDER_PREFLIGHT_SKIP || "") === "1") {
      return { ok: true, detail: "preflight_skipped" };
    }
    // TODO: replace with reseller ping/health endpoint once available.
    return { ok: true };
  }

  async createRequest(_input: BureauProviderRequest): Promise<BureauProviderRequestResult> {
    // TODO: implement reseller/TU request creation when API docs/keys are available.
    throw new Error("transunion_create_request_not_implemented");
  }

  async fetchReportPdf(_requestId: string): Promise<BureauProviderReport> {
    // TODO: implement secure report fetch once API docs/keys are available.
    throw new Error("transunion_fetch_report_not_implemented");
  }
}
