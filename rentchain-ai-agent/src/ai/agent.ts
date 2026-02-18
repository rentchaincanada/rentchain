// src/ai/agent.ts

import { emitEvent } from "../events/emitter";

interface AIInsightRequestedPayload {
  requestId: string;
  inputType: string;
  inputData: any;
}

export async function runAIAgent(event: any) {
  try {
    const payload = event?.payload as AIInsightRequestedPayload | undefined;

    if (!payload) {
      throw new Error("Missing payload on AIInsightRequested event");
    }

    const { requestId, inputType, inputData } = payload;

    // ---- TEMP AI LOGIC (stub) ----
    // Later this is where we call the provider model.
    const output = {
      summary: \`AI processed input type: \${inputType}\`,
      echo: inputData,
      riskScore: Math.random(), // placeholder
      generatedAt: new Date().toISOString()
    };

    await emitEvent("AIInsightGenerated", {
      requestId,
      inputType,
      output
    });

    console.log("[AI] AIInsightGenerated emitted for requestId:", requestId);
  } catch (err: any) {
    console.error("[AI] Error in runAIAgent:", err?.message || err);

    // Best-effort error event
    await emitEvent("AIAgentError", {
      requestId: event?.payload?.requestId ?? "unknown",
      error: err?.message ?? "Unknown AI error"
    });
  }
}
