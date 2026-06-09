import React from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input } from "../ui/Ui";
import { colors, spacing, text } from "../../styles/tokens";

export type LoginFormBanner = {
  title: string;
  body: string;
  tone?: "info" | "warning";
};

type LoginFormProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  roleLabel?: string;
  email: string;
  onEmailChange: (value: string) => void;
  password?: string;
  onPasswordChange?: (value: string) => void;
  passwordRequired?: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  loadingLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string | null;
  statusMessage?: string;
  banner?: LoginFormBanner | null;
  showForgotPassword?: boolean;
  demoAction?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
};

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: colors.bg,
  backgroundImage: colors.bgAmbient,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(16px, 5vw, 40px)",
  overflowX: "hidden",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.xs,
  width: "100%",
};

const bannerStyle = (tone: LoginFormBanner["tone"] = "info"): React.CSSProperties => ({
  marginBottom: spacing.sm,
  padding: "8px 12px",
  borderRadius: 10,
  background: tone === "warning" ? "rgba(239,68,68,0.08)" : "rgba(37,99,235,0.08)",
  border: tone === "warning" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(37,99,235,0.25)",
  color: tone === "warning" ? colors.danger : "#1d4ed8",
  fontSize: "0.9rem",
});

export const LoginForm: React.FC<LoginFormProps> = ({
  eyebrow = "RentChain Secure Access",
  title,
  subtitle,
  roleLabel,
  email,
  onEmailChange,
  password = "",
  onPasswordChange,
  passwordRequired = true,
  onSubmit,
  submitLabel = "Sign in",
  loadingLabel = "Signing in...",
  isLoading = false,
  disabled = false,
  error = null,
  statusMessage,
  banner,
  showForgotPassword = true,
  demoAction,
  footer,
  children,
}) => {
  return (
    <div style={shellStyle}>
      <Card elevated style={{ width: "min(460px, 92vw)", padding: spacing.lg }}>
        <div style={{ marginBottom: spacing.xs, color: text.subtle, fontSize: "0.9rem" }}>
          {eyebrow}
        </div>
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            marginBottom: spacing.xs,
            letterSpacing: "-0.01em",
            color: text.primary,
          }}
        >
          {title}
        </h1>
        {roleLabel ? (
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              marginBottom: spacing.sm,
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.accentSoft,
              color: text.primary,
              fontSize: "0.82rem",
              fontWeight: 700,
            }}
          >
            {roleLabel}
          </div>
        ) : null}
        <p style={{ marginTop: 0, marginBottom: spacing.sm, color: text.muted }}>
          {subtitle}
        </p>

        {banner ? (
          <div style={bannerStyle(banner.tone)}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{banner.title}</div>
            <div>{banner.body}</div>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm, width: "100%" }}
        >
          <label style={fieldLabelStyle}>
            <span style={{ fontSize: "0.9rem", color: text.muted }}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              placeholder="you@example.com"
              autoComplete="email"
              style={{ width: "100%" }}
              required
            />
          </label>

          {passwordRequired ? (
            <label style={fieldLabelStyle}>
              <span style={{ fontSize: "0.9rem", color: text.muted }}>Password</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange?.(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                placeholder="Password"
                autoComplete="current-password"
                style={{ width: "100%" }}
                required
              />
            </label>
          ) : null}

          {showForgotPassword ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Link
                to="/forgot-password"
                style={{ color: colors.accent, fontWeight: 600, fontSize: "0.9rem" }}
              >
                Forgot password?
              </Link>
            </div>
          ) : null}

          {children}

          <Button
            type="submit"
            disabled={isLoading || disabled}
            style={{
              width: "100%",
              opacity: isLoading || disabled ? 0.8 : 1,
              cursor: isLoading || disabled ? "not-allowed" : "pointer",
              justifyContent: "center",
            }}
          >
            {isLoading ? loadingLabel : submitLabel}
          </Button>

          {demoAction}
        </form>

        <div
          role={error ? "alert" : "status"}
          aria-live="polite"
          style={{
            marginTop: spacing.sm,
            minHeight: "1.2rem",
            fontSize: "0.9rem",
            color: error ? colors.danger : text.muted,
          }}
        >
          {error || statusMessage || subtitle}
        </div>

        {footer ? (
          <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default LoginForm;
