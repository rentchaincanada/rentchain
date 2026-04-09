import { normalizeAddressFromParts, normalizePid, scoreAddressSimilarity } from "../../registry/registryUtils";
import { lookupHalifaxR400ByPid } from "../clients/halifaxR400SourceClient";
import { checkHalifaxR400Health } from "../halifaxR400HealthService";
import type {
  IdentityOraclePropertyContext,
  IdentityOracleVerificationResult,
} from "../identityOracleTypes";

type HalifaxVerifyInput = {
  province: string;
  municipality?: string | null;
  propertyId: string;
  identifier: string;
  identifierType: string;
  propertyContext?: IdentityOraclePropertyContext | null;
};

export class HalifaxR400IdentityAdapter {
  readonly sourceType = "OPEN_DATASET" as const;
  readonly sourceKey = "halifax_r400" as const;
  readonly sourceLabel = "HRM Halifax Residential Rental Registry R-400";

  classify(input: { province: string; identifierType: string; identifier: string }) {
    const normalizedIdentifier = this.normalize({
      province: input.province,
      identifierType: input.identifierType,
      identifier: input.identifier,
    });
    return {
      province: "NS",
      source: "PVSC",
      identifierType: "pid",
      sourceType: this.sourceType,
      namespace: `NS:PVSC:${normalizedIdentifier}`,
    };
  }

  normalize(input: { identifierType: string; identifier: string; province: string }) {
    if (String(input.province || "").trim().toUpperCase() !== "NS") {
      throw buildAdapterError("province_not_supported", 400);
    }
    if (String(input.identifierType || "").trim().toLowerCase() !== "pid") {
      throw buildAdapterError("identifier_type_not_supported", 400);
    }
    const normalized = normalizePid(input.identifier);
    if (!normalized) {
      throw buildAdapterError("identifier_required", 400);
    }
    return normalized;
  }

  validateSyntax(input: { identifierType: string; identifier: string; province: string }) {
    try {
      const normalizedIdentifier = this.normalize(input);
      if (String(normalizedIdentifier).length !== 8) {
        return { ok: false, normalizedIdentifier: null, issues: ["nova_scotia_pid_must_have_8_digits"] };
      }
      return { ok: true, normalizedIdentifier, issues: [] };
    } catch (error: any) {
      return { ok: false, normalizedIdentifier: null, issues: [String(error?.message || "invalid_identifier")] };
    }
  }

  async verify(input: HalifaxVerifyInput): Promise<IdentityOracleVerificationResult> {
    const syntax = this.validateSyntax({
      identifierType: input.identifierType,
      identifier: input.identifier,
      province: input.province,
    });
    if (!syntax.ok || !syntax.normalizedIdentifier) {
      return {
        namespaceKey: `NS:PVSC:${String(input.identifier || "").trim()}`,
        normalizedIdentifier: String(input.identifier || "").trim(),
        identifierType: "pid",
        verificationStatus: "MANUAL_REVIEW_REQUIRED",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: "degraded",
        flags: ["invalid_pid_syntax"],
        notes: syntax.issues,
      };
    }

    const sourceResult = await lookupHalifaxR400ByPid(syntax.normalizedIdentifier);
    if (!sourceResult.ok) {
      return {
        namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pid",
        verificationStatus: "SOURCE_UNAVAILABLE",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        flags: sourceResult.failureKind ? [sourceResult.failureKind] : [],
        notes: sourceResult.issues,
      };
    }

    if (!sourceResult.records.length) {
      return {
        namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pid",
        verificationStatus: "UNREGISTERED_RISK",
        confidence: 0.72,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        flags: ["registry_record_not_found"],
        notes: ["No Halifax R-400 registry record matched the PID lookup."],
      };
    }

    const expectedAddress = normalizeAddressFromParts([
      input.propertyContext?.addressLine1,
      input.propertyContext?.city,
      input.propertyContext?.province,
      input.propertyContext?.postalCode,
    ]);

    if (!expectedAddress) {
      return {
        namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pid",
        verificationStatus: "MANUAL_REVIEW_REQUIRED",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        flags: ["missing_property_address_context"],
        notes: ["Property address context is required for deterministic Halifax verification."],
        relatedNamespaces: buildRelatedNamespaces(sourceResult.records),
      };
    }

    if (sourceResult.records.length > 1) {
      return {
        namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pid",
        verificationStatus: "PARTIAL_MATCH",
        confidence: 0.64,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        flags: ["multiple_registry_records_for_pid"],
        notes: ["Multiple Halifax R-400 records were returned for the PID lookup."],
        relatedNamespaces: buildRelatedNamespaces(sourceResult.records),
      };
    }

    const record = sourceResult.records[0];
    const addressScore = scoreAddressSimilarity(expectedAddress, record.addressNormalized || record.primaryAddressCandidate);
    const isRegistered = String(record.registrationStatusNormalized || "").trim().toLowerCase() === "registered";
    const relatedNamespaces = buildRelatedNamespaces(sourceResult.records);

    if (addressScore >= 0.95 && isRegistered) {
      return {
        namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pid",
        verificationStatus: "VERIFIED_MATCH",
        confidence: Math.min(record.sourceConfidence ?? 0.94, 0.96),
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        flags: [],
        notes: ["Halifax R-400 record matched the PID and property address strongly."],
        relatedNamespaces,
      };
    }

    if (addressScore >= 0.55 || isRegistered) {
      return {
        namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pid",
        verificationStatus: "PARTIAL_MATCH",
        confidence: Math.min(record.sourceConfidence ?? 0.8, 0.78),
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        flags: addressScore < 0.95 ? ["address_ambiguity"] : ["registration_status_not_registered"],
        notes: ["Halifax R-400 lookup found a plausible match, but the verification remained incomplete."],
        relatedNamespaces,
      };
    }

    return {
      namespaceKey: `NS:PVSC:${syntax.normalizedIdentifier}`,
      normalizedIdentifier: syntax.normalizedIdentifier,
      identifierType: "pid",
      verificationStatus: "MANUAL_REVIEW_REQUIRED",
      confidence: null,
      sourceType: this.sourceType,
      sourceKey: this.sourceKey,
      sourceLabel: this.sourceLabel,
      sourceHealth: sourceResult.health,
      flags: ["conflicting_property_context"],
      notes: ["The Halifax R-400 response could not be resolved deterministically against property context."],
      relatedNamespaces,
    };
  }

  async healthCheck() {
    return checkHalifaxR400Health();
  }
}

function buildAdapterError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function buildRelatedNamespaces(records: Array<{ registrationNumber: string | null }>) {
  return Array.from(
    new Set(
      records
        .map((record) => String(record.registrationNumber || "").trim())
        .filter(Boolean)
        .map((registrationNumber) => `NS:HRM:${registrationNumber}`)
    )
  );
}
