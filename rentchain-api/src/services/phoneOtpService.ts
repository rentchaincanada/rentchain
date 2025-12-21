type OtpRecord = {
  code: string;
  expiresAt: number;
  sends: number;
  lastSentAt: number;
};

const OTP_STORE = new Map<string, OtpRecord>();
const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function saveCode(phone: string, code: string, expiresAt: number): void {
  const existing = OTP_STORE.get(phone);
  const now = Date.now();
  const sendsWithinWindow =
    existing && now - existing.lastSentAt <= TEN_MINUTES_MS
      ? existing.sends + 1
      : 1;

  OTP_STORE.set(phone, {
    code,
    expiresAt,
    sends: sendsWithinWindow,
    lastSentAt: now,
  });
}

export function canSendCode(phone: string): boolean {
  const existing = OTP_STORE.get(phone);
  if (!existing) return true;
  const now = Date.now();
  if (now - existing.lastSentAt > TEN_MINUTES_MS) return true;
  return existing.sends < MAX_SENDS_PER_WINDOW;
}

export function verifyCode(phone: string, code: string): boolean {
  const record = OTP_STORE.get(phone);
  if (!record) return false;
  const now = Date.now();
  if (now > record.expiresAt) return false;
  return record.code === code;
}
