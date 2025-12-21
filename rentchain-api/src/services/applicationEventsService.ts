import { v4 as uuid } from "uuid";

export type ApplicationEventType =
  | "created"
  | "phone_code_sent"
  | "phone_verified"
  | "submitted"
  | "references_contacted"
  | "screening_requested"
  | "screening_paid"
  | "screening_completed";

export type ApplicationEventActor = "tenant" | "landlord" | "system";

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type: ApplicationEventType;
  message: string;
  actor: ApplicationEventActor;
  createdAt: string;
  metadata?: Record<string, any>;
}

const EVENTS: ApplicationEvent[] = [];

export function recordApplicationEvent(
  event: Omit<ApplicationEvent, "id" | "createdAt">
): ApplicationEvent {
  const createdAt = new Date().toISOString();
  const entry: ApplicationEvent = {
    id: uuid(),
    createdAt,
    ...event,
  };

  EVENTS.push(entry);
  return entry;
}

export function getApplicationEvents(
  applicationId: string
): ApplicationEvent[] {
  return EVENTS.filter((e) => e.applicationId === applicationId).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );
}
