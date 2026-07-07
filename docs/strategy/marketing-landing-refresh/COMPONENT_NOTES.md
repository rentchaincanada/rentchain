# Component-by-component implementation notes

Native React (TSX) for `rentchain-frontend`. All components live under
`src/pages/marketing/landing/`. Content comes from `landingContent.ts`; tokens/styles
from `marketingLandingStyles.ts`. Compose in order inside `LandingPage.tsx`.

Legend — each component lists: **Props** · **Content source** · **State/interaction** · **Accessibility** · **Responsive**.

---

## LandingPage.tsx (composition root)
- **Props:** none.
- **Content:** imports `landingContent`.
- **State/interaction:** none of its own — thin composition. Renders the 11 sections in order inside a page root that sets `background: paper100`, `color: ink900`, `font-family: sans`, `overflow-x: hidden`. Wire marketing tokens to CSS vars here (or a `<MarketingThemeProvider>`). **Preserve existing signup/login/analytics wiring** on the page.
- **A11y:** owns the single document outline; ensure exactly one `<h1>` downstream (hero).
- **Responsive:** none directly; children handle it.

## MarketingHeader.tsx
- **Props:** `nav`, `logins`, `ctaLabel`, `ctaHref` (from `header`).
- **Content:** `landingContent.header`.
- **State/interaction:** `scrolled` (scroll listener, flips at >24px → `headerSolid` style, nav/logo text light→ink); `loginOpen` dropdown; `mobileOpen` for ≤900px menu. Fixed position, z-index ~60.
- **A11y:** `<header>` + `<nav aria-label="Main">`; login trigger `<button aria-haspopup="true" aria-expanded={loginOpen}>`; **Escape closes dropdown & restores focus to trigger**; click-outside closes; dropdown items are focusable links with a leading color dot (`dotToken`). Mobile menu button `aria-expanded`. 3px pine focus ring on all.
- **Responsive:** inline nav hidden ≤900px → hamburger opens a sheet/drawer; login + CTA stay visible. Transparent over hero, paper-blur solid after scroll.

## HeroSection.tsx (+ HeroNetworkVisual.tsx)
- **Props:** `hero` object; visual takes `personas`.
- **Content:** `landingContent.hero`.
- **State/interaction:** none (visual animations are CSS/SVG). Primary CTA = accent button, secondary = ghost-on-dark.
- **A11y:** single `<h1>` (title line 1 + accent "Connected."); kicker is decorative mono label; **network SVG + persona nodes `aria-hidden="true"`**; CTAs are real links/buttons preserving acquisition tracking.
- **Responsive:** two-column flex (`flex: 1 1 420px`), wraps to stacked; **HeroNetworkVisual hidden ≤760px**. bg navy950 + `heroGlow` (only gradient). Freeze SVG dash/bob/pulse animations under `prefers-reduced-motion`.

## TrustFlowSection.tsx
- **Props:** `trustFlow` (kicker, title, nodes[], hubKicker, hubTitle).
- **Content:** `landingContent.trustFlow`.
- **State/interaction:** none. 4 role nodes → animated converging SVG connectors → shared-record hub card (tint/pine).
- **A11y:** `<section>` + `<h2>`; node titles `<h3>`; **connector SVG `aria-hidden`**; hub uses the logo mark with `alt=""`.
- **Responsive:** 4-col grid → 2-col ≤720px; **connectors hidden ≤720px**, hub gets top margin. Reduced-motion freezes the dashed flow.

## WhyRentChainSection.tsx
- **Props:** `whyRentChain` (kicker, titlePlain, titleAccent, rows[]).
- **Content:** `landingContent.whyRentChain`.
- **State/interaction:** none. Comparison table: header row (Traditional software / RentChain) + 5 `from → to` rows inside a bordered card.
- **A11y:** `<h2>`; the comparison is a semantic table or a list of labeled pairs (not just visual columns); arrow glyph decorative (`aria-hidden`).
- **Responsive:** 3-col grid (`1fr auto 1fr`) stays; on very narrow, reduce padding (`clamp`) — keep both columns legible; band bg paper200 with hairlines.

## AudienceSection.tsx
- **Props:** `audiences` (kicker, title, cards[]); **optional** `visibleKeys?: string[]` if the four cards are made configurable (prototype tweak — see README §11).
- **Content:** `landingContent.audiences`.
- **State/interaction:** static by default. If configurable, column count = number of visible cards (`repeat(N, minmax(0,1fr))`) so they fill one row.
- **A11y:** `<h2>`; each card title `<h3>`; bullet lists are real `<ul>`; ✓ marks decorative.
- **Responsive:** grid columns = visible-card count on desktop; collapse to 2/1 columns on mobile. Cards equal-height (flex column).

