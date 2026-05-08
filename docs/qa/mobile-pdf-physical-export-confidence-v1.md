# Mobile PDF Physical QA & Export Confidence V1

## Scope

Mission branch: `qa/mobile-pdf-physical-export-confidence-v1`

This QA pass validates the mobile PDF repair work merged in PR #831. The scope is limited to PDF/mobile/print/export confidence. No production code changes were made.

## Devices And Browsers

| Target | Result | Notes |
| --- | --- | --- |
| iPhone Safari | Not physically available | Requires a human/device-holder follow-up before claiming physical-device validation. |
| Android Chrome | Not physically available | Requires a human/device-holder follow-up before claiming physical-device validation. |
| Desktop Chrome responsive emulator | Covered by automated responsive tests | Mobile viewport/coarse-pointer behavior is asserted for PDF preview fallback. |
| Desktop Safari responsive emulator | Not available in this environment | Safari-specific browser-device behavior remains a manual QA item. |

## Flows Reviewed

| Flow | Result |
| --- | --- |
| PDF sample page | Automated tests confirm desktop iframe remains and mobile fallback replaces iframe. |
| Billing/sample PDF modal | Automated tests confirm desktop iframe remains and mobile fallback replaces iframe. |
| Lease summary PDF | Automated test confirms long fallback lease summary content paginates beyond one page and includes final long-form content. |
| Rental application print/export | Print guardrail test confirms dangerous print-root rules are absent from `PrintApplicationView`. |
| Print-only summary roots | Print guardrail test confirms global print-only roots avoid absolute positioning, `100vh`, and hidden overflow. |
| Existing PDF URLs/export APIs | Reviewed by diff scope; no URL/API changes were introduced by PR #831. |
| Open/Download actions | Automated tests confirm actions render with the existing sample PDF URL and `download` attribute on mobile fallback. |

## Validation Results

- Mobile PDF iframe preview is not rendered in automated mobile/coarse-pointer viewport coverage.
- Mobile Open PDF action is present in audited fallback surfaces.
- Mobile Download PDF action is present in audited fallback surfaces.
- Desktop PDF iframe preview remains present in audited desktop viewport coverage.
- Print roots no longer use the audited mobile-dangerous rules:
  - `position: absolute`
  - `inset: 0`
  - `min-height: 100vh`
  - clipped print overflow
  - unsafe transform carry-through
- No package or lockfile drift was detected.
- No backend PDFKit generation changes were made.

## Commands Run

From `rentchain-frontend/` with Node 20 on `PATH`:

```bash
npm run test:single -- src/utils/pdfPreviewGuard.test.ts src/pages/PdfSamplePage.test.tsx src/components/billing/SamplePdfModal.test.tsx src/styles/printPdfGuardrails.test.ts src/pages/LandlordLeaseSummaryPage.test.tsx
npm run test
npm run build
```

From repo root:

```bash
git diff --check
git diff --name-only -- package-lock.json rentchain-frontend/package-lock.json package.json rentchain-frontend/package.json rentchain-api/package-lock.json rentchain-api/package.json
```

## Results

- Targeted PDF/export regression tests: 12 tests passed.
- Full frontend test suite: 927 tests passed across 250 files.
- Frontend build: passed.
- Build warning: existing large chunk warning only.
- `git diff --check`: passed.
- Dependency/lockfile drift: none.

## Known Limitations

Physical iPhone Safari and Android Chrome testing could not be performed from this execution environment because no physical mobile devices or remote device farm are available to Codex. Browser-level PDF handoff behavior can vary across mobile OS/browser versions, so this report should not be treated as a substitute for a real-device signoff.

## Remaining Risks

- Native iOS/Android PDF viewer handoff behavior still needs real-device confirmation.
- Mobile browser share-sheet behavior remains manually unverified.
- Authenticated landlord/tenant PDF flows were not exercised on physical devices in this pass.

## Recommendation

No code changes are recommended from this QA pass. Automated mobile fallback, desktop iframe, print-root, and long lease-summary pagination checks remain green.

Before declaring physical QA complete, run a short human/device-holder pass on iPhone Safari and Android Chrome using:

1. Sample PDF modal/page.
2. Lease summary PDF download/open.
3. Rental application print/export.
4. Browser share sheet where available.

If that pass finds no blank pages, clipping, or failed Open/Download behavior, this mission can be closed as a no-code QA confirmation.
