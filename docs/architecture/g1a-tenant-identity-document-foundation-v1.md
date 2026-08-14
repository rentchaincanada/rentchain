# G1A tenant identity document foundation v1

## Status and scope

G1A establishes an unmounted backend contract library for a new high-sensitivity identity-document domain. It contains strict metadata schemas, lifecycle types, linkage references, versioned consent and audit contracts, deny-by-default authorization, and implementation-free storage/provider interfaces.

`G1A_RUNTIME_MOUNTED = NO`

No Express route, frontend route, file picker, Firestore collection/write, storage implementation, signed URL, provider call, webhook registration, deployment or infrastructure is introduced.

## Security boundaries

- Document custody and verification status are separate state machines. A ready document is not a verified identity.
- Metadata persists opaque original and sanitized-derivative object identifiers, never bytes, public URLs or signed URLs.
- Full government ID numbers, OCR payloads, barcodes/MRZ data and biometric templates are excluded.
- Subjects may manage their own active workflow. Same-organization reviewers receive metadata/verification summaries only. Raw access requires an explicit privilege, recorded purpose and audit; otherwise it fails closed.
- Consent is purpose-specific and text/privacy/retention-versioned. Identity-document collection does not authorize face matching.
- Retention uses policy identifiers and deletion/legal-hold metadata without invented statutory durations.

## File and future boundaries

The planned G1 image contract permits JPEG, PNG and WebP with byte/dimension/pixel limits. PDF remains deferred until a scanning/quarantine foundation exists.

G1B is responsible for separately governed private storage and image-only upload infrastructure. G2 may later implement a selected provider behind the neutral interface. `G3_FACE_MATCH_NOT_STARTED` and `G5_MOVE_IN_IDENTITY_CONFIRMATION_NOT_STARTED` remain explicit.