## LifecycleSection.tsx
- **Props:** `lifecycle` (kicker, title, subtitle, autoAdvanceMs, steps[]).
- **Content:** `landingContent.lifecycle`.
- **State/interaction:** `activeStep` index; **auto-advance every `autoAdvanceMs` (3800)**; pause permanently once the user selects a tab (`userPicked`). Active step drives the detail copy + the ledger record card (title/meta/amount/status badge).
- **A11y:** implement tabs as `role="tablist"`/`role="tab"` with `aria-selected`, or as buttons updating a live region so the active step's detail is announced; step badge reflects `statusLabel`. Keyboard: arrow/tab between steps.
- **Responsive:** horizontal-scroll tab row (`overflow-x:auto`) at all sizes; detail panel flex-wraps — copy + record card side-by-side on desktop, stacked on narrow (card `width: min(100%, 320px)`). **Stop auto-advance under reduced-motion.**

## FeatureShowcaseSection.tsx (+ FeatureRow.tsx)
- **Props:** section = `features` (kicker, title, rows[], commandCenter). `FeatureRow` props: `kicker`, `title`, `body`, `mockLeads`, and a `mock` render slot/children.
- **Content:** `landingContent.features`.
- **State/interaction:** none. 4 alternating rows via `FeatureRow` (reused) + 1 dark command-center block (2×2 sample-stat grid).
- **A11y:** each row title `<h3>`; the UI mockups (ledger cards, chat thread, stat grid) are illustrative — decorative avatars get `aria-hidden` or role labels; **command-center numbers are sample data, never presented as company metrics** (see README §4b).
- **Responsive:** rows are `flex-wrap` (`flex: 1 1 340–360px`); rows with `mockLeads:true` use `flex-wrap: wrap-reverse` so the mock leads on desktop but text leads when stacked. Command-center grid stays 2-col.

## OperationalTrustSection.tsx
- **Props:** `operationalTrust` (kicker, title, capabilities[], testimonials[]).
- **Content:** `landingContent.operationalTrust`.
- **State/interaction:** none. **Replaces the prototype "social proof" section** — renders capability statements (no fabricated numbers). Render the testimonials block only if `testimonials.length > 0` (empty until real, consented quotes exist).
- **A11y:** `<h2>`; capabilities are a list; any real quotes use `<figure>/<figcaption>`.
- **Responsive:** capability cards `repeat(auto-fit, minmax(...))`; reflow to fewer columns on mobile. Band bg paper200.

## AboutVisionSection.tsx
- **Props:** `aboutVision` (kicker, title, body[], visionTitle, tags[]).
- **Content:** `landingContent.aboutVision`.
- **State/interaction:** none.
- **A11y:** `<h2>` for "Housing operations are fragmented", `<h3>` for the vision title; tags are a list of pill spans (decorative styling, real text).
- **Responsive:** two-column flex (`flex: 1 1 360px` / `1 1 320px`), stacks on narrow; tags wrap.

## FinalCtaSection.tsx
- **Props:** `finalCta` (kicker, title, subtitle, primaryCta, secondaryCta, microcopy).
- **Content:** `landingContent.finalCta`.
- **State/interaction:** none. Dark rounded panel (navy950, radius 28) with center CTAs; preserve tracking on the buttons.
- **A11y:** `<h2>`; accent CTA uses ink-on-amber (not white-on-amber); ghost CTA on dark; focus ring visible.
- **Responsive:** panel padding via `clamp`; CTAs wrap and center.

## MarketingFooter.tsx
- **Props:** `footer` (blurb, columns[], legal, social[]).
- **Content:** `landingContent.footer`.
- **State/interaction:** none. **Replace all `#`/CONFIRM hrefs with real routes** or omit.
- **A11y:** `<footer>`; column headings `<h3>` (visually small, uppercase); `<nav aria-label="Legal">` and `<nav aria-label="Social">`; logo home link `aria-label`.
- **Responsive:** columns `repeat(auto-fit, minmax(150px, 1fr))` — 4 → 2/1; logo blurb spans full width; legal/social row wraps. bg navy950.

## Shared: LedgerRow.tsx
- **Props:** `title`, `meta?`, `amount?`, `status?` ("verified" | "pending" | "info"), `checked?`.
- **Content:** passed by lifecycle + feature mockups.
- **State/interaction:** none — presentational. ✓ in a mint circle when `checked`; amount in mono; optional status badge.
- **A11y:** ✓ decorative; amount readable; keep as list rows (`role="listitem"` inside a `role="list"` ledger).
- **Responsive:** single-row flex; title/meta stack in the main column, amount right-aligned.

## Shared: RevealOnScroll.tsx
- **Props:** `children`, `as?`, `delay?`.
- **State/interaction:** IntersectionObserver → fade + 22px rise, 600–700ms `cubic-bezier(0.22,1,0.36,1)`, unobserve after reveal; safety timeout reveals all after ~2.4s.
- **A11y/reduced-motion:** if `prefers-reduced-motion: reduce`, render fully visible immediately (no transform/opacity animation).
- **Responsive:** wrapper only; no layout impact.

---

### Cross-cutting reminders
- Load Source Serif 4, Public Sans, Spline Sans Mono (Google Fonts unless licensed files exist).
- All numbers/dates/kicker labels render in **mono**.
- Every interactive element gets the 3px pine focus ring.
- Apply the README §4 content cleanup (no fake metrics/testimonials, EFT not ACH, neutral entity, real links) — the data files already reflect it.
