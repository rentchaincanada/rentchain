import { describe, expect, it, beforeEach } from "vitest";
import {
  decryptTransUnionCredential,
  encryptTransUnionCredential,
  maskTransUnionMemberCode,
} from "./transunionEncryption";

describe("transunionEncryption", () => {
  beforeEach(() => {
    process.env.TRANSUNION_CREDENTIALS_ENCRYPTION_KEY = Buffer.from(
      "12345678901234567890123456789012"
    ).toString("base64");
  });

  it("roundtrips encrypted credentials", () => {
    const encrypted = encryptTransUnionCredential("member-passcode-123");
    expect(encrypted.ciphertext).not.toContain("member-passcode-123");
    expect(decryptTransUnionCredential(encrypted.ciphertext, encrypted.iv)).toBe(
      "member-passcode-123"
    );
  });

  it("masks member codes for display", () => {
    expect(maskTransUnionMemberCode("123456789")).toBe("*****6789");
    expect(maskTransUnionMemberCode("9876")).toBe("***6");
  });
});
