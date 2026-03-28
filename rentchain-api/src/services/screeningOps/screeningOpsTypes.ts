export type ScreeningOperationStatus =
  | "requested"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LandlordScreeningStatus =
  | "not_started"
  | "blocked_transunion_not_connected"
  | ScreeningOperationStatus;

export type ScreeningProvider = "transunion_manual";

export type ScreeningOperation = {
  id: string;
  applicationId: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  applicantName?: string | null;
  provider: ScreeningProvider;
  status: ScreeningOperationStatus;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  resultSummary?: string | null;
  resultFlags?: string[];
  reportUrl?: string | null;
  reportExportId?: string | null;
  operatorNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string | null;
};

export type ScreeningStatusView = {
  status: LandlordScreeningStatus;
  provider: ScreeningProvider | null;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  resultSummary: string | null;
  resultFlags: string[];
  reportAvailable: boolean;
  reportUrl: string | null;
  reportExportId: string | null;
  actionLabel: string;
  actionPath: string;
  operationId: string | null;
};

export type ScreeningOperationListFilters = {
  status?: ScreeningOperationStatus | null;
  landlordId?: string | null;
  applicationId?: string | null;
};

export type ScreeningOperationCreateInput = {
  applicationId: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  applicantName?: string | null;
  updatedByUserId?: string | null;
};

export type ScreeningOperationCompleteInput = {
  resultSummary?: string | null;
  resultFlags?: string[];
  reportUrl?: string | null;
  reportExportId?: string | null;
  operatorNotes?: string | null;
  updatedByUserId?: string | null;
};

export type ScreeningOperationCancelInput = {
  cancelledReason?: string | null;
  updatedByUserId?: string | null;
};
