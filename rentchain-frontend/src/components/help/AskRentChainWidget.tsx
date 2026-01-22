import React, { useState } from "react";
import { Link } from "react-router-dom";
import { KNOWLEDGE_BASE, KBEntry } from "../../help/knowledgeBase";
import { searchKb, snippetFor } from "../../help/searchKb";
import { Button, Card, Input, Pill } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";

type Audience = "landlord" | "tenant" | "general";

type WidgetMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  results?: KBEntry[];
};

type WidgetProps = {
  audience?: Audience;
  defaultOpen?: boolean;
  compact?: boolean;
};

const promptSuggestions = [
  "Invite a tenant",
  "How screening works",
  "Download templates",
  "Contact support",
];

const audienceLabel = (audience: Audience) => {
  if (audience === "landlord") {
    return "Landlord";
  }
  if (audience === "tenant") {
    return "Tenant";
  }
  return "General";
};

export const AskRentChainWidget: React.FC<WidgetProps> = ({
  audience = "general",
  defaultOpen = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>([]);

  const scopedQuery = (textValue: string) =>
    audience && audience !== "general" ? `audience:${audience} ${textValue}` : textValue;

  const handleSend = (textValue: string) => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      return;
    }

    const results = searchKb(scopedQuery(trimmed), KNOWLEDGE_BASE, compact ? 3 : 5);
    const assistantText = results.length
      ? "Here are the closest answers:"
      : "Sorry, I could not find a match. Try another keyword or visit the Help Center.";

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: trimmed },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: assistantText,
        results,
      },
    ]);
    setQuery("");
  };

  const promptButtons = promptSuggestions.map((label) => (
    <Button
      key={label}
      variant="ghost"
      style={{
        padding: compact ? "6px 10px" : "8px 12px",
        fontSize: compact ? "0.8rem" : "0.85rem",
        borderRadius: radius.pill,
      }}
      onClick={() => handleSend(label)}
      aria-label={`Search: ${label}`}
    >
      {label}
    </Button>
  ));

  return (
    <Card
      style={{
        padding: compact ? spacing.md : spacing.lg,
        background: colors.panel,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
        <div>
          <h2 style={{ margin: 0, fontSize: compact ? "1.1rem" : "1.3rem" }}>
            Ask RentChain
          </h2>
          {!compact && (
            <p style={{ marginTop: spacing.xs, marginBottom: 0, color: text.muted }}>
              Search our Help Center for instant answers.
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          style={{
            padding: compact ? "6px 10px" : "8px 12px",
            fontSize: compact ? "0.8rem" : "0.85rem",
          }}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Collapse Ask RentChain widget" : "Expand Ask RentChain widget"}
        >
          {isOpen ? "Collapse" : "Ask"}
        </Button>
      </div>

      {isOpen && (
        <div style={{ marginTop: spacing.md, display: "flex", flexDirection: "column", gap: spacing.md }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>{promptButtons}</div>

          <div
            role="log"
            aria-live="polite"
            style={{
              background: colors.card,
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              padding: spacing.md,
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
              minHeight: compact ? 140 : 180,
              maxHeight: compact ? 260 : 320,
              overflowY: "auto",
            }}
          >
            {messages.length === 0 && (
              <div style={{ color: text.muted }}>
                Ask a question and I will suggest the closest Help Center matches.
              </div>
            )}
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    background: isUser ? colors.accentSoft : colors.panel,
                    border: `1px solid ${colors.border}`,
                    color: text.primary,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: spacing.xxs }}>
                    {isUser ? "You" : "RentChain"}
                  </div>
                  <div style={{ color: text.secondary }}>{message.text}</div>
                  {!isUser && message.results && message.results.length > 0 && (
                    <div style={{ marginTop: spacing.sm, display: "grid", gap: spacing.sm }}>
                      {message.results.map((result) => (
                        <div
                          key={result.id}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: radius.sm,
                            padding: spacing.sm,
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                            <Link to={result.url} style={{ color: colors.accent, fontWeight: 600 }}>
                              {result.title}
                            </Link>
                            {result.audience && (
                              <Pill tone="muted" style={{ textTransform: "capitalize" }}>
                                {audienceLabel(result.audience)}
                              </Pill>
                            )}
                          </div>
                          <div style={{ marginTop: spacing.xs, color: text.muted, fontSize: "0.9rem" }}>
                            {snippetFor(result, scopedQuery(message.text))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the Help Center"
                aria-label="Ask RentChain search"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSend(query);
                  }
                }}
              />
            </div>
            <Button
              onClick={() => handleSend(query)}
              aria-label="Send search query"
              style={{ padding: compact ? "8px 12px" : "10px 16px" }}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AskRentChainWidget;
