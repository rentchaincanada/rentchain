import type {
  IdentityOracleIdentifierType,
  IdentityOracleProvinceCode,
  IdentityOracleSyntaxResult,
} from "../identityOracleTypes";

export class NovaScotiaPropertyIdentitySyntaxAdapter {
  readonly provinceCode: IdentityOracleProvinceCode = "NS";
  readonly identifierType: IdentityOracleIdentifierType = "pid";

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

    if (digits.length !== 8) {
      return {
        status: "invalid",
        ok: false,
        reason: "nova_scotia_pid_must_have_8_digits",
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
    return "ca-ns:pid";
  }
}
