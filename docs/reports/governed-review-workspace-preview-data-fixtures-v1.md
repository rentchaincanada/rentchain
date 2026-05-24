# Governed Review Workspace Preview Data Fixtures v1

## Scope

This mission adds deterministic non-production fixtures for governed review workspace admin-page validation.

The fixtures are frontend test-only data under `rentchain-frontend/src/test/fixtures/`. They are not imported by runtime app code and do not create production data, persistence writes, public routes, or mutation behavior.

## Fixture Coverage

The fixture set includes metadata-only examples for:

- Security review workspace
- Support escalation review workspace
- Export governance review workspace
- Evidence review workspace

Each fixture is designed to exercise the read-only admin workspace page with realistic counts, safe evidence references, append event summaries, related workspace links, retention metadata, and redaction summaries.

## Safety Model

Fixture records are explicitly:

- `metadataOnly: true`
- `visibilityClass: admin_support_internal`
- `tenantVisible: false`
- `landlordVisible: false`
- `appendOnly: true`
- `mutationControlsEnabled: false`
- `rawPayloadAccessEnabled: false`

The fixtures do not include raw notes, raw documents, provider payloads, screening reports, storage paths, tokens, secrets, credentials, debug payloads, request bodies, response bodies, stack traces, or raw IDs as primary labels.

## Runtime And Persistence Decision

No runtime fixture loading was added.

No Firestore write path was added.

No API route, backend helper, frontend mutation control, or public surface was added.

The fixtures are limited to tests and future story/dev validation paths. Production data remains sourced only from the existing governed review workspace read routes and approved append-only persistence contracts.

## Tests Added

The fixture tests verify:

- Required workspace categories are present.
- Fixtures remain internal, metadata-only, append-only, and read-only.
- Safe refs and links do not imply mutation controls.
- Unsafe raw payload markers and raw ID labels are absent.
- Deterministic list/detail response helpers support admin page tests.

The admin page test now uses the fixture set instead of a single ad hoc workspace object.

## Known Limitations

- These fixtures do not populate the live admin page in production.
- No storybook or preview-only fixture switch exists in this mission.
- The fixtures do not validate authenticated API route behavior; route behavior is covered by the existing backend read-route tests.

## Future Roadmap

Future work may add a dedicated non-production story/dev harness for governed review workspaces, provided it remains disabled in production, metadata-only, admin-scoped, and free of mutation or persistence side effects.
