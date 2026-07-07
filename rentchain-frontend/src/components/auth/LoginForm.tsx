import React from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input } from "../ui/Ui";
import { spacing } from "../../styles/tokens";
import {
  authBannerStyle,
  authBodyStyle,
  authCardStyle,
  authEyebrowStyle,
  authHeadingStyle,
  authInputProps,
  authLabelTextStyle,
  authLinkStyle,
  authPalette,
  authPrimaryButtonStyle,
  authRoleBadgeStyle,
  authShellStyle,
} from "./authPageStyles";

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

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.xs,
  width: "100%",
};

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
    <div style={authShellStyle}>
      <Card elevated style={authCardStyle()}>
        <div style={authEyebrowStyle}>
          {eyebrow}
        </div>
        <h1
          style={authHeadingStyle}
        >
          {title}
        </h1>
        {roleLabel ? (
          <div style={authRoleBadgeStyle}>
            {roleLabel}
          </div>
        ) : null}
        <p style={{ ...authBodyStyle, marginBottom: spacing.sm }}>
          {subtitle}
        </p>

        {banner ? (
          <div style={authBannerStyle(banner.tone)}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{banner.title}</div>
            <div>{banner.body}</div>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm, width: "100%" }}
        >
          <label style={fieldLabelStyle}>
            <span style={authLabelTextStyle}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              placeholder="you@example.com"
              autoComplete="email"
              {...authInputProps({ width: "100%" })}
              required
            />
          </label>

          {passwordRequired ? (
            <label style={fieldLabelStyle}>
              <span style={authLabelTextStyle}>Password</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange?.(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                placeholder="Password"
                autoComplete="current-password"
                {...authInputProps({ width: "100%" })}
                required
              />
            </label>
          ) : null}

          {showForgotPassword ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Link
                to="/forgot-password"
                style={{ ...authLinkStyle, fontSize: "0.9rem" }}
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
              ...authPrimaryButtonStyle,
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
            color: error ? authPalette.danger : authPalette.muted,
          }}
        >
          {error || statusMessage || subtitle}
        </div>

        {footer ? (
          <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <div style={{ display: "contents", color: authPalette.muted }}>{footer}</div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default LoginForm;
