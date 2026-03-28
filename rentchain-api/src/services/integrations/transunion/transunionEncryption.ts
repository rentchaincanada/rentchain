import crypto from "crypto";

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function parseEncryptionKey(raw: string): Buffer {
  const value = String(raw || "").trim();
  if (!value) {
    throw new Error("TRANSUNION_ENCRYPTION_KEY_MISSING");
  }

  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32 && base64.toString("base64") === value.replace(/\s+/g, "")) {
    return base64;
  }

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  const utf8 = Buffer.from(value, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error("TRANSUNION_ENCRYPTION_KEY_INVALID");
}

function getEncryptionKey(): Buffer {
  return parseEncryptionKey(process.env.TRANSUNION_CREDENTIALS_ENCRYPTION_KEY || "");
}

export function encryptTransUnionCredential(plainText: string): { ciphertext: string; iv: string } {
  const normalized = String(plainText || "");
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptTransUnionCredential(ciphertext: string, iv: string): string {
  const payload = Buffer.from(String(ciphertext || ""), "base64");
  const ivBuffer = Buffer.from(String(iv || ""), "base64");
  if (payload.length <= AUTH_TAG_BYTES) {
    throw new Error("TRANSUNION_CREDENTIAL_PAYLOAD_INVALID");
  }
  const encrypted = payload.subarray(0, payload.length - AUTH_TAG_BYTES);
  const authTag = payload.subarray(payload.length - AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), ivBuffer);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskTransUnionMemberCode(memberCode: string): string {
  const normalized = String(memberCode || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 4) {
    return `${"*".repeat(Math.max(0, normalized.length - 1))}${normalized.slice(-1)}`;
  }
  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}
