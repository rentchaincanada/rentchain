// src/components/ui/Ui.tsx
import React from "react";
import { colors, radius, shadows, spacing, text } from "../../styles/tokens";

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }
> = ({ children, style, elevated = false, ...rest }) => {
  return (
    <div
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
};

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
  variant?: "primary" | "secondary" | "ghost";
};

export const Button: React.FC<ButtonProps> = ({
  children,
  style,
  variant = "primary",
  ...rest
}) => {
  const base: React.CSSProperties = {
    borderRadius: radius.pill,
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: "pointer",
    transition: "background 0.15s ease, transform 0.12s ease, box-shadow 0.12s ease",
    border: "none",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: colors.accent,
      color: "#fff",
      boxShadow: shadows.sm,
    },
    secondary: {
      background: colors.accentSoft,
      color: text.primary,
      border: `1px solid ${colors.border}`,
    },
    ghost: {
      background: "transparent",
      color: text.primary,
      border: `1px solid ${colors.border}`,
    },
  };

  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translateY(1px)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
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
          width: "100%",
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
