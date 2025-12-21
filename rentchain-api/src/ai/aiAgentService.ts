// src/ai/aiAgentService.ts

import { openaiClient } from "../config/openai";
import { firestore } from "../config/firebase";
import {
  AIAgentEvent,
  AIAgentTaskRequestedEvent,
  AIAgentTaskCompletedEvent,
} from "../events/aiAgentEvents";
import { recordDomainEvent } from "../events/eventDispatcher";

/**
 * Minimal agent type list.
 * You can expand this with real agents later (e.g. "tenantInsights", "portfolioInsights").
 */
export type AIAgentName =
  | "portfolioInsights"
  | "tenantInsights"
  | "genericAssistant";

export interface ExecuteAIAgentPayload {
  agent: AIAgentName | string; // allow custom agents for now
  input: unknown;
}

/**
 * Helper to generate a simple unique ID without adding new dependencies.
 */
function generateId(): string {
  return (
    "ai_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 10)
  );
}

/**
 * Simple mapping from agent name → system prompt.
 */
function getSystemPromptForAgent(agent: string): string {
  switch (agent) {
    case "portfolioInsights":
      return `
You are an AI portfolio analyst for a residential landlord.
You are given structured JSON about properties, tenants, rents, and KPIs.
Your job is to explain:
- Portfolio health (occupancy, rent roll, delinquency)
- Key risks and red flags
- Actionable recommendations for the next 30–90 days
Respond in concise, business-friendly language. Do not invent data. Base everything only on the input.`;

        case "tenantInsights":
      return `
You are an AI tenant risk & relationship analyst for a residential landlord.

You receive structured JSON about a single tenant. It may include:
- tenantId, tenantName, propertyName, unit
- balanceSummary: an object with
  - totalPaidLifetime
  - totalPayments
  - totalLatePayments
  - totalOnTimePayments
  - totalDaysLate
  - lastPaymentAt
  - lastPaymentAmount
  - lastPaymentStatus ("on-time" or "late")
- paymentHistory, notes, and other context

Your job:
1. Briefly summarize the tenant's payment behavior and risk profile.
2. Call out any red flags (late payments, growing risk, etc.).
3. Give 2–4 practical recommendations for the landlord:
   - communication strategy
   - payment plans or accommodations (if appropriate)
   - whether to renew, monitor, or escalate.

Be concise, practical, and landlord-focused. Do NOT invent data; only use what is in the JSON.`;


    default:
      return `
You are a helpful AI assistant embedded in a landlord property management system.
You receive JSON input with metrics, events and notes.
Summarize what matters and give clear next steps.`;
  }
}

/**
 * Call OpenAI Chat Completions for the given agent + input.
 * Returns a structured object we can store in the event.
 */
