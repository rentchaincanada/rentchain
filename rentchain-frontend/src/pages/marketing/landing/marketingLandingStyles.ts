/**
 * marketingLandingStyles.ts
 * Marketing-only design tokens for the RentChain landing page.
 *
 * SCOPE: isolated to src/pages/marketing/. Do NOT migrate the whole app to these.
 * Values are the exact RentChain Design System token values.
 *
 * Usage: import { tokens } from "./marketingLandingStyles";
 * Prefer wiring these into CSS variables on the marketing page root, or into
 * your styling solution of choice (CSS Modules / styled / Tailwind theme extend).
 */

export const colors = {
  // Paper (warm neutrals)
  paper50: "#FCFAF6",
  paper100: "#FAF7F2", // page background
  paper200: "#F3EDE2", // tinted band
  paper300: "#E9E1D2",
  white: "#FFFFFF",
  // Ink (text)
  ink900: "#20251F",
  ink700: "#3C443B",
  ink500: "#5C665A",
  ink400: "#7C857A",
  ink200: "#C9CEC5",
  // Pine (primary)
  pine950: "#0E2A21",
  pine900: "#143A2E",
  pine700: "#1E5F4E",
  pine600: "#2A7460",
  pine500: "#3B8A73",
  pine200: "#BBD8CC",
  pine100: "#D9EAE2",
  pine50: "#ECF4F0",
  // Amber (accent)
  amber700: "#A8650F",
  amber600: "#C97F1F",
  amber500: "#E8A33D",
  amber100: "#F9ECD4",
  amber50: "#FCF5E7",
  // Navy (dark surfaces)
  navy950: "#0A1428",
  navy900: "#112240",
  navy700: "#1E3A5F",
  navy600: "#2B4A7A",
  navy500: "#3B5A99",
  navy200: "#B8CCEB",
  navy100: "#D9E5F7",
  navy50: "#EBF1FB",
  // Clay (danger) / Slate (info)
  clay600: "#A8402C",
  clay500: "#BC4B33",
  clay100: "#F6E0D9",
  slate600: "#3D6A8A",
  slate100: "#DFE9F0",
  // Inverse text + lines
  textInverse: "#F2F1EA",
  textInverseMuted: "#B9C6BE",
  border: "#E5DECF",
  borderStrong: "#CFC6B2",
  borderOnInverse: "rgba(242,241,234,0.16)",
} as const;

export const semantic = {
  surfacePage: colors.paper100,
  surfaceCard: colors.white,
  surfaceTint: colors.pine50,
  surfaceBand: colors.paper200,
  surfaceInverse: colors.navy950,
  textBody: colors.ink900,
  textSecondary: colors.ink700,
  textMuted: colors.ink500,
  textFaint: colors.ink400,
  brandPrimary: colors.pine700,
  brandPrimaryHover: colors.pine600,
  brandPrimaryActive: colors.pine900,
  brandAccent: colors.amber500,
  brandAccentHover: colors.amber600,
  // Status (record states)
  statusSuccess: colors.pine600,
  statusSuccessBg: colors.pine50,
  statusWarning: colors.amber700,
  statusWarningBg: colors.amber50,
  statusDanger: colors.clay600,
  statusDangerBg: colors.clay100,
  statusInfo: colors.slate600,
  statusInfoBg: colors.slate100,
  focusRing: "0 0 0 3px rgba(42,116,96,0.35)",
} as const;

