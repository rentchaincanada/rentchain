import { CreditProvider, CreditProviderRequest, CreditProviderResult } from "./providerTypes";

type ProviderErrorCode =
  | "provider_not_configured"
  | "provider_validation_error"
  | "provider_rate_limited"
  | "provider_timeout"
  | "provider_request_failed";

class ProviderError extends Error {
  code: ProviderErrorCode;
  status?: number;
  constructor(code: ProviderErrorCode, message?: string, status?: number) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

function assertConfigured(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.SINGLEKEY_BASE_URL;
  const apiKey = process.env.SINGLEKEY_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new ProviderError(
      "provider_not_configured",
      "SingleKey is not configured"
    );
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithRetry(
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init, 10000);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new ProviderError("provider_timeout", "Provider request timed out");
    }
    throw err;
  }
}

export class SingleKeyProvider implements CreditProvider {
  async createReport(
    req: CreditProviderRequest
  ): Promise<CreditProviderResult> {
    const { baseUrl, apiKey } = assertConfigured();

    const payload = {
      applicant: {
        firstName: req.applicant.firstName,
        middleName: req.applicant.middleName,
        lastName: req.applicant.lastName,
        dateOfBirth: req.applicant.dateOfBirth,
        email: req.contact.email,
        phone: req.contact.phone,
        sinLast4: req.sinLast4 || undefined,
      },
      address: {
        streetNumber: req.address.streetNumber,
        streetName: req.address.streetName,
        city: req.address.city,
        province: req.address.province,
        postalCode: req.address.postalCode,
        country: req.address.country,
      },
      tenancy: {
        propertyName: req.tenancy.propertyName,
        addressLine1: req.tenancy.propertyAddressLine1,
        city: req.tenancy.city,
        province: req.tenancy.province,
        postalCode: req.tenancy.postalCode,
        unitApplied: req.tenancy.unitApplied,
        leaseStartDate: req.tenancy.leaseStartDate,
      },
      consent: {
        creditCheck: req.consent.creditCheck,
        consentedAt: req.consent.consentedAt,
      },
      metadata: {
        applicationId: req.applicationId,
      },
    };

    const idempotencyKey = `${req.applicationId}-${req.tenancy.leaseStartDate}-${req.tenancy.unitApplied}`;

    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    };

    let response: Response;
    try {
      response = await requestWithRetry(`${baseUrl}/screenings`, init);
      if (response.status >= 500 && response.status < 600) {
        response = await requestWithRetry(`${baseUrl}/screenings`, init);
      }
    } catch (err: any) {
      if (err instanceof ProviderError) {
        throw err;
      }
      throw new ProviderError("provider_request_failed", "Provider request failed");
    }

    if (!response.ok) {
      if (response.status === 400) {
        throw new ProviderError(
          "provider_validation_error",
          "Provider validation error",
          response.status
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError(
          "provider_not_configured",
          "SingleKey is not configured",
          response.status
        );
      }
      if (response.status === 429) {
        throw new ProviderError("provider_rate_limited", "Rate limited", response.status);
      }
      throw new ProviderError(
        "provider_request_failed",
        "Provider request failed",
        response.status
      );
    }

    let raw: any = {};
    try {
      raw = await response.json();
    } catch {
      raw = {};
    }

    const providerReferenceId =
      raw?.id || raw?.screeningId || raw?.requestId || idempotencyKey;
    const score = typeof raw?.score === "number" ? raw.score : undefined;
    const riskBand =
      raw?.riskBand || raw?.risk?.level || (score ? deriveRiskBand(score) : undefined);
    const highlights: string[] =
      Array.isArray(raw?.highlights) && raw.highlights.length
        ? raw.highlights
        : buildHighlights(score, riskBand);
    const summaryText =
      raw?.summary ||
      raw?.status ||
      "Screening report generated by SingleKey (sandbox).";

    return {
      providerName: "singlekey",
      providerReferenceId: String(providerReferenceId),
      score,
      riskBand: riskBand ? String(riskBand) : undefined,
      highlights,
      summaryText,
      rawPayload: raw,
      generatedAt: new Date().toISOString(),
    };
  }
}

function deriveRiskBand(score: number): string {
  if (score >= 720) return "low";
  if (score >= 660) return "medium";
  return "high";
}

function buildHighlights(score?: number, riskBand?: string): string[] {
  const items: string[] = [];
  if (typeof score === "number") {
    items.push(`Credit score: ${score}`);
  }
  if (riskBand) {
    items.push(`Risk band: ${riskBand}`);
  }
  items.push("SingleKey sandbox screening completed.");
  return items;
}

export { ProviderError };
