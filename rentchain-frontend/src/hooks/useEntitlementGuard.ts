import { UpgradeReason } from "../components/billing/UpgradeModal";

export function handleEntitlementError(
  err: any,
  openUpgradeModal: (reason: UpgradeReason) => void
): boolean {
  const code = err?.code || err?.response?.data?.code;
  if (code !== "ENTITLEMENT_LIMIT_REACHED") return false;

  const resource = err?.resource || err?.response?.data?.resource;
  const reason: UpgradeReason =
    resource === "properties"
      ? "propertiesMax"
      : resource === "units"
      ? "unitsMax"
      : resource === "tenants"
      ? "automation"
      : "automation";

  openUpgradeModal(reason);
  return true;
}
