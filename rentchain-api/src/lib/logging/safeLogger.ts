export type SafeLogLevel = "info" | "warn" | "error" | "debug";

export type SafeLogPayload = Record<string, unknown>;

export const REDACTED_LOG_VALUE = "[REDACTED]";

const MAX_DEPTH = 4;
const MAX_ARRAY_LENGTH = 25;
const MAX_STRING_LENGTH = 500;

const RESTRICTED_KEY_PATTERNS = [
  /^(sin|ssn|cvv)$/i,
  /social.*insurance/i,
  /bank.*account/i,
  /account.*number/i,
  /routing.*number/i,
  /transit.*number/i,
  /institution.*number/i,
  /^iban$/i,
  /^swift$/i,
  /card.*number/i,
  /credential/i,
  /raw.*report/i,
  /raw.*payload/i,
  /provider.*payload/i,
  /^payload$/i,
  /webhook.*secret/i,
  /api.*key/i,
  /private.*key/i,
  /service.*account/i,
  /token/i,
  /password/i,
  /secret/i,
  /ignored.*csv.*columns/i,
  /raw.*csv/i,
  /internal.*debug/i,
  /^stack$/i,
  /route.*source/i,
  /debug.*payload/i,
  /^authorization$/i,
  /^bearer$/i,
  /id.*token/i,
  /refresh.*token/i,
  /access.*token/i,
  /firebase.*token/i,
  /session.*token/i,
  /custom.*token/i,
  /internal.*job.*token/i,
  /^cookie$/i,
  /set.*cookie/i,
];

const INLINE_SECRET_PATTERNS = [
  /\bwhsec_[A-Za-z0-9_=-]+\b/g,
  /\bsk_(?:live|test)_[A-Za-z0-9_=-]+\b/g,
  /\bpk_(?:live|test)_[A-Za-z0-9_=-]+\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\beyJ[A-Za-z0-9._-]+\b/g,
  /\b(token|secret|password|api[_-]?key)=([^&\s]+)/gi,
];

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

export function isRestrictedLogKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return RESTRICTED_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function redactLogString(value: unknown, max = MAX_STRING_LENGTH): string {
  let next = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  for (const pattern of INLINE_SECRET_PATTERNS) {
    next = next.replace(pattern, (match, label) => {
      if (typeof label === "string" && label) return `${label}=${REDACTED_LOG_VALUE}`;
      return REDACTED_LOG_VALUE;
    });
  }
  return next;
}

export function sanitizeLogPayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return null;
  if (value == null) return null;
  if (typeof value === "string") return redactLogString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (value instanceof Error) {
    return {
      name: redactLogString(value.name, 120) || "Error",
      message: redactLogString(value.message, 300) || "error",
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeLogPayload(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: SafeLogPayload = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isRestrictedLogKey(key)) continue;
      const sanitized = sanitizeLogPayload(nested, depth + 1);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return out;
  }
  return null;
}

export function safeOperationalLog(level: SafeLogLevel, message: string, payload?: unknown) {
  const sanitizedMessage = redactLogString(message, 240) || "operational_log";
  const sanitizedPayload = sanitizeLogPayload(payload);
  const logger = console[level] || console.log;
  if (payload === undefined) {
    logger(sanitizedMessage);
    return;
  }
  logger(sanitizedMessage, sanitizedPayload);
}

export function safeErrorLog(message: string, error: unknown, payload?: unknown) {
  const sanitizedPayload = sanitizeLogPayload(payload);
  safeOperationalLog("error", message, {
    ...(sanitizedPayload && typeof sanitizedPayload === "object" && !Array.isArray(sanitizedPayload)
      ? (sanitizedPayload as SafeLogPayload)
      : {}),
    error: sanitizeLogPayload(error),
  });
}
