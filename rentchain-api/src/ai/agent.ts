// src/ai/agent.ts

import OpenAI from "openai";

interface AIInsightRequestedPayload {
  requestId: string;
  inputType: string;
  inputData: any;
}

interface AIInsightResult {
  requestId: string;
  inputType: string;
  output: {
    summary: string;
    recommendation: string;
    echo: any;
    riskScore: number;
    generatedAt: string;
    source: "openai" | "fallback";
  };
}

// Create client only if we have an API key
const openAIClient =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

async function getAIOutputWithOpenAI(
  inputType: string,
  inputData: any
): Promise<{ summary: string; riskScore: number; recommendation: string }> {
  if (!openAIClient) {
    throw new Error("Provider client not configured");
  }

  const systemPrompt = `
You are an assistant for a landlord/tenant platform called RentChain.

Given:
- an "inputType" describing the context (e.g. "demo", "rent_payment_analysis")
- "inputData" as JSON (tenant payment history, rent amount, notes, etc.),

respond with a SINGLE JSON object ONLY, no extra text, in this exact shape:

{
  "summary": "short human-readable summary of your analysis",
  "riskScore": 0.0,
  "recommendation": "clear next action for the landlord"
}

Rules:
- "riskScore" must be a number between 0 and 1 (higher = higher risk for the landlord).
- "summary" should be 1–3 sentences max.
- "recommendation" should be 1–2 sentences with a concrete action (e.g., monitor, offer plan, escalate).
- Do NOT include backticks or any explanation, just raw JSON.
`;

  const userContent = `inputType: ${inputType}\ninputData JSON:\n${JSON.stringify(
    inputData
  )}`;

  const completion = await openAIClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  });

  const rawText = completion.choices[0]?.message?.content ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error("Failed to parse provider JSON: " + rawText);
  }

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.riskScore !== "number" ||
    typeof parsed.recommendation !== "string"
  ) {
    throw new Error("Provider JSON missing required fields");
  }

  const riskScore = Math.min(1, Math.max(0, parsed.riskScore));

  return {
    summary: parsed.summary,
    riskScore,
    recommendation: parsed.recommendation
  };
}

/**
 * AI agent:
 * - If OPENAI_API_KEY is set: uses the configured provider model
 * - Otherwise: uses a simple fallback stub
 */
export async function runAIAgent(
  payload: AIInsightRequestedPayload
): Promise<AIInsightResult> {
  const { requestId, inputType, inputData } = payload;

  let summary: string;
  let riskScore: number;
  let recommendation: string;
  let source: "openai" | "fallback" = "fallback";

  if (openAIClient) {
    try {
      const ai = await getAIOutputWithOpenAI(inputType, inputData);
      summary = ai.summary;
      riskScore = ai.riskScore;
      recommendation = ai.recommendation;
      source = "openai";
    } catch (err: any) {
      console.error("[AI] Provider error, falling back:", err?.message || err);
      summary = `Fallback AI: processed input type "${inputType}" (provider error)`;
      riskScore = Math.random();
      recommendation =
        "Review this tenant's payment history manually and consider adding internal notes until AI is fully available.";
      source = "fallback";
    }
  } else {
    console.warn(
      "[AI] No OPENAI_API_KEY set – using fallback random stub instead."
    );
    summary = `Fallback AI: processed input type "${inputType}" (no provider key configured)`;
    riskScore = Math.random();
    recommendation =
      "Ensure AI configuration is complete, then re-run the analysis. In the meantime, rely on standard screening and payment history.";
    source = "fallback";
  }

  return {
    requestId,
    inputType,
    output: {
      summary,
      recommendation,
      echo: inputData,
      riskScore,
      generatedAt: new Date().toISOString(),
      source
    }
  };
}
