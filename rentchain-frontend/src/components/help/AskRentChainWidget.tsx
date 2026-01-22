import React, { useState } from "react";
import { Link } from "react-router-dom";
import { KNOWLEDGE_BASE, KBEntry } from "../../help/knowledgeBase";
import { searchKb, snippetFor } from "../../help/searchKb";
import { track } from "../../lib/analytics";
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
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, boolean>>({});

  const scopedQuery = (textValue: string) =>
    audience && audience !== "general" ? `audience:${audience} ${textValue}` : textValue;

  const trackAsk = (textValue: string, resultsCount: number, trigger: "enter" | "button" | "prompt") => {
    const page = typeof window !== "undefined" ? window.location.pathname : "";
    track("ask_widget_search", {
      q_len: textValue.trim().length,
      results_count: resultsCount,
      page,
      audience,
      trigger,
    });
  };

  const trackFeedback = (resultsCount: number, helpful: boolean) => {
    const page = typeof window !== "undefined" ? window.location.pathname : "";
    track("ask_widget_feedback", {
      helpful,
      page,
      audience,
      results_count: resultsCount,
    });
  };

  const handleSend = (textValue: string, trigger: "enter" | "button" | "prompt") => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      return;
    }

    const results = searchKb(scopedQuery(trimmed), KNOWLEDGE_BASE, compact ? 3 : 5);
    const assistantText = results.length
      ? "Here are the closest answers:"
      : "Sorry, I could not find a match. Try another keyword or visit the Help Center.";
    trackAsk(trimmed, results.length, trigger);

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
      onClick={() => handleSend(label, "prompt")}
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
              const feedbackValue = feedbackByMessage[message.id];
              const feedbackLocked = feedbackValue !== undefined;
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
                      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                        <span style={{ color: text.muted, fontSize: "0.85rem" }}>Was this helpful?</span>
                        <Button
                          variant="ghost"
                          disabled={feedbackLocked}
                          aria-label="Helpful response"
                          style={{ padding: "6px 10px", opacity: feedbackLocked ? 0.6 : 1 }}
                          onClick={() => {
                            if (feedbackLocked) {
                              return;
                            }
                            setFeedbackByMessage((prev) => ({ ...prev, [message.id]: true }));
                            trackFeedback(message.results?.length ?? 0, true);
                          }}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={feedbackLocked}
                          aria-label="Not helpful response"
                          style={{ padding: "6px 10px", opacity: feedbackLocked ? 0.6 : 1 }}
                          onClick={() => {
                            if (feedbackLocked) {
                              return;
                            }
                            setFeedbackByMessage((prev) => ({ ...prev, [message.id]: false }));
                            trackFeedback(message.results?.length ?? 0, false);
                          }}
                        >
                          No
                        </Button>
                      </div>
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
                    handleSend(query, "enter");
                  }
                }}
              />
            </div>
            <Button
              onClick={() => handleSend(query, "button")}
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
