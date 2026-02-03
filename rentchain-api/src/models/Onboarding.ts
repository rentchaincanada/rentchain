export interface OnboardingState {
  landlordId: string;
  dismissed?: boolean;
  steps: {
    propertyAdded?: boolean;
    unitAdded?: boolean;
    tenantInvited?: boolean;
    applicationCreated?: boolean;
    exportPreviewed?: boolean;
  };
  lastSeenAt?: string;
}
