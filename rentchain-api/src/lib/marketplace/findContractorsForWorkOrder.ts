import type { ContractorProfileV1, ContractorServiceCategory } from "./contractorTypes";

const CATEGORY_ALIASES: Record<string, ContractorServiceCategory> = {
  plumbing: "plumbing",
  plumber: "plumbing",
  electrical: "electrical",
  electrician: "electrical",
  hvac: "hvac",
  heating: "hvac",
  cooling: "hvac",
  cleaning: "cleaning",
  painting: "painting",
  locksmith: "locksmith",
  appliance_repair: "appliance_repair",
  appliance: "appliance_repair",
  maintenance: "general_maintenance",
  general_maintenance: "general_maintenance",
  repairs: "general_maintenance",
};

export function normalizeServiceCategory(value: unknown): ContractorServiceCategory | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return CATEGORY_ALIASES[normalized] || null;
}

export function findContractorsForWorkOrder(input: {
  contractors: ContractorProfileV1[];
  serviceCategory?: string | null;
  serviceArea?: string | null;
  availabilityStatus?: string | null;
  limit?: number;
}) {
  const serviceCategory = normalizeServiceCategory(input.serviceCategory);
  const serviceArea = String(input.serviceArea || "").trim().toLowerCase();
  const availabilityFilter = String(input.availabilityStatus || "").trim().toLowerCase();

  const filtered = input.contractors.filter((contractor) => {
    if (availabilityFilter && contractor.availabilityStatus !== availabilityFilter) return false;
    if (serviceCategory && !contractor.serviceCategories.includes(serviceCategory)) return false;
    if (!availabilityFilter && contractor.availabilityStatus === "inactive") return false;
    if (availabilityFilter !== "inactive" && contractor.availabilityStatus === "inactive") return false;
    return true;
  });

  const sorted = filtered.sort((left, right) => {
    const leftAreaMatch = serviceArea
      ? left.serviceAreas.some((value) => String(value || "").trim().toLowerCase() === serviceArea)
      : false;
    const rightAreaMatch = serviceArea
      ? right.serviceAreas.some((value) => String(value || "").trim().toLowerCase() === serviceArea)
      : false;
    if (leftAreaMatch !== rightAreaMatch) return leftAreaMatch ? -1 : 1;
    const leftAvailabilityWeight = left.availabilityStatus === "active" ? 0 : left.availabilityStatus === "limited" ? 1 : 2;
    const rightAvailabilityWeight = right.availabilityStatus === "active" ? 0 : right.availabilityStatus === "limited" ? 1 : 2;
    if (leftAvailabilityWeight !== rightAvailabilityWeight) return leftAvailabilityWeight - rightAvailabilityWeight;
    return left.displayName.localeCompare(right.displayName);
  });

  const limit = Math.max(1, Math.min(Number(input.limit || 50), 100));
  return sorted.slice(0, limit);
}
