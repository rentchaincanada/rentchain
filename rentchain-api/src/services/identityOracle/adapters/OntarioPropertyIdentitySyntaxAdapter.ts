import type {
  IdentityOracleIdentifierType,
  IdentityOracleProvinceCode,
  IdentityOracleSyntaxResult,
} from "../identityOracleTypes";

export class OntarioPropertyIdentitySyntaxAdapter {
  readonly provinceCode: IdentityOracleProvinceCode = "ON";
  readonly identifierType: IdentityOracleIdentifierType = "pin";

  normalize(identifier: string): IdentityOracleSyntaxResult {
    const digits = String(identifier || "").replace(/\D/g, "");
    if (!digits) {
      return {
        status: "invalid",
        ok: false,
        reason: "identifier_required",
        normalizedIdentifier: null,
      };
    }

    if (digits.length !== 9) {
      return {
        status: "invalid",
        ok: false,
        reason: "ontario_pin_must_have_9_digits",
        normalizedIdentifier: null,
      };
    }

    return {
      status: "valid",
      ok: true,
      reason: null,
      normalizedIdentifier: digits,
    };
  }

  buildNamespaceKey() {
    return "ca-on:pin";
  }
}
