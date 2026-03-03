import { createHmac } from "crypto";

type BuildReferralInput = {
  landlordId: string;
  applicationId?: string | null;
  orderId?: string | null;
  returnTo?: string | null;
  locale?: string | null;
  env?: string | null;
};

function trimOrNull(value: unknown) {
  const v = String(value || "").trim();
  return v.length ? v : null;
}

function shouldDebugLog() {
  return String(process.env.TU_REFERRAL_DEBUG_LOG || "false").trim().toLowerCase() === "true";
}

function safeTail(value: string | null) {
  if (!value) return null;
  if (value.length <= 6) return value;
  return `***${value.slice(-6)}`;
}

function buildReturnUrl(base: string, input: BuildReferralInput) {
  const url = new URL(base);
  if (input.applicationId) {
    url.searchParams.set("applicationId", input.applicationId);
  }
  if (input.orderId) {
    url.searchParams.set("orderId", input.orderId);
  }
  if (input.returnTo) {
    url.searchParams.set("returnTo", input.returnTo);
  }
  return url.toString();
}

export function buildTransUnionReferralUrl(input: BuildReferralInput): string {
  const baseUrl = trimOrNull(process.env.TU_REFERRAL_BASE_URL);
  if (!baseUrl) {
    throw new Error("tu_referral_base_url_missing");
  }
  const source = trimOrNull(process.env.TU_REFERRAL_SOURCE) || "rentchain";
  const callbackUrl = trimOrNull(process.env.TU_REFERRAL_CALLBACK_URL);
  const returnUrlBase = trimOrNull(process.env.TU_REFERRAL_RETURN_URL);
  const referralMode = trimOrNull(process.env.TU_REFERRAL_MODE);
  const now = Date.now();

  const url = new URL(baseUrl);
  url.searchParams.set("source", source);
  url.searchParams.set("landlordId", String(input.landlordId));
  if (input.applicationId) {
    url.searchParams.set("applicationId", String(input.applicationId));
  }
  if (input.orderId) {
    url.searchParams.set("orderId", String(input.orderId));
  }
  if (callbackUrl) {
    url.searchParams.set("callback", callbackUrl);
  }
  if (returnUrlBase) {
    url.searchParams.set("returnUrl", buildReturnUrl(returnUrlBase, input));
  }
  if (referralMode) {
    url.searchParams.set("mode", referralMode);
  }
  if (input.locale) {
    url.searchParams.set("locale", String(input.locale));
  }
  if (input.env) {
    url.searchParams.set("env", String(input.env));
  }
  url.searchParams.set("ts", String(now));

  const signingSecret = trimOrNull(process.env.TU_REFERRAL_SIGNING_SECRET);
  if (signingSecret) {
    const payload = [input.landlordId, input.applicationId || "", input.orderId || "", String(now)].join("|");
    const sig = createHmac("sha256", signingSecret).update(payload).digest("hex");
    url.searchParams.set("sig", sig);
  }

  if (shouldDebugLog()) {
    console.info("[tu_referral] built_url", {
      host: url.host,
      source,
      landlordId: safeTail(input.landlordId),
      applicationId: safeTail(input.applicationId || null),
      orderId: safeTail(input.orderId || null),
      hasCallback: Boolean(callbackUrl),
      hasReturnUrl: Boolean(returnUrlBase),
      hasSig: Boolean(signingSecret),
    });
  }

  return url.toString();
}

