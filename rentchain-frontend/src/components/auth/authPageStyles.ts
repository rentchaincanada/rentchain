import type React from "react";

export const authPalette = {
  page: "#f4efe6",
  pageGlow:
    "radial-gradient(circle at 12% 12%, rgba(215, 173, 107, 0.18), transparent 32%), linear-gradient(135deg, #f4efe6 0%, #efe6d7 48%, #f8f3ea 100%)",
  card: "#fffaf1",
  field: "#fffdf8",
  fieldBorder: "rgba(105, 82, 49, 0.22)",
  fieldBorderFocus: "rgba(63, 54, 37, 0.72)",
  ink: "#171411",
  charcoal: "#2c2924",
  muted: "#5f5a51",
  subtle: "#756f64",
  button: "#171411",
  buttonHover: "#2c2924",
  link: "#171411",
  beige: "#eadfcd",
  beigeSoft: "rgba(234, 223, 205, 0.72)",
  sage: "#dfe4d5",
  sageBorder: "rgba(88, 103, 75, 0.22)",
  danger: "#b42318",
};

export const authShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: authPalette.page,
  backgroundImage: authPalette.pageGlow,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(16px, 5vw, 40px)",
  overflowX: "hidden",
  color: authPalette.ink,
};

export const signupAuthShellStyle: React.CSSProperties = {
  ...authShellStyle,
  backgroundImage: "linear-gradient(135deg, #f4efe6 0%, #efe6d7 48%, #f8f3ea 100%)",
};

export const authCardStyle = (
  width: string = "min(460px, 92vw)"
): React.CSSProperties => ({
  width,
  padding: "clamp(22px, 4vw, 32px)",
  background: authPalette.card,
  border: `1px solid ${authPalette.fieldBorder}`,
  boxShadow: "0 22px 52px rgba(69, 55, 33, 0.14)",
  color: authPalette.ink,
});

export const authEyebrowStyle: React.CSSProperties = {
  marginBottom: "0.5rem",
  color: authPalette.subtle,
  fontSize: "0.9rem",
  fontWeight: 700,
};

export const authHeadingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "0.5rem",
  fontSize: "1.65rem",
  fontWeight: 760,
  letterSpacing: "-0.02em",
  color: authPalette.ink,
};

export const authBodyStyle: React.CSSProperties = {
  marginTop: 0,
  color: authPalette.muted,
  lineHeight: 1.55,
};

export const authLabelTextStyle: React.CSSProperties = {
  color: authPalette.muted,
  fontSize: "0.9rem",
  fontWeight: 650,
};

export const authInputBaseStyle: React.CSSProperties = {
  background: authPalette.field,
  border: `1px solid ${authPalette.fieldBorder}`,
  color: authPalette.ink,
};

export function authInputProps(style?: React.CSSProperties): {
  style: React.CSSProperties;
  onFocus: (event: React.FocusEvent<HTMLInputElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
} {
  return {
    style: { ...authInputBaseStyle, ...style },
    onFocus: (event) => {
      event.currentTarget.style.borderColor = authPalette.fieldBorderFocus;
      event.currentTarget.style.boxShadow = "0 0 0 3px rgba(105, 82, 49, 0.22)";
    },
    onBlur: (event) => {
      event.currentTarget.style.borderColor = authPalette.fieldBorder;
      event.currentTarget.style.boxShadow = "none";
    },
  };
}

export const authTextareaStyle: React.CSSProperties = {
  ...authInputBaseStyle,
  width: "100%",
  padding: "10px 12px",
  borderRadius: "0.7rem",
  resize: "vertical",
  outline: "none",
};

export const authPrimaryButtonStyle: React.CSSProperties = {
  background: authPalette.button,
  color: "#fffaf1",
  boxShadow: "0 14px 26px rgba(23, 20, 17, 0.16)",
};

export const authSecondaryButtonStyle: React.CSSProperties = {
  background: authPalette.beigeSoft,
  color: authPalette.ink,
  border: `1px solid ${authPalette.fieldBorder}`,
  boxShadow: "none",
};

export const authGhostButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: authPalette.ink,
  border: `1px solid ${authPalette.fieldBorder}`,
  boxShadow: "none",
};

export const authLinkStyle: React.CSSProperties = {
  color: authPalette.link,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  fontWeight: 700,
};

export const authMutedLinkStyle: React.CSSProperties = {
  color: authPalette.muted,
  textDecoration: "none",
  fontWeight: 650,
};

export const authRoleBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  marginBottom: "0.75rem",
  padding: "5px 10px",
  borderRadius: 999,
  border: `1px solid ${authPalette.sageBorder}`,
  background: authPalette.sage,
  color: authPalette.ink,
  fontSize: "0.82rem",
  fontWeight: 750,
};

export const authBannerStyle = (tone: "info" | "warning" = "info"): React.CSSProperties => ({
  marginBottom: "0.75rem",
  padding: "10px 12px",
  borderRadius: 12,
  background: tone === "warning" ? "rgba(254, 242, 242, 0.92)" : authPalette.sage,
  border:
    tone === "warning"
      ? "1px solid rgba(180, 35, 24, 0.24)"
      : `1px solid ${authPalette.sageBorder}`,
  color: tone === "warning" ? authPalette.danger : authPalette.ink,
  fontSize: "0.9rem",
});
