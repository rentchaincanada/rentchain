// src/components/ui/Ui.tsx
import React from "react";
import { colors, radius, shadows, spacing, text } from "../../styles/tokens";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }
>(({ children, style, elevated = false, ...rest }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        background: colors.card,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        boxShadow: elevated ? shadows.md : shadows.sm,
        padding: spacing.lg,
        color: text.primary,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
Card.displayName = "Card";

export const Section: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...rest
}) => {
  return (
    <div
      style={{
        background: colors.panel,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.sm,
        padding: spacing.md,
        color: text.primary,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "navy";
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  style,
  variant = "primary",
  ...rest
}) => {
  const disabled = Boolean(rest.disabled);
  const base: React.CSSProperties = {
    borderRadius: radius.pill,
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s ease, transform 0.12s ease, box-shadow 0.12s ease",
    border: "none",
    opacity: disabled ? 0.62 : 1,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: colors.pine,
      color: "#fff",
      boxShadow: shadows.sm,
    },
    navy: {
      background: colors.navy,
      color: "#fff",
      boxShadow: shadows.sm,
    },
    secondary: {
      background: colors.paper,
      color: text.primary,
      border: `1px solid ${colors.borderStrong}`,
    },
    ghost: {
      background: "transparent",
      color: text.primary,
      border: `1px solid ${colors.border}`,
    },
  };

  return (
    <button
      className={["rc-ui-button", className].filter(Boolean).join(" ")}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => {
        if (e.currentTarget.disabled) return;
        e.currentTarget.style.transform = "translateY(1px)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
    </button>
  );
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ style, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        style={{
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          minHeight: 42,
          padding: "10px 12px",
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          background: colors.card,
          color: text.primary,
          outline: "none",
          boxShadow: "none",
          transition: "border-color 0.12s ease, box-shadow 0.12s ease",
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = colors.accentSoft;
          e.currentTarget.style.boxShadow = shadows.focus;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.boxShadow = "none";
        }}
        {...rest}
      />
    );
  }
);
Input.displayName = "Input";

export const Pill: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & { tone?: "accent" | "muted" }
> = ({ children, style, tone = "muted", ...rest }) => {
  const tones: Record<string, React.CSSProperties> = {
    accent: {
      background: colors.accentSoft,
      color: colors.accent,
    },
    muted: {
      background: "#f1f5f9",
      color: text.muted,
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: radius.pill,
        fontSize: "0.85rem",
        fontWeight: 600,
        border: `1px solid ${colors.border}`,
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
};

export const SkeletonBlock: React.FC<{
  lines?: number;
  height?: number;
  label?: string;
  style?: React.CSSProperties;
}> = ({ lines = 3, height = 14, label = "Loading", style }) => (
  <div
    role="status"
    aria-live="polite"
    aria-label={label}
    style={{
      display: "grid",
      gap: spacing.sm,
      width: "100%",
      ...style,
    }}
  >
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={index}
        style={{
          height,
          width: index === lines - 1 ? "72%" : "100%",
          borderRadius: radius.pill,
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.06), rgba(37,99,235,0.12), rgba(15,23,42,0.06))",
          border: `1px solid ${colors.border}`,
        }}
      />
    ))}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  body: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, body, action, style }) => (
  <div
    style={{
      display: "grid",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      border: `1px solid ${colors.border}`,
      background: colors.panel,
      color: text.primary,
      ...style,
    }}
  >
    <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
    <div style={{ color: text.muted, lineHeight: 1.55 }}>{body}</div>
    {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
  </div>
);

export const InlineError: React.FC<{
  title?: string;
  message: string;
  retry?: () => void;
  style?: React.CSSProperties;
}> = ({ title = "Unable to load this section", message, retry, style }) => (
  <div
    role="alert"
    style={{
      display: "grid",
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: radius.md,
      border: "1px solid rgba(239,68,68,0.22)",
      background: "rgba(254,242,242,0.95)",
      color: "#991b1b",
      ...style,
    }}
  >
    <div style={{ fontWeight: 800 }}>{title}</div>
    <div style={{ color: "#7f1d1d", lineHeight: 1.5 }}>{message}</div>
    {retry ? (
      <Button
        type="button"
        variant="ghost"
        onClick={retry}
        style={{ width: "fit-content", color: "#991b1b", borderColor: "rgba(239,68,68,0.28)" }}
      >
        Try again
      </Button>
    ) : null}
  </div>
);
