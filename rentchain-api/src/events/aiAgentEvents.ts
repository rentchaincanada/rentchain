// src/events/aiAgentEvents.ts

export type AIAgentEventType =
  | "AIAgentTaskRequested"
  | "AIAgentTaskCompleted";

export interface BaseAIAgentEvent {
  id: string;
  type: AIAgentEventType;
  agent: string;
  createdAt: string; // ISO timestamp
}

export interface AIAgentTaskRequestedEvent extends BaseAIAgentEvent {
  type: "AIAgentTaskRequested";
  input: unknown;
}

export interface AIAgentTaskCompletedEvent extends BaseAIAgentEvent {
  type: "AIAgentTaskCompleted";
  input: unknown;
  output: unknown;
  success: boolean;
  errorMessage?: string;
}

export type AIAgentEvent =
  | AIAgentTaskRequestedEvent
  | AIAgentTaskCompletedEvent;
