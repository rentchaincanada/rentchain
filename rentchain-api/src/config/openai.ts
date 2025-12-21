// src/config/openai.ts

import OpenAI from "openai";

/**
 * Singleton OpenAI client for the whole API.
 *
 * Make sure OPENAI_API_KEY is set in your environment.
 */
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️ [OpenAI] OPENAI_API_KEY is not set. AI calls will fail until you configure it."
  );
}
