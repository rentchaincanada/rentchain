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
    const env = readEnv();
    if (!env.baseUrl || !env.apiKey) {
      throw new Error("transunion_not_configured");
    }
    const res = await fetch(`${env.baseUrl.replace(/\/$/, "")}/requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
        ...(env.clientId ? { "X-Client-Id": env.clientId } : {}),
      },
      body: JSON.stringify(_input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`transunion_create_failed:${res.status}:${text}`);
    }
    const data = (await res.json()) as any;
    return {
      requestId: String(data?.requestId || data?.id || ""),
      redirectUrl: data?.redirectUrl || data?.kbaUrl || null,
    };
  }

  async fetchReportPdf(_requestId: string): Promise<BureauProviderReport> {
    const env = readEnv();
    if (!env.baseUrl || !env.apiKey) {
      throw new Error("transunion_not_configured");
    }
    const res = await fetch(
      `${env.baseUrl.replace(/\/$/, "")}/requests/${encodeURIComponent(_requestId)}/report`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.apiKey}`,
          ...(env.clientId ? { "X-Client-Id": env.clientId } : {}),
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`transunion_report_failed:${res.status}:${text}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { pdfBuffer: buf, contentType: "application/pdf" };
  }
}
