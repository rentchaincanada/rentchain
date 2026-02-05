export type PropertyGateAction = "create_application" | "send_screening_invite";

export function buildReturnTo(action: PropertyGateAction) {
  if (action === "send_screening_invite") {
    return "/applications?autoSelectProperty=1&openSendApplication=1";
  }
  return "/applications?autoSelectProperty=1&openSendApplication=1";
}

export function buildCreatePropertyUrl(returnTo: string) {
  const safe = returnTo.startsWith("/") ? returnTo : "/dashboard";
  const encoded = encodeURIComponent(safe);
  return `/properties?focus=addProperty&returnTo=${encoded}`;
}

export function resolveReturnToParam(value: string | null) {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("/")) return decoded;
  } catch {
    // ignore
  }
  return null;
}
