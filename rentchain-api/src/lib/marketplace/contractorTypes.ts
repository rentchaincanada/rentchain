export type ContractorServiceCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "general_maintenance"
  | "cleaning"
  | "painting"
  | "locksmith"
  | "appliance_repair";

export type ContractorAvailabilityStatus = "active" | "inactive" | "limited";

export type ContractorProfileV1 = {
  version: "v1";
  id: string;
  userId?: string | null;
  displayName: string;
  businessName?: string | null;
  serviceCategories: ContractorServiceCategory[];
  serviceAreas: string[];
  availabilityStatus: ContractorAvailabilityStatus;
  contact: {
    email?: string | null;
    phone?: string | null;
  };
  summary?: string | null;
  metadata?: {
    internalNotes?: string | null;
    landlordNetworkIds?: string[] | null;
    createdByLandlordId?: string | null;
  };
  createdAt: string;
  updatedAt: string;
};
