export type PlanTier = "screening" | "starter" | "core" | "pro" | "elite";
export type PlanStatus = "active" | "trial" | "pending";

export type ExportTier = "csv" | "pdf" | "advanced";

export type Entitlements = {
  propertiesMax: number;
  unitsMax: number;
  usersMax: number;

  screening: boolean;
  automation: boolean;
  exports: ExportTier;
  notifications: boolean;
  apiAccess: boolean;
};

export type Usage = {
  properties: number;
  units: number;
  screeningsThisMonth: number;
};

export type Account = {
  id: string; // same as landlordId for simplicity
  ownerUserId: string; // landlordId
  plan: PlanTier;
  planStatus: PlanStatus;
  entitlements: Entitlements;
  usage: Usage;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
