import { caNsLeaseDocumentAdapter } from "./jurisdictions/caNsAdapter";
import type { JurisdictionAdapterCode, JurisdictionLeaseDocumentAdapter } from "./leaseDocumentTypes";

const adapters = new Map<JurisdictionAdapterCode, JurisdictionLeaseDocumentAdapter>([
  ["CA_NS", caNsLeaseDocumentAdapter],
]);

export function jurisdictionCodeFromLease(input: Record<string, any>): JurisdictionAdapterCode | null {
  const raw = String(
    input?.jurisdictionCode ||
      input?.jurisdictionProvince ||
      input?.province ||
      input?.provinceState ||
      ""
  )
    .trim()
    .toUpperCase()
    .replace(/[^A-Z_]/g, "");
  if (!raw) return null;
  if (raw === "NS" || raw === "CA_NS") return "CA_NS";
  if (raw === "ON" || raw === "CA_ON") return "CA_ON";
  if (raw === "BC" || raw === "CA_BC") return "CA_BC";
  if (raw === "AB" || raw === "CA_AB") return "CA_AB";
  if (raw === "QC" || raw === "CA_QC") return "CA_QC";
  if (raw.startsWith("US_")) return raw as JurisdictionAdapterCode;
  return null;
}

export function getLeaseDocumentAdapter(code: JurisdictionAdapterCode | null): JurisdictionLeaseDocumentAdapter | null {
  if (!code) return null;
  return adapters.get(code) || null;
}

export function registerLeaseDocumentAdapter(adapter: JurisdictionLeaseDocumentAdapter) {
  adapters.set(adapter.jurisdictionCode, adapter);
}

function configuredBoolean(name: string): boolean | null {
  const explicit = String(process.env[name] || "").trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  return null;
}

export function isLeaseDocumentTestMode() {
  const documentGenerationMode = configuredBoolean("LEASE_DOCUMENT_GENERATION_TEST_MODE");
  if (documentGenerationMode !== null) return documentGenerationMode;
  const legacyDocumentSourceMode = configuredBoolean("SIGNING_DOCUMENT_SOURCE_TEST_MODE");
  if (legacyDocumentSourceMode !== null) return legacyDocumentSourceMode;
  const signingProviderTestMode = configuredBoolean("SIGNING_PROVIDER_TEST_MODE");
  if (signingProviderTestMode !== null) return signingProviderTestMode;
  return String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production";
}

export function assertAdapterAllowedForGeneration(adapter: JurisdictionLeaseDocumentAdapter) {
  if (adapter.productionApproved && adapter.signingEnabled) return;
  if (isLeaseDocumentTestMode() && adapter.counselReviewStatus === "draft") return;
  const error = new Error("jurisdiction_template_unavailable") as Error & { status: number };
  error.status = 400;
  throw error;
}

export function assertAdapterAllowedForSigning(adapterStatus: {
  counselReviewStatus?: string | null;
  signingEnabled?: boolean | null;
  productionApproved?: boolean | null;
}) {
  if (adapterStatus.productionApproved && adapterStatus.signingEnabled) return;
  const reviewStatus = String(adapterStatus.counselReviewStatus || (adapterStatus as any).adapterStatus || "");
  if (isLeaseDocumentTestMode() && reviewStatus === "draft") return;
  const error = new Error("jurisdiction_template_unavailable") as Error & { status: number };
  error.status = 400;
  throw error;
}
