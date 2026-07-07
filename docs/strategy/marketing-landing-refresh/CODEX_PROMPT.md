# Final Codex prompt

Copy everything in the block below into Codex.

---

You are working in the existing **rentchain-frontend** repo (React + Vite + TypeScript). Implement a new native marketing landing page. **Frontend only. Scope strictly to the marketing landing page — do not touch logged-in dashboards or migrate the app-wide design system.**

**Task:** Replace the contents of `src/pages/marketing/LandingPage.tsx` (already routed at `/` and `/site`) with a high-fidelity native React implementation of the RentChain landing design.

**Use these provided files** (place under `src/pages/marketing/landing/`):
- `landingContent.ts` — all copy + structured data. Do not hardcode copy in components; read from here.
- `marketingLandingStyles.ts` — marketing-only tokens (colors, typography, radii, shadows, spacing, card/badge/button style objects, layout sizes). Wire into CSS variables on the marketing page root (or your styling layer). Keep isolated to this page.
- `rentchain-mark.svg` — logo mark; place in the repo's brand asset directory.

**Build these components** under `src/pages/marketing/landing/` and compose them in order in `LandingPage.tsx`:
`MarketingHeader`, `HeroSection` (+ `HeroNetworkVisual`), `TrustFlowSection`, `WhyRentChainSection`, `AudienceSection`, `LifecycleSection`, `FeatureShowcaseSection` (+ reusable `FeatureRow`), `OperationalTrustSection`, `AboutVisionSection`, `FinalCtaSection`, `MarketingFooter`, plus shared `LedgerRow` and `RevealOnScroll`. Reuse the app's existing Button/Link/routing primitives where they exist.

**Visual system (exact values in `marketingLandingStyles.ts`):**
- Page bg warm paper `#FAF7F2`; alternating `#F3EDE2` bands with `1px #E5DECF` hairlines; dark surfaces (hero, command-center block, final CTA, footer) navy `#0A1428`.
- Fonts: Source Serif 4 (display, 700, −0.02em), Public Sans (body/UI), Spline Sans Mono (**all numbers, dates, kicker labels**). Load from Google Fonts unless licensed files exist.
- Cards: white, `1px #E5DECF`, radius 16, warm `--shadow-card`. Pill buttons/badges. The only gradient allowed is the hero ambient glow (`heroGlow`). No textures, no photography. ✓ is the only expressive glyph; no emoji. Sentence case everywhere except tiny uppercase mono kickers.
- Accent CTA = amber `#E8A33D` with **ink text `#20251F` (never white — contrast)**; pine `#1E5F4E` is primary; 3px pine focus ring on every interactive element.

**Behavior:**
- Header: transparent over hero; after 24px scroll switch to paper-blur solid (`rgba(250,247,242,0.9)` + 14px backdrop-blur + hairline) and flip nav/logo text light→ink. Inline nav collapses to a mobile menu ≤900px.
- Login dropdown: `<button aria-haspopup="true" aria-expanded={open}>`; Escape closes and restores focus; click-outside closes; items keyboard-navigable.
- Lifecycle: 8-step tablist, auto-advance every 3800ms, pause permanently once the user selects a step; active step drives the detail panel + ledger record card. Horizontal-scroll tab row.
- Scroll reveal: IntersectionObserver fade + 22px rise (600–700ms `cubic-bezier(0.22,1,0.36,1)`).
- `prefers-reduced-motion: reduce`: disable reveal, stop lifecycle auto-advance, freeze all SVG/persona animations, show content immediately.

**Responsive:** container max 1120px, inline pad `clamp(1.25rem,5vw,2.5rem)`, section pad `clamp(4rem,9vw,6.5rem)`. Hero network visual hidden ≤760px. Trust-flow grid 4→2 col ≤720px with connectors hidden. Feature rows flex-wrap; alternating rows use `wrap-reverse` so the mock leads on desktop. Footer columns `auto-fit minmax(150px,1fr)`.

**Accessibility:** exactly one `<h1>` (hero); ordered `<h2>/<h3>`; semantic landmarks (`header`/`nav[aria-label]`/`section`/`footer`/`figure`); decorative SVGs `aria-hidden`; lifecycle tabs as a proper tablist; visible focus rings; ≥44px touch targets; verify AA contrast (ink-on-amber, `#F2F1EA` on navy).

**Content rules (already reflected in `landingContent.ts` — keep them):**
- No fabricated aggregate metrics. The proof section uses capability statements, not the old "3,100+ / $48M / 62% / 100%" numbers.
- No fictional testimonials or U.S. cities. `operationalTrust.testimonials` is empty until real, consented quotes exist — render that block only when non-empty.
- Canadian payment rails: `EFT` (not ACH). Footer copyright `© 2026 RentChain` until the registered entity is confirmed. Command-center numbers are illustrative sample UI data only.
- Replace all `#`/`CONFIRM`-marked links with real app routes/URLs or omit; confirm the free-pricing microcopy before shipping (use neutral CTA copy if unconfirmed).

**Preserve:** the existing page's signup/login/analytics/acquisition-tracking wiring on CTAs and login links.

**Do NOT:** ship the design prototype's `support.js`, serve any `.dc.html`, introduce fake claims, alter product dashboards, or globally change the app design system.

Deliver the components, wire them into `LandingPage.tsx`, and ensure the page builds and type-checks.
