import type { IdentityOracleGateResult } from "./identityOracleTypes";

type PolicyInput = {
  propertyId: string;
  identifier: string;
  identifierType: string;
  province: string;
  source: string;
};

export function evaluateOntarioGatewayPolicy(input: PolicyInput): IdentityOracleGateResult {
  const enabled = String(process.env.IDENTITY_ORACLE_ON_GATEWAY_POLICY || "enabled").trim().toLowerCase();
  if (enabled !== "enabled") {
    return {
      allowed: false,
      reasonCode: "policy_disabled",
      notes: ["Ontario gateway verification is disabled by policy."],
    };
  }

  if (!String(input.propertyId || "").trim()) {
    return {
      allowed: false,
      reasonCode: "missing_property_id",
      notes: ["A property id is required before Ontario gateway verification can run."],
    };
  }

  if (String(input.province || "").trim().toUpperCase() !== "ON") {
    return {
      allowed: false,
      reasonCode: "province_not_supported",
      notes: ["Ontario gateway verification only supports Ontario properties."],
    };
  }

  if (String(input.identifierType || "").trim().toLowerCase() !== "pin") {
    return {
      allowed: false,
      reasonCode: "identifier_type_not_supported",
      notes: ["Ontario gateway verification requires a PIN."],
    };
  }

  if (!String(input.identifier || "").trim()) {
    return {
      allowed: false,
      reasonCode: "missing_identifier",
      notes: ["Ontario gateway verification requires a normalized PIN."],
    };
  }

  if (String(input.source || "").trim().toLowerCase() !== "ontario_gateway") {
    return {
      allowed: false,
      reasonCode: "source_not_supported",
      notes: ["Ontario gateway policy only applies to the ontario_gateway source."],
    };
  }

  if (String(process.env.ONTARIO_GATEWAY_MODE || "stub").trim().toLowerCase() === "disabled") {
    return {
      allowed: false,
      reasonCode: "gateway_not_configured",
      notes: ["Ontario gateway mode is disabled."],
    };
  }

  return {
    allowed: true,
    reasonCode: "allowed",
    notes: [],
  };
}

export function evaluateOntarioGatewayUsageGate(): IdentityOracleGateResult {
  const mode = String(process.env.IDENTITY_ORACLE_ON_USAGE_GATE || "allow").trim().toLowerCase();
  if (mode === "deny") {
    return {
      allowed: false,
      reasonCode: "usage_gate_denied",
      notes: ["Ontario gateway usage gate denied the verification attempt."],
    };
  }

  return {
    allowed: true,
    reasonCode: "allowed",
    notes: [],
  };
}
