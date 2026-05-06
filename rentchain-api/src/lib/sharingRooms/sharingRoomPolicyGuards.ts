import type { SharingRoomRedaction } from "./sharingRoomTypes";

export const SHARING_ROOM_REDACTIONS: SharingRoomRedaction[] = [
  {
    fieldCategory: "government_identity_numbers",
    state: "excluded",
    reason: "Raw government identity numbers are excluded from institutional sharing rooms.",
  },
  {
    fieldCategory: "screening_credit_payloads",
    state: "excluded",
    reason: "Raw screening, credit bureau, and provider payloads are excluded.",
  },
  {
    fieldCategory: "payment_account_details",
    state: "excluded",
    reason: "Payment account, card, bank, processor, and provider account details are excluded.",
  },
  {
    fieldCategory: "private_tenant_documents",
    state: "excluded",
    reason: "Private tenant documents and unrestricted document storage are excluded.",
  },
  {
    fieldCategory: "tenant_communications",
    state: "partially_redacted",
    reason: "Unrestricted tenant communications are not shared; only safe operational summaries may be referenced.",
  },
];

export function sharingRoomSafetyFlags() {
  return {
    manualReviewRequired: true as const,
    publiclyAccessible: false as const,
    externalExecutionEnabled: false as const,
    tokenizationEnabled: false as const,
  };
}
