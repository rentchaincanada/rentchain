import type React from "react";
import {
  authBodyStyle,
  authCardStyle,
  authGhostButtonStyle,
  authLinkStyle,
  authPalette,
  authPrimaryButtonStyle,
  authRoleBadgeStyle,
  authSecondaryButtonStyle,
  authShellStyle,
} from "../../components/auth/authPageStyles";

export const tenantEntryShellStyle: React.CSSProperties = {
  ...authShellStyle,
  alignItems: "stretch",
  padding: 0,
};

export const tenantEntryContainerStyle: React.CSSProperties = {
  width: "min(1120px, 100%)",
  margin: "0 auto",
  padding: "clamp(24px, 5vw, 52px) clamp(16px, 4vw, 32px) 56px",
  display: "grid",
  gap: 32,
};

export const tenantEntryCardStyle = (width: string = "min(560px, 92vw)") => authCardStyle(width);

export const tenantEntryPrimaryLinkStyle: React.CSSProperties = {
  ...authPrimaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 750,
};

export const tenantEntrySecondaryLinkStyle: React.CSSProperties = {
  ...authSecondaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 750,
};

export const tenantEntryGhostButtonStyle: React.CSSProperties = {
  ...authGhostButtonStyle,
  padding: "10px 12px",
  borderRadius: 10,
  fontWeight: 750,
  cursor: "pointer",
};

export const tenantEntryInfoCardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: `1px solid ${authPalette.fieldBorder}`,
  background: "rgba(255, 250, 241, 0.86)",
  boxShadow: "0 18px 42px rgba(69, 55, 33, 0.1)",
  padding: "20px 22px",
  display: "grid",
  gap: 10,
  color: authPalette.ink,
};

export const tenantEntryBadgeStyle: React.CSSProperties = {
  ...authRoleBadgeStyle,
  marginBottom: 0,
};

export const tenantEntryBodyStyle = authBodyStyle;
export const tenantEntryLinkStyle = authLinkStyle;
export { authPalette as tenantEntryPalette };
