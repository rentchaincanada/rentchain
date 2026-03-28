export type ViewingRequestStatus =
  | "requested"
  | "slots_proposed"
  | "scheduled"
  | "completed"
  | "cancelled";

export type ViewingSlot = {
  id: string;
  startAt: string;
  endAt: string;
  note?: string | null;
  isSelected?: boolean;
};

export type SelectedViewingSlot = {
  id: string;
  startAt: string;
  endAt: string;
  note?: string | null;
} | null;

export type ViewingRequestDoc = {
  id: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  applicationId: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  requestedMessage: string | null;
  status: ViewingRequestStatus;
  proposedSlots: ViewingSlot[];
  selectedSlotId?: string | null;
  selectedSlot?: SelectedViewingSlot;
  requestedAt: string;
  slotsProposedAt?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string | null;
};

export type CreateViewingRequestInput = {
  propertyId?: string | null;
  unitId?: string | null;
  applicationId?: string | null;
  applicantName?: string | null;
  applicantEmail?: string | null;
  applicantPhone?: string | null;
  requestedMessage?: string | null;
};

export type ProposeViewingSlotsInput = {
  proposedSlots?: ViewingSlot[];
};

export type SelectViewingSlotInput = {
  slotId?: string | null;
};

export type CancelViewingRequestInput = {
  cancelledReason?: string | null;
};

export type ViewingOwnershipContext = {
  landlordId: string | null;
  propertyId: string | null;
  unitId: string | null;
};
