import { tokens } from "./landing/marketingLandingStyles";

const { colors, semantic, typography } = tokens;

export const pricingPageCss = `
.rc-pricing-page {
  background:
    radial-gradient(circle at 8% 4%, rgba(187, 216, 204, 0.35), transparent 28%),
    ${colors.paper100};
}

.rc-pricing-page .rc-pricing-hero {
  background: ${colors.paper100};
  color: ${colors.ink900};
  border-bottom: 1px solid ${colors.border};
}

.rc-pricing-hero__inner {
  min-height: clamp(520px, 66vh, 720px);
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.55fr);
  align-items: center;
  gap: clamp(28px, 6vw, 72px);
  padding: clamp(54px, 9vw, 104px) 0;
}

.rc-pricing-hero h1 {
  margin: 0;
  max-width: 860px;
  font-family: ${typography.fontDisplay};
  font-size: clamp(2.6rem, 6vw, 4.25rem);
  line-height: 1.06;
  color: ${colors.ink900};
  letter-spacing: 0;
}

.rc-pricing-hero__body {
  max-width: 690px;
  margin: 22px 0 0;
  color: ${colors.ink700};
  font-size: clamp(1.05rem, 2vw, 1.28rem);
  line-height: 1.65;
}

.rc-pricing-hero__note {
  display: grid;
  gap: 14px;
  padding: clamp(22px, 4vw, 30px);
  border: 1px solid ${colors.border};
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: ${tokens.shadows.card};
}

.rc-pricing-hero__note span,
.rc-pricing-plan__eyebrow {
  color: ${colors.pine700};
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rc-pricing-hero__note strong {
  color: ${colors.ink900};
  font-size: 1.28rem;
  line-height: 1.25;
}

.rc-pricing-hero__note p {
  margin: 0;
  color: ${colors.ink700};
  line-height: 1.65;
}

.rc-pricing-interval {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 24px;
  padding: 5px;
  border: 1px solid ${colors.border};
  border-radius: 999px;
  background: ${colors.white};
  box-shadow: ${tokens.shadows.card};
}

.rc-pricing-interval button {
  min-height: 40px;
  border: 0;
  border-radius: 999px;
  padding: 9px 16px;
  background: transparent;
  color: ${colors.ink700};
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.rc-pricing-interval button.is-active {
  background: ${colors.pine700};
  color: ${colors.white};
  box-shadow: ${tokens.shadows.button};
}

.rc-pricing-interval button:focus-visible,
.rc-pricing-plan button:focus-visible {
  outline: none;
  box-shadow: ${semantic.focusRing};
}

.rc-pricing-page #plan-fit {
  scroll-margin-top: 96px;
}

.rc-pricing-plan-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  align-items: stretch;
}

.rc-pricing-plan {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 24px;
  border: 1px solid ${colors.border};
  border-radius: 18px;
  background: ${colors.white};
  box-shadow: ${tokens.shadows.card};
}

.rc-pricing-plan.is-highlighted {
  border-color: ${colors.pine200};
  background: linear-gradient(180deg, ${colors.pine50} 0%, ${colors.white} 34%);
  box-shadow: ${tokens.shadows.raised};
}

.rc-pricing-plan h3 {
  margin: 8px 0 10px;
  color: ${colors.ink900};
  font-family: ${typography.fontDisplay};
  font-size: 1.55rem;
  line-height: 1.18;
}

.rc-pricing-plan p,
.rc-pricing-plan li,
.rc-pricing-plan dd {
  color: ${colors.ink700};
  line-height: 1.6;
}

.rc-pricing-plan p {
  margin: 0;
}

.rc-pricing-plan__price {
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid ${colors.border};
  border-radius: 14px;
  background: ${colors.paper50};
}

.rc-pricing-plan__price strong {
  color: ${colors.ink900};
  font-size: 1.72rem;
  line-height: 1;
}

.rc-pricing-plan__price span,
.rc-pricing-plan__fit span {
  color: ${colors.ink500};
  font-size: 0.88rem;
  line-height: 1.45;
}

.rc-pricing-plan__fit {
  display: grid;
  gap: 4px;
  padding: 0 2px;
}

.rc-pricing-plan__fit strong {
  color: ${colors.ink900};
  line-height: 1.45;
}

.rc-pricing-plan ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.rc-pricing-plan li {
  position: relative;
  padding-left: 22px;
}

.rc-pricing-plan li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.72em;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${colors.pine600};
}

.rc-pricing-plan > .rc-button {
  width: 100%;
  margin-top: auto;
}

.rc-pricing-upgrade-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.rc-pricing-upgrade-card {
  padding: 20px;
}

.rc-pricing-upgrade-card h3 {
  margin: 0 0 14px;
  color: ${colors.ink900};
  font-size: 1.05rem;
}

.rc-pricing-upgrade-card dl,
.rc-pricing-upgrade-card dd {
  margin: 0;
}

.rc-pricing-upgrade-card dl {
  display: grid;
  gap: 14px;
}

.rc-pricing-upgrade-card dt {
  margin-bottom: 4px;
  color: ${colors.pine700};
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rc-pricing-trust {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: clamp(24px, 5vw, 54px);
  align-items: start;
}

.rc-pricing-trust__cards {
  display: grid;
  gap: 14px;
}

.rc-pricing-trust .rc-card h3 {
  margin: 0 0 8px;
}

.rc-pricing-trust .rc-card p {
  margin: 0;
  color: ${colors.ink700};
  line-height: 1.65;
}

.rc-pricing-page .rc-link-button--ghost {
  color: ${colors.ink900};
  border-color: ${colors.borderStrong};
  background: rgba(255, 255, 255, 0.62);
}

@media (max-width: 1180px) {
  .rc-pricing-plan-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rc-pricing-upgrade-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .rc-pricing-hero__inner,
  .rc-pricing-trust {
    grid-template-columns: 1fr;
  }

  .rc-pricing-hero__inner {
    min-height: auto;
    padding: 48px 0;
  }
}

@media (max-width: 640px) {
  .rc-pricing-plan-grid,
  .rc-pricing-upgrade-grid {
    grid-template-columns: 1fr;
  }

  .rc-pricing-interval {
    width: 100%;
  }

  .rc-pricing-interval button {
    flex: 1 1 0;
  }

  .rc-pricing-plan {
    padding: 20px;
  }
}
`;
