import { v4 as uuid } from "uuid";

export type ScreeningCreditEventType = "screening_credit_used";

export interface ScreeningCreditEvent {
  id: string;
  landlordId: string;
  type: ScreeningCreditEventType;
  referenceId?: string;
  timestamp: string;
}

const SCREENING_CREDIT_EVENTS: ScreeningCreditEvent[] = [];

export function recordScreeningCreditUsed(options: {
  landlordId: string;
  referenceId?: string;
}): ScreeningCreditEvent {
  const event: ScreeningCreditEvent = {
    id: uuid(),
    landlordId: options.landlordId,
    type: "screening_credit_used",
    referenceId: options.referenceId,
    timestamp: new Date().toISOString(),
  };
  SCREENING_CREDIT_EVENTS.push(event);
  return event;
}

export function listScreeningCreditEventsForLandlord(
  landlordId: string
): ScreeningCreditEvent[] {
  return SCREENING_CREDIT_EVENTS.filter((e) => e.landlordId === landlordId).sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
}