export const typography = {
  fontDisplay: '"Source Serif 4", Georgia, "Times New Roman", serif',
  fontSans: '"Public Sans", -apple-system, "Segoe UI", sans-serif',
  fontMono: '"Spline Sans Mono", "SF Mono", Menlo, monospace',
  size: {
    xs: "0.75rem", // 12 — mono labels, legal
    sm: "0.875rem", // 14 — captions, meta
    base: "1rem", // 16 — body
    md: "1.125rem", // 18 — lead body
    lg: "1.375rem", // 22 — card titles
    xl: "1.75rem", // 28
    xxl: "2.25rem", // 36 — section titles
    xxxl: "3rem", // 48 — hero mobile
    xxxxl: "4rem", // 64 — hero desktop
  },
  // Fluid heads
  heroH1: "clamp(2.75rem, 6.5vw, 4.25rem)",
  sectionH2: "clamp(1.875rem, 3.5vw, 2.25rem)",
  leading: { tight: 1.1, snug: 1.25, normal: 1.55, relaxed: 1.7 },
  tracking: { tight: "-0.02em", normal: "0", wide: "0.08em" },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

export const radii = {
  sm: "6px",
  md: "10px",
  lg: "16px", // cards
  xl: "24px", // large panels / hero mockups
  panel: "28px", // final CTA panel
  pill: "999px",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(32,37,31,0.05), 0 4px 16px rgba(32,37,31,0.06)",
  raised: "0 2px 4px rgba(32,37,31,0.06), 0 12px 32px rgba(32,37,31,0.10)",
  button: "0 1px 2px rgba(14,42,33,0.25)",
} as const;

export const spacing = {
  s1: "0.25rem",
  s2: "0.5rem",
  s3: "0.75rem",
  s4: "1rem",
  s5: "1.5rem",
  s6: "2rem",
  s7: "3rem",
  s8: "4rem",
  s9: "6rem",
  s10: "8rem",
  sectionY: "clamp(4rem, 9vw, 6.5rem)",
  container: "1120px",
  containerPad: "clamp(1.25rem, 5vw, 2.5rem)",
} as const;

export const motion = {
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  durationFast: "150ms",
  durationBase: "250ms",
  durationReveal: "600ms",
  revealTransform: "translateY(22px)",
} as const;

export const layout = {
  container: "1120px",
  containerPad: "clamp(1.25rem, 5vw, 2.5rem)",
  sectionY: "clamp(4rem, 9vw, 6.5rem)",
  headerHeight: "72px",
  gridGap: "20px",
  breakpoints: {
    mobile: 720, // trust-flow → 2-col, connectors hidden
    heroVisual: 760, // hero network visual hidden below
    nav: 900, // inline nav → mobile menu below
  },
} as const;

// Reusable React inline-style objects (drop straight onto elements, or read as a spec).
export const cardStyles = {
  base: {
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.lg,
    boxShadow: shadows.card,
    padding: "22px",
  },
  tint: {
    // verified / positive summaries
    background: colors.pine50,
    border: `1px solid ${colors.pine100}`,
    borderRadius: radii.lg,
    boxShadow: shadows.card,
    padding: "20px 24px",
  },
  onDark: {
    background: "rgba(242,241,234,0.06)",
    border: "1px solid rgba(242,241,234,0.14)",
    borderRadius: radii.md,
    padding: "18px",
  },
} as const;

export const badgeStyleBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontFamily: typography.fontSans,
  fontSize: typography.size.xs,
  fontWeight: typography.weight.semibold,
  letterSpacing: "0.02em",
  padding: "0.2rem 0.625rem",
  borderRadius: radii.pill,
  border: "1px solid transparent",
} as const;

/**
 * Button style notes (map to the app's existing Button primitive where possible):
 * - accent (primary CTA): bg amber500, text ink900 (NOT white — contrast), pill,
 *   shadow.button; hover amber600; press: darker + scale(0.98).
 * - primary (pine): bg pine700; hover pine600; active pine900; text white.
 * - ghostOnDark: transparent, 1px rgba(242,241,234,0.28) border, text #F2F1EA;
 *   hover bg rgba(242,241,234,0.08).
 * - sizes: sm (header, ~0.5rem/1rem pad), lg (hero/CTA, ~0.85rem/1.5rem pad).
 * - focus: 3px pine ring (semantic.focusRing) on every button.
 */
export const buttonStyles = {
  accent: { background: colors.amber500, color: colors.ink900, boxShadow: shadows.button },
  accentHover: { background: colors.amber600 },
  primary: { background: colors.pine700, color: colors.white },
  primaryHover: { background: colors.pine600 },
  primaryActive: { background: colors.pine900 },
  ghostOnDark: {
    background: "transparent",
    color: colors.textInverse,
    border: "1px solid rgba(242,241,234,0.28)",
  },
  ghostOnDarkHover: { background: "rgba(242,241,234,0.08)" },
  pressScale: "scale(0.98)",
  focusRing: semantic.focusRing,
} as const;

// Dark hero ambient glow — the ONLY gradient permitted on the page.
export const heroGlow =
  "radial-gradient(120% 90% at 80% 0%, rgba(30,95,78,0.22) 0%, rgba(10,20,40,0) 55%)";

// Solid (scrolled) header surface.
export const headerSolid = {
  background: "rgba(250,247,242,0.9)",
  backdropFilter: "blur(14px)",
  borderBottom: `1px solid ${colors.border}`,
} as const;

// Badge theme presets (record status pills)
export const badgeThemes = {
  verified: { background: colors.pine50, color: colors.pine700, borderColor: colors.pine200 },
  pending: { background: colors.amber50, color: colors.amber700, borderColor: "#EFD9AC" },
  info: { background: colors.slate100, color: colors.slate600, borderColor: "#C3D5E2" },
  neutral: { background: colors.paper200, color: colors.ink700, borderColor: colors.border },
} as const;

export const tokens = {
  colors,
  semantic,
  typography,
  radii,
  shadows,
  spacing,
  motion,
  layout,
  cardStyles,
  badgeStyleBase,
  badgeThemes,
  buttonStyles,
  heroGlow,
  headerSolid,
} as const;

export type MarketingTokens = typeof tokens;
export default tokens;
