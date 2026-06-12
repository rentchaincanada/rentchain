PR: #1143
PR URL: https://github.com/rentchaincanada/rentchain/pull/1143
Branch: fix/numbers-csv-compatibility-v1

Mission: Fix Numbers CSV compatibility for property unit import

Implemented:
- Added canonical unit CSV text normalization before backend parsing.
- Handled BOM, replacement-character, null-byte, zero-width, no-break space, and CR-only line-ending cases.
- Normalized formatted numeric cells for rent, beds, baths, and square feet while preserving validation for invalid values.
- Kept existing CSV template structure, unit schema, API routes, and response contracts unchanged.
- Aligned the frontend CSV preview utility with the same text normalization.
- Added Numbers-style regression coverage for backend parsing, both backend preview entry points, frontend preview parsing, and property creation CSV preview acceptance.

Validation:
- rentchain-api: npm run test:single -- src/imports/unitCsvImport.service.test.ts src/routes/__tests__/unitCsvPreviewRoutes.test.ts
- rentchain-api: npm run build
- rentchain-frontend: npm run test:single -- src/utils/csvPreview.test.ts src/components/properties/AddPropertyForm.test.tsx
- rentchain-frontend: npm run build
- git diff --check

Known limitations:
- Supertest route coverage required elevated local execution because the sandbox blocks binding a local test server port.
- Frontend build still reports the existing large chunk warning.
