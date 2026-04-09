import { normalizeAddressFromParts, scoreAddressSimilarity } from "../../registry/registryUtils";
import { lookupOntarioGatewayByPin } from "../clients/ontarioGatewaySourceClient";
import { checkOntarioGatewayHealth } from "../ontarioGatewayHealthService";
import { evaluateOntarioGatewayPolicy, evaluateOntarioGatewayUsageGate } from "../ontarioGatewayPolicyService";
import type {
  IdentityOraclePropertyContext,
  IdentityOracleVerificationResult,
} from "../identityOracleTypes";

type OntarioVerifyInput = {
  province: string;
  propertyId: string;
  identifier: string;
  identifierType: string;
  source: string;
  propertyContext?: IdentityOraclePropertyContext | null;
};

export class OntarioGatewayIdentityAdapter {
  readonly sourceType = "PAID_GATEWAY" as const;
  readonly sourceKey = "ontario_gateway" as const;
  readonly sourceLabel = "Ontario Property Verification Gateway";

  classify(input: { province: string; identifierType: string; identifier: string }) {
    const normalizedIdentifier = this.normalize(input);
    return {
      province: "ON",
      source: "GATEWAY",
      identifierType: "pin",
      sourceType: this.sourceType,
      namespace: `ON:GATEWAY:${normalizedIdentifier}`,
    };
  }

  normalize(input: { province: string; identifierType: string; identifier: string }) {
    if (String(input.province || "").trim().toUpperCase() !== "ON") {
      throw buildAdapterError("province_not_supported", 400);
    }
    if (String(input.identifierType || "").trim().toLowerCase() !== "pin") {
      throw buildAdapterError("identifier_type_not_supported", 400);
    }
    const normalized = String(input.identifier || "").replace(/\D/g, "");
    if (!normalized) {
      throw buildAdapterError("identifier_required", 400);
    }
    return normalized;
  }

  validateSyntax(input: { province: string; identifierType: string; identifier: string }) {
    try {
      const normalizedIdentifier = this.normalize(input);
      if (normalizedIdentifier.length !== 9) {
        return { ok: false, normalizedIdentifier: null, issues: ["ontario_pin_must_have_9_digits"] };
      }
      return { ok: true, normalizedIdentifier, issues: [] };
    } catch (error: any) {
      return { ok: false, normalizedIdentifier: null, issues: [String(error?.message || "invalid_identifier")] };
    }
  }

  async verify(input: OntarioVerifyInput): Promise<IdentityOracleVerificationResult> {
    const syntax = this.validateSyntax(input);
    const policyGate = evaluateOntarioGatewayPolicy({
      propertyId: input.propertyId,
      identifier: input.identifier,
      identifierType: input.identifierType,
      province: input.province,
      source: input.source,
    });
    const usageGate = policyGate.allowed ? evaluateOntarioGatewayUsageGate() : null;

    if (!syntax.ok || !syntax.normalizedIdentifier) {
      return {
        namespaceKey: `ON:GATEWAY:${String(input.identifier || "").trim()}`,
        normalizedIdentifier: String(input.identifier || "").trim(),
        identifierType: "pin",
        verificationStatus: "MANUAL_REVIEW_REQUIRED",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: "degraded",
        policyGate,
        usageGate,
        flags: ["invalid_pin_syntax"],
        notes: syntax.issues,
      };
    }

    if (!policyGate.allowed) {
      return {
        namespaceKey: `ca-on:pin`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "SYNTAX_ONLY",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: "degraded",
        policyGate,
        usageGate,
        flags: ["policy_gate_denied"],
        notes: policyGate.notes || [],
      };
    }

    if (usageGate && !usageGate.allowed) {
      return {
        namespaceKey: `ca-on:pin`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "SYNTAX_ONLY",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: "degraded",
        policyGate,
        usageGate,
        flags: ["usage_gate_denied"],
        notes: usageGate.notes || [],
      };
    }

    const sourceResult = await lookupOntarioGatewayByPin(syntax.normalizedIdentifier);
    if (!sourceResult.ok) {
      return {
        namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "SOURCE_UNAVAILABLE",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        policyGate,
        usageGate,
        flags: sourceResult.failureKind ? [sourceResult.failureKind] : [],
        notes: sourceResult.issues,
      };
    }

    if (sourceResult.noMatch || !sourceResult.records.length) {
      return {
        namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "UNVERIFIED",
        confidence: 0.18,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        policyGate,
        usageGate,
        flags: ["gateway_no_match"],
        notes: ["Ontario gateway completed without a valid property match."],
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
        namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "MANUAL_REVIEW_REQUIRED",
        confidence: null,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        policyGate,
        usageGate,
        flags: ["missing_property_address_context"],
        notes: ["Property address context is required for deterministic Ontario gateway verification."],
      };
    }

    if (sourceResult.records.length > 1) {
      return {
        namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "PARTIAL_MATCH",
        confidence: 0.62,
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        policyGate,
        usageGate,
        flags: ["multiple_gateway_records_for_pin"],
        notes: ["The Ontario gateway returned multiple records for the requested PIN."],
      };
    }

    const record = sourceResult.records[0];
    const gatewayAddress = normalizeAddressFromParts([
      record.addressLine1,
      record.city,
      record.province,
      record.postalCode,
    ]);
    const addressScore = scoreAddressSimilarity(expectedAddress, gatewayAddress);

    if (addressScore >= 0.95) {
      return {
        namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "VERIFIED_MATCH",
        confidence: Math.min(record.confidenceHint ?? 0.93, 0.95),
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        policyGate,
        usageGate,
        flags: [],
        notes: ["Ontario gateway record matched the PIN and property address strongly."],
        relatedNamespaces: record.registrationNumber ? [`ON:LRO:${record.registrationNumber}`] : [],
      };
    }

    if (addressScore >= 0.55) {
      return {
        namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
        normalizedIdentifier: syntax.normalizedIdentifier,
        identifierType: "pin",
        verificationStatus: "PARTIAL_MATCH",
        confidence: Math.min(record.confidenceHint ?? 0.76, 0.78),
        sourceType: this.sourceType,
        sourceKey: this.sourceKey,
        sourceLabel: this.sourceLabel,
        sourceHealth: sourceResult.health,
        policyGate,
        usageGate,
        flags: ["address_ambiguity"],
        notes: ["Ontario gateway returned a plausible PIN match, but address confidence remained incomplete."],
        relatedNamespaces: record.registrationNumber ? [`ON:LRO:${record.registrationNumber}`] : [],
      };
    }

    return {
      namespaceKey: `ON:GATEWAY:${syntax.normalizedIdentifier}`,
      normalizedIdentifier: syntax.normalizedIdentifier,
      identifierType: "pin",
      verificationStatus: "MANUAL_REVIEW_REQUIRED",
      confidence: null,
      sourceType: this.sourceType,
      sourceKey: this.sourceKey,
      sourceLabel: this.sourceLabel,
      sourceHealth: sourceResult.health,
      policyGate,
      usageGate,
      flags: ["conflicting_property_context"],
      notes: ["The Ontario gateway response could not be resolved deterministically against property context."],
      relatedNamespaces: record.registrationNumber ? [`ON:LRO:${record.registrationNumber}`] : [],
    };
  }

  async healthCheck() {
    return checkOntarioGatewayHealth();
  }
}

function buildAdapterError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}