async function callOpenAIForAgent(
  agent: string,
  input: unknown
): Promise<{
  text: string | null;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please export it in your environment before calling AI agents."
    );
  }

  const systemPrompt = getSystemPromptForAgent(agent);

  const userContent =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini", // good fast model; can upgrade to gpt-4o later
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Here is the input data in JSON form:\n\n${userContent}`,
      },
    ],
  });

  const choice = completion.choices[0];
  const content = (choice as any)?.message?.content;

  const text =
    Array.isArray(content)
      ? content.map((c: any) => c?.text ?? "").join("\n")
      : typeof content === "string"
      ? content
      : "";

  return {
    text,
    model: completion.model ?? "unknown",
    usage: completion.usage ?? undefined,
  };
}

/**
 * Persist an AI agent event to Firestore.
 * Collection: ai_events
 * Document ID: <event.id>_<event.type>
 */
async function persistAIAgentEvent(event: AIAgentEvent): Promise<void> {
  try {
    if (!firestore) {
      console.warn(
        "[AI Agent] Firestore is not configured. Skipping persistence for event:",
        {
          id: event.id,
          type: event.type,
          agent: event.agent,
        }
      );
      return;
    }

    const docId = `${event.id}_${event.type}`;

    // Build a plain object and remove any undefined values (like errorMessage)
    const data: any = {
      ...event,
      createdAt: event.createdAt ?? new Date().toISOString(),
    };

    // Firestore does not allow undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    await firestore.collection("ai_events").doc(docId).set(data, { merge: true });

    console.log("[AI Agent] Event persisted to Firestore:", docId);
  } catch (err) {
    console.error("[AI Agent] Failed to persist event to Firestore:", err);
  }
}

/**
 * Placeholder for old per-AI blockchain integration.
 * We now rely on the unified event dispatcher for blockchain logging.
 * Keeping this here in case you still reference it somewhere else.
 */
async function dispatchBlockchainEventLegacy(event: AIAgentEvent): Promise<void> {
  console.log("[AI Agent] (legacy stub) Would dispatch event to blockchain:", {
    id: event.id,
    type: event.type,
    agent: event.agent,
    createdAt: event.createdAt,
  });
}

/**
 * Main entrypoint for executing an AI agent task.
 * - Emits a "requested" AI event (ai_events)
 * - Emits a unified "ai.task.requested" domain event
 * - Calls OpenAI
 * - Emits a "completed" AI event (ai_events)
 * - Emits a unified "ai.task.completed" domain event
 */
export async function executeAIAgentTask(
  payload: ExecuteAIAgentPayload
): Promise<{
  requestEvent: AIAgentTaskRequestedEvent;
  completedEvent: AIAgentTaskCompletedEvent;
}> {
  const { agent, input } = payload;

  const now = new Date().toISOString();
  const id = generateId();

  const requestEvent: AIAgentTaskRequestedEvent = {
    id,
    type: "AIAgentTaskRequested",
    agent,
    createdAt: now,
    input,
  };

  console.log("[AI Agent] Task requested:", requestEvent);

  // --- AI-specific history (ai_events) ---
  await persistAIAgentEvent(requestEvent);
  await dispatchBlockchainEventLegacy(requestEvent);

  // --- Unified event stream: ai.task.requested ---
  await recordDomainEvent({
    type: "ai.task.requested",
    source: "rentchain.api.ai",
    correlationId: id,
    metadata: {
      agent,
    },
    payload: {
      input,
    },
  });

  let output: unknown;
  let success = true;
  let errorMessage: string | undefined;

  try {
    const aiResult = await callOpenAIForAgent(agent, input);
    output = aiResult;
  } catch (err: any) {
    success = false;
    errorMessage =
      err?.message ||
      "Unknown error executing AI agent task (OpenAI call failed)";
    output = null;
    console.error("[AI Agent] Error executing task:", err);
  }

  const completedEvent: AIAgentTaskCompletedEvent = {
    id,
    type: "AIAgentTaskCompleted",
    agent,
    createdAt: new Date().toISOString(),
    input,
    output,
    success,
    errorMessage,
  };

  console.log("[AI Agent] Task completed:", completedEvent);

  // --- AI-specific history (ai_events) ---
  await persistAIAgentEvent(completedEvent);
  await dispatchBlockchainEventLegacy(completedEvent);

  // --- Unified event stream: ai.task.completed ---
  await recordDomainEvent({
    type: "ai.task.completed",
    source: "rentchain.api.ai",
    correlationId: id,
    metadata: {
      agent,
      success,
      errorMessage: errorMessage || undefined,
    },
    payload: {
      input,
      output,
    },
  });

  return { requestEvent, completedEvent };
}

/**
 * Optional convenience function if you want just the AI result in other services.
 * Internally still goes through event flow.
 */
export async function runAIAgentAndReturnOutput(
  payload: ExecuteAIAgentPayload
): Promise<{
  output: unknown;
  success: boolean;
  errorMessage?: string;
  events: AIAgentEvent[];
}> {
  const { requestEvent, completedEvent } = await executeAIAgentTask(payload);
  return {
    output: completedEvent.output,
    success: completedEvent.success,
    errorMessage: completedEvent.errorMessage,
    events: [requestEvent, completedEvent],
  };
}
