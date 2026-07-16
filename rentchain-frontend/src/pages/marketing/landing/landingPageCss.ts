import { tokens } from "./marketingLandingStyles";

const { colors, semantic, typography } = tokens;

export const landingPageCss = `
.rc-landing {
  --rc-paper: ${colors.paper100};
  --rc-paper-band: ${colors.paper200};
  --rc-card: ${colors.white};
  --rc-ink: ${colors.ink900};
  --rc-muted: ${colors.ink500};
  --rc-pine: ${colors.pine700};
  --rc-pine-dark: ${colors.pine950};
  --rc-amber: ${colors.amber500};
  --rc-navy: ${colors.navy950};
  --rc-line: ${colors.border};
  --rc-focus: ${semantic.focusRing};
  min-height: 100vh;
  background: var(--rc-paper);
  color: var(--rc-ink);
  font-family: ${typography.fontSans};
  overflow-x: hidden;
}

.rc-landing *,
.rc-landing *::before,
.rc-landing *::after {
  box-sizing: border-box;
}

.rc-landing a {
  color: inherit;
  text-decoration: none;
}

.rc-landing a:focus-visible,
.rc-landing button:focus-visible {
  outline: none;
  box-shadow: var(--rc-focus);
}

.rc-landing button {
  font: inherit;
}

.rc-container {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
}

.rc-marketing-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(229, 222, 207, 0.82);
  background: rgba(252, 250, 246, 0.94);
  backdrop-filter: blur(18px);
}

.rc-marketing-header__inner {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.rc-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  color: var(--rc-pine-dark);
}

.rc-brand img {
  width: 34px;
  height: 34px;
}

.rc-brand__text {
  font-family: ${typography.fontDisplay};
  font-size: 1.4rem;
}

.rc-header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rc-header-nav a,
.rc-header-nav button,
.rc-mobile-link {
  border-radius: 999px;
  padding: 9px 12px;
  color: ${colors.ink700};
  font-weight: 700;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.rc-header-nav a:hover,
.rc-header-nav button:hover,
.rc-mobile-link:hover {
  background: ${colors.pine50};
  color: ${colors.pine900};
}

.rc-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rc-login-menu {
  position: relative;
}

.rc-login-menu__panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 278px;
  padding: 10px;
  border: 1px solid var(--rc-line);
  border-radius: 14px;
  background: ${colors.white};
  box-shadow: 0 18px 50px rgba(32, 37, 31, 0.16);
  animation: rc-menu-enter 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes rc-menu-enter {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

.rc-login-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  color: ${colors.ink700};
  font-weight: 750;
}

.rc-login-option:hover {
  background: ${colors.paper100};
}

.rc-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.rc-mobile-toggle.rc-button {
  display: none;
}

.rc-mobile-menu {
  display: none;
  padding: 0 0 16px;
}

.rc-button,
.rc-link-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 11px 18px;
  font-weight: 800;
  cursor: pointer;
}

.rc-button--accent,
.rc-link-button--accent {
  background: var(--rc-amber);
  color: ${colors.ink900};
  box-shadow: 0 1px 2px rgba(14, 42, 33, 0.25);
}

.rc-landing .rc-button--primary,
.rc-landing .rc-link-button--primary {
  background: var(--rc-pine);
  color: ${colors.white};
}

.rc-button--ghost,
.rc-link-button--ghost {
  background: transparent;
  border-color: ${colors.borderStrong};
  color: ${colors.ink700};
}

.rc-button--dark,
.rc-link-button--dark {
  background: transparent;
  border-color: rgba(242, 241, 234, 0.28);
  color: ${colors.textInverse};
}

.rc-hero {
  position: relative;
  background: ${colors.navy950};
  color: ${colors.textInverse};
  overflow: hidden;
}

.rc-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, rgba(10, 20, 40, 0) 42%, rgba(30, 95, 78, 0.14) 100%);
  pointer-events: none;
}

.rc-hero__inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
  align-items: center;
  gap: 44px;
  min-height: min(780px, calc(100vh - 72px));
  padding: 82px 0 88px;
}

.rc-kicker {
  margin: 0 0 14px;
  color: ${colors.pine600};
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rc-hero .rc-kicker {
  color: ${colors.amber500};
}

.rc-hero h1,
.rc-section-title {
  font-family: ${typography.fontDisplay};
  letter-spacing: 0;
}

.rc-hero h1 {
  margin: 0;
  max-width: 780px;
  font-size: clamp(3.4rem, 6.4vw, 5.45rem);
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.rc-hero__accent {
  color: ${colors.amber500};
}

.rc-hero__subtitle {
  margin: 22px 0 0;
  max-width: 700px;
  color: ${colors.textInverseMuted};
  font-size: clamp(1.04rem, 1.6vw, 1.2rem);
  line-height: 1.68;
}

.rc-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 28px;
}

.rc-microcopy {
  margin: 14px 0 0;
  color: ${colors.textInverseMuted};
  font-size: 0.9rem;
}

.rc-personas {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.rc-persona-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(242, 241, 234, 0.16);
  border-radius: 999px;
  padding: 7px 10px;
  color: ${colors.textInverseMuted};
  font-size: 0.86rem;
  font-weight: 700;
}

.rc-hero-visual {
  position: relative;
  border: 1px solid rgba(242, 241, 234, 0.16);
  border-radius: 28px;
  padding: 18px;
  background: rgba(242, 241, 234, 0.055);
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.rc-hero-visual::after {
  content: "";
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(187, 216, 204, 0.08);
  border-radius: 21px;
  pointer-events: none;
}

.rc-record-header,
.rc-record-footer,
.rc-command-panel__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.rc-record-header {
  padding: 4px 4px 16px;
  border-bottom: 1px solid rgba(242, 241, 234, 0.12);
  margin-bottom: 14px;
}

.rc-record-header div { display: grid; gap: 3px; }
.rc-record-header span,
.rc-record-footer { color: ${colors.textInverseMuted}; font-size: 0.75rem; }
.rc-record-header strong { font-size: 0.9rem; }
.rc-system-live { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.rc-system-live i { width: 7px; height: 7px; border-radius: 50%; background: ${colors.pine500}; box-shadow: 0 0 0 5px rgba(59, 138, 115, 0.12); }
.rc-record-footer { padding: 15px 4px 3px; border-top: 1px solid rgba(242, 241, 234, 0.12); margin-top: 14px; }

.rc-ledger {
  display: grid;
  gap: 12px;
}

.rc-ledger-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid rgba(242, 241, 234, 0.14);
  border-radius: 14px;
  padding: 14px;
  background: rgba(10, 20, 40, 0.46);
}

.rc-ledger-row strong,
.rc-ledger-row span {
  display: block;
}

.rc-ledger-row span {
  color: ${colors.textInverseMuted};
  font-size: 0.86rem;
}

.rc-section {
  padding: clamp(72px, 9vw, 112px) 0;
}

.rc-section[id] { scroll-margin-top: 88px; }

.rc-problem {
  background: ${colors.paper50};
  border-bottom: 1px solid ${colors.border};
}

.rc-problem-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.18fr);
  gap: clamp(32px, 8vw, 96px);
  align-items: start;
}

.rc-problem-copy { display: grid; gap: 18px; }
.rc-problem-copy p { margin: 0; color: ${colors.ink700}; font-size: 1.12rem; line-height: 1.75; }

.rc-section--band {
  background: var(--rc-paper-band);
}

.rc-section--dark {
  background: ${colors.navy950};
  color: ${colors.textInverse};
}

.rc-section-heading {
  max-width: 760px;
  margin-bottom: 34px;
}

.rc-section-title {
  margin: 0;
  font-size: clamp(2rem, 3.9vw, 2.65rem);
  font-weight: 800;
  line-height: 1.1;
}

.rc-section-subtitle {
  margin: 14px 0 0;
  max-width: 760px;
  color: var(--rc-muted);
  font-size: 1rem;
  line-height: 1.7;
}

.rc-section--dark .rc-section-subtitle {
  color: ${colors.textInverseMuted};
}

.rc-card,
.rc-panel {
  border: 1px solid var(--rc-line);
  border-radius: 16px;
  background: var(--rc-card);
  box-shadow: 0 1px 2px rgba(32, 37, 31, 0.05), 0 4px 16px rgba(32, 37, 31, 0.06);
}

.rc-card {
  padding: 22px;
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

@media (hover: hover) {
  .rc-card:hover { transform: translateY(-3px); border-color: ${colors.pine200}; box-shadow: 0 16px 36px rgba(32, 37, 31, 0.09); }
}

.rc-panel {
  padding: 28px;
}

.rc-trust-flow {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 112px minmax(300px, 0.92fr);
  gap: 0;
  align-items: center;
  position: relative;
}

.rc-trust-role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  position: relative;
  z-index: 2;
}

.rc-trust-connectors {
  width: 100%;
  min-height: 230px;
  align-self: stretch;
  position: relative;
  z-index: 1;
}

.rc-trust-connectors path {
  fill: none;
  stroke: ${colors.pine200};
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rc-trust-mobile-connector {
  display: none;
}

.rc-trust-node {
  position: relative;
}

.rc-trust-hub {
  border-color: ${colors.pine200};
  background: ${colors.pine50};
  position: relative;
  z-index: 2;
}

.rc-node-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 999px;
  margin-bottom: 12px;
  padding: 0;
  background: ${colors.pine700};
  color: ${colors.white};
  font-weight: 850;
  line-height: 1;
  text-align: center;
}

.rc-ledger-row .rc-node-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${colors.white};
  font-size: 0.86rem;
  line-height: 1;
}

.rc-comparison {
  display: grid;
  gap: 12px;
  max-width: 760px;
}

.rc-comparison-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 14px;
}

.rc-comparison-row span {
  color: ${colors.ink500};
}

.rc-comparison-row strong {
  color: ${colors.pine700};
}

.rc-audience-grid,
.rc-feature-grid,
.rc-trust-grid,
.rc-footer-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.rc-audience-card ul,
.rc-feature-card ul,
.rc-footer-column ul {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: grid;
  gap: 9px;
}

.rc-audience-card li::before,
.rc-feature-card li::before {
  content: "";
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 999px;
  background: ${colors.amber500};
}

.rc-lifecycle {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.rc-lifecycle-tabs {
  display: grid;
  gap: 8px;
}

.rc-lifecycle-tab {
  width: 100%;
  text-align: left;
  border: 1px solid var(--rc-line);
  border-radius: 12px;
  background: ${colors.white};
  padding: 11px 13px;
  color: ${colors.ink700};
  cursor: pointer;
  font-weight: 750;
}

.rc-lifecycle-tab[aria-selected="true"] {
  border-color: ${colors.pine200};
  background: ${colors.pine50};
  color: ${colors.pine900};
}

.rc-lifecycle-panel {
  min-height: 330px;
}

.rc-status {
  display: inline-flex;
  align-items: center;
  border: 1px solid ${colors.pine200};
  border-radius: 999px;
  background: ${colors.pine50};
  color: ${colors.pine700};
  padding: 5px 10px;
  font-size: 0.82rem;
  font-weight: 800;
}

.rc-feature-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rc-feature-grid .rc-card { min-height: 220px; padding: clamp(24px, 4vw, 36px); }
.rc-feature-grid .rc-card:nth-child(2),
.rc-feature-grid .rc-card:nth-child(3) { background: ${colors.paper50}; }

.rc-command-section { background: ${colors.pine950}; color: ${colors.textInverse}; }
.rc-command-layout { display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(360px, 1.18fr); gap: clamp(28px, 6vw, 72px); align-items: center; }
.rc-command-copy > p:not(.rc-kicker) { color: ${colors.textInverseMuted}; line-height: 1.7; }

.rc-command-panel {
  background: ${colors.navy950};
  color: ${colors.textInverse};
  border-color: rgba(242, 241, 234, 0.16);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.24);
}

.rc-command-panel__top { padding-bottom: 14px; border-bottom: 1px solid rgba(242, 241, 234, 0.14); color: ${colors.textInverseMuted}; font-size: 0.8rem; }
.rc-command-panel__top strong { color: ${colors.textInverse}; }

.rc-command-list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.rc-command-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(242, 241, 234, 0.14);
  border-radius: 10px;
  padding: 12px;
}

.rc-operational-trust-card p {
  color: ${colors.ink700};
}

.rc-operational-trust-card {
  color: ${colors.ink900};
  padding: 30px;
}

.rc-section--pricing {
  background: ${colors.paper50};
}

.rc-section--dark .rc-section-title,
.rc-section--pricing .rc-section-title,
.rc-final-cta .rc-section-title {
  font-size: clamp(2.05rem, 4.2vw, 2.8rem);
}

.rc-pricing-start {
  display: grid;
  grid-template-columns: minmax(0, 0.88fr) minmax(320px, 1.12fr);
  gap: 28px;
  align-items: center;
}

.rc-pricing-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.rc-pricing-card {
  min-height: 100%;
}

.rc-pricing-card h3 {
  margin-top: 0;
}

.rc-pricing-card ul {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.rc-pricing-card li {
  position: relative;
  padding-left: 18px;
  color: ${colors.ink700};
  line-height: 1.55;
}

.rc-pricing-card li::before {
  content: "";
  position: absolute;
  top: 0.68em;
  left: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${colors.amber500};
}

.rc-about-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 24px;
  align-items: start;
}

.rc-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.rc-tag {
  border: 1px solid ${colors.border};
  border-radius: 999px;
  padding: 8px 11px;
  background: ${colors.white};
  color: ${colors.ink700};
  font-weight: 750;
}

.rc-final-cta {
  border-radius: 28px;
  padding: 42px;
  background: ${colors.navy950};
  color: ${colors.textInverse};
}

.rc-footer {
  padding: 52px 0 32px;
  background: ${colors.pine950};
  color: ${colors.textInverse};
}

.rc-footer a {
  color: ${colors.textInverseMuted};
}

.rc-footer a:hover {
  color: ${colors.white};
}

.rc-footer-grid {
  grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr));
}

.rc-footer-bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  margin-top: 34px;
  padding-top: 22px;
  border-top: 1px solid rgba(242, 241, 234, 0.16);
  color: ${colors.textInverseMuted};
  font-size: 0.88rem;
}

.rc-footer-legal {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.rc-reveal {
  opacity: 1;
  transform: translateY(22px);
  transition: transform 600ms ease;
}

.rc-reveal.is-visible {
  opacity: 1;
  transform: none;
}

@media (max-width: 980px) {
  .rc-hero::before {
    background: none;
  }

  .rc-header-nav,
  .rc-header-actions {
    display: none;
  }

  .rc-mobile-toggle.rc-button {
    display: inline-flex;
  }

  .rc-mobile-menu.is-open {
    display: grid;
    gap: 8px;
  }

  .rc-mobile-menu .rc-link-button,
  .rc-mobile-menu .rc-button,
  .rc-mobile-link {
    width: 100%;
    justify-content: center;
  }

  .rc-hero__inner,
  .rc-lifecycle,
  .rc-about-grid,
  .rc-pricing-start,
  .rc-trust-flow,
  .rc-problem-grid,
  .rc-command-layout {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .rc-trust-connectors {
    display: none;
  }

  .rc-trust-mobile-connector {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 8px 0;
    color: var(--rc-muted);
    font-size: 0.82rem;
    text-align: center;
  }

  .rc-trust-mobile-connector::after {
    content: "↓";
    color: ${colors.pine600};
    font-size: 1.4rem;
    line-height: 1;
  }

  .rc-trust-mobile-connector strong {
    color: var(--rc-text);
  }

  .rc-trust-role-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rc-audience-grid,
  .rc-feature-grid,
  .rc-pricing-cards,
  .rc-trust-grid,
  .rc-footer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .rc-container {
    width: min(100% - 24px, 1120px);
  }

  .rc-hero__inner {
    min-height: auto;
    padding: 42px 0 50px;
  }

  .rc-hero h1 {
    font-size: clamp(2.75rem, 13.5vw, 3.7rem);
  }

  .rc-section {
    padding: 58px 0;
  }

  .rc-section-title {
    font-size: clamp(1.85rem, 9vw, 2rem);
  }

  .rc-hero-visual {
    padding: 12px;
    border-radius: 18px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  }

  .rc-record-header { align-items: flex-start; }
  .rc-record-header strong { font-size: 0.82rem; }
  .rc-system-live { font-size: 0.68rem; }

  .rc-ledger-row {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 9px;
    padding: 11px;
  }

  .rc-ledger-row > strong:last-child {
    grid-column: 2;
    color: ${colors.amber500};
    font-size: 0.82rem;
  }

  .rc-audience-grid,
  .rc-feature-grid,
  .rc-pricing-cards,
  .rc-trust-role-grid,
  .rc-trust-grid,
  .rc-footer-grid {
    grid-template-columns: 1fr;
  }

  .rc-comparison-row {
    grid-template-columns: 1fr;
  }

  .rc-comparison-row em {
    display: none;
  }

  .rc-final-cta {
    padding: 26px;
  }

  .rc-problem-copy p { font-size: 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .rc-landing *,
  .rc-landing *::before,
  .rc-landing *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }

  .rc-reveal {
    opacity: 1;
    transform: none;
  }

  .rc-login-menu__panel { animation: none; }
}

@media print {
  @page {
    margin: 12mm;
  }

  .rc-landing,
  .rc-landing * {
    visibility: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .rc-landing {
    background: var(--rc-paper) !important;
  }

  .rc-marketing-header {
    position: static;
  }

  .rc-reveal {
    opacity: 1 !important;
    transform: none !important;
  }

  .rc-login-menu__panel { animation: none !important; }

  .rc-section,
  .rc-card,
  .rc-panel,
  .rc-ledger-row,
  .rc-footer-grid > div {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .rc-mobile-toggle,
  .rc-mobile-menu {
    display: none !important;
  }
}
`;
