export type Property = {
  id: string;
  address?: string;
  nickname?: string;
  unitCount?: number;
  createdAt?: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  unitNumber: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  rent?: number;
  status?: "vacant" | "occupied" | "unknown";
};
