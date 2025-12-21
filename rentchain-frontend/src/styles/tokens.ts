// src/styles/tokens.ts
// 2030 design system tokens (light, premium, soft glass)

export const spacing = {
  xxs: "0.25rem", // 4px
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  xxl: "3rem", // 48px
};

export const radius = {
  sm: "0.4rem",
  md: "0.7rem",
  lg: "1rem",
  xl: "1.25rem",
  pill: "999px",
};

export const text = {
  primary: "#0f172a",
  secondary: "#1f2937",
  muted: "#4b5563",
  subtle: "#6b7280",
};

export const blur = {
  sm: "blur(10px)",
  md: "blur(16px)",
};

export const colors = {
  bg: "#f7f9fc",
  bgAmbient:
    "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(14,165,233,0.05) 40%, rgba(255,255,255,0.35))",
  panel: "#ffffff",
  card: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  borderStrong: "rgba(15,23,42,0.16)",
  accent: "#2563eb",
  accentSoft: "rgba(37,99,235,0.12)",
  danger: "#ef4444",
};

export const shadows = {
  sm: "0 1px 2px rgba(15,23,42,0.08)",
  md: "0 8px 24px rgba(15,23,42,0.12)",
  lg: "0 16px 40px rgba(15,23,42,0.14)",
  soft: "0 12px 30px rgba(15,23,42,0.12)",
  pop: "0 22px 50px rgba(15,23,42,0.16)",
  focus: "0 0 0 3px rgba(37,99,235,0.35)",
};

export const effects = {
  glassBg: "rgba(255,255,255,0.78)",
  glassBorder: "rgba(15,23,42,0.08)",
};

// Legacy surface aliases (kept for compatibility)
export const surfaces = {
  page: colors.bg,
  card: colors.card,
  raised: colors.panel,
  elevated: colors.panel,
  base: colors.card,
  border: colors.border,
};

export const typography = {
  fontFamily:
    "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  h1: "1.6rem",
  h2: "1.3rem",
  h3: "1.1rem",
  body: "0.95rem",
  small: "0.8rem",
};

export const layout = {
  maxWidth: 1200,
  navHeight: 60,
  contentPadding: "2rem",
  gutter: "1.5rem",
  pagePadding: "1.75rem",
};
