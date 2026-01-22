import type { KBEntry } from "./knowledgeBase";

const AUDIENCE_PREFIX = "audience:";

const normalizeTokens = (text: string) => {
  const rawTokens = text.toLowerCase().trim().split(/\s+/);
  const tokens: string[] = [];
  let audience: KBEntry["audience"];

  for (const token of rawTokens) {
    const cleaned = token.replace(/[^a-z0-9:]/g, "");
    if (!cleaned) {
      continue;
    }

    if (cleaned.startsWith(AUDIENCE_PREFIX)) {
      const value = cleaned.slice(AUDIENCE_PREFIX.length) as KBEntry["audience"];
      if (value === "landlord" || value === "tenant" || value === "general") {
        audience = value;
      }
      continue;
    }

    if (cleaned.length >= 2) {
      tokens.push(cleaned);
    }
  }

  return { tokens, audience };
};

export function searchKb(query: string, entries: KBEntry[], limit = 5): KBEntry[] {
  const { tokens, audience } = normalizeTokens(query);
  if (tokens.length === 0 && !audience) {
    return [];
  }

  const scored = entries
    .map((entry) => {
      const title = entry.title.toLowerCase();
      const body = entry.body.toLowerCase();
      const tags = entry.tags.map((tag) => tag.toLowerCase());
      let score = 0;

      for (const token of tokens) {
        if (title.includes(token)) {
          score += 4;
        }
        if (tags.some((tag) => tag.includes(token))) {
          score += 3;
        }
        if (body.includes(token)) {
          score += 1;
        }
      }

      if (audience && entry.audience === audience) {
        score += 4;
      }

      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.title.localeCompare(b.entry.title);
    })
    .slice(0, limit)
    .map((item) => item.entry);

  return scored;
}

export function snippetFor(entry: KBEntry, query: string): string {
  const { tokens } = normalizeTokens(query);
  const body = entry.body;
  const lower = body.toLowerCase();
  let matchIndex = -1;

  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1 && (matchIndex === -1 || index < matchIndex)) {
      matchIndex = index;
    }
  }

  if (matchIndex === -1) {
    return body.length > 160 ? `${body.slice(0, 160).trim()}...` : body;
  }

  const snippetLength = 180;
  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(body.length, start + snippetLength);
  const snippet = body.slice(start, end).trim();
  const prefix = start > 0 ? "..." : "";
  const suffix = end < body.length ? "..." : "";

  return `${prefix}${snippet}${suffix}`;
}
