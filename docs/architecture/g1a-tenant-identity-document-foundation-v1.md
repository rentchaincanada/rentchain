# G1A tenant identity document foundation v1

## Status and scope

G1A establishes an unmounted backend contract library for a new high-sensitivity identity-document domain. It contains strict metadata schemas, lifecycle types, linkage references, versioned consent and audit contracts, deny-by-default authorization, and implementation-free storage/provider interfaces.

Founder policy: `TENANT_GOVERNMENT_ID_UPLOAD_REQUIRED = YES`. Tenant government-issued photo ID is required in the normal Tenant Portal identity workflow. G1A encodes the policy contract; runtime enforcement begins in later G1 implementation phases.

`G1A_RUNTIME_MOUNTED = NO`

No Express route, frontend route, file picker, Firestore collection/write, storage implementation, signed URL, provider call, webhook registration, deployment or infrastructure is introduced.

## Security boundaries

- Document custody and verification status are separate state machines. A ready document is not a verified identity.
- Metadata persists opaque original and sanitized-derivative object identifiers, never bytes, public URLs or signed URLs.
- Full government ID numbers, OCR payloads, barcodes/MRZ data and biometric templates are excluded.
- Subjects may manage their own active workflow. Same-organization reviewers receive metadata/verification summaries only. Raw access requires an explicit privilege, recorded purpose and audit; otherwise it fails closed.
- Consent is purpose-specific and text/privacy/retention-versioned. Identity-document collection does not authorize face matching.
- Retention uses policy identifiers and deletion/legal-hold metadata without invented statutory durations.
- Requirement status is separate from document custody and verification: `DOCUMENT_STATUS != REQUIREMENT_STATUS != VERIFICATION_STATUS`. A ready accepted government photo ID can satisfy collection while verification remains `not_started` or later becomes `review_required`.
- Missing policy fails closed as required/action-needed. Legal or accommodation exceptions require an explicit, separately governed and audited state; they do not make the normal workflow optional.
- Future Tenant Portal, application, lease-execution and move-in gates are typed but explicitly not mounted or enforced in G1A.
- Knowing that a requirement is satisfied does not grant raw-ID access. Full government ID numbers remain excluded and raw view remains separately privileged.

## File and future boundaries

The planned G1 image contract permits JPEG, PNG and WebP with byte/dimension/pixel limits. PDF remains deferred until a scanning/quarantine foundation exists.

G1B is responsible for separately governed private storage and image-only upload infrastructure. G2 may later implement a selected provider behind the neutral interface. `G3_FACE_MATCH_NOT_STARTED` and `G5_MOVE_IN_IDENTITY_CONFIRMATION_NOT_STARTED` remain explicit.

G1C is responsible for the future mandatory Tenant Portal workflow: displaying `Government ID required`, recording disclosure/consent, collecting an accepted image through G1B, and showing requirement status. Mandatory document collection does not authorize or require biometric processing.
