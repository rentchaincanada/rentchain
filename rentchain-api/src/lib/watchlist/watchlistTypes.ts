export type WatchTargetType =
  | "portfolio"
  | "application"
  | "maintenance"
  | "lease";

export type WatchlistEntryV1 = {
  version: "v1";
  id: string;
  target: {
    type: WatchTargetType;
    id: string;
    portfolioId?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  notes?: string | null;
  tags?: string[];
  isActive: boolean;
};
