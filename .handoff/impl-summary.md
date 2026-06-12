PR: #1142
PR URL: https://github.com/rentchaincanada/rentchain/pull/1142
Branch: fix/unit-guided-modal-save-v1

Mission: Fix Unit Guided Modal Save

Implemented:
- Manual unit creation now returns created unit records with stable Firestore IDs.
- Placeholder unit IDs are rejected before occupancy updates with UNIT_ID_UNRESOLVED.
- The property units flow stores only persisted unit records after save responses include stable IDs.
- Unit edit modal stays open and shows a retryable message if a save response omits a stable ID.
- Property detail state replaces edited units when the save response returns a different persisted ID.

Validation:
- rentchain-api: npm run test:single -- src/routes/__tests__/unitsRoutes.patch.test.ts
- rentchain-api: npm run build
- rentchain-frontend: npm run test:single -- src/components/properties/UnitEditModal.test.tsx src/components/properties/PropertyDetailPanel.test.tsx src/pages/PropertiesPage.test.tsx
- rentchain-frontend: npm run build
- git diff --check

Known limitations:
- Frontend focused tests still emit an existing duplicate-key warning in the property creation test harness for prop-created; tests pass.
