# PR J Backlog — Tenant Lifecycle, Past Tenant Filtering & Archive Workspace

Status: backlog after PR I. This document records design inputs only and does not authorize implementation.

The default tenant workspace should distinguish current, upcoming, past/inactive, and archived relationships. Ended leases must not present a tenant as current or visually resemble a current connected lease. Ending the sole current relationship should make the tenant past/inactive, without automatically archiving the tenant. Archive is a separate, reversible landlord action that requires no current lease and no unresolved occupancy conflict. Past is not archived, and neither transition deletes lease, payment, note, document, application, or audit history.

Future design must cover active/upcoming/past/archived filters, explicit ended-lease and actual-end-date presentation, Archive and Restore actions, and cross-surface lifecycle coherence. `CURRENT_LEASE_CONTEXT_MISMATCH` and legacy `TENANT_CURRENT_WITHOUT_CURRENT_LEASE` remediation remain separate later workstreams.

## PR J implemented contract

PR J implements a server-projected tenant workspace category of Current, Upcoming, Past, or Archived. Current, Upcoming, and Past reuse the canonical lease-term and occupancy projection; Archived is a durable `archivedAt` administrative overlay and is not an occupancy or relationship status. The landlord workspace consumes this projection for its Active, Current, Upcoming, Past, and Archived filters, so the frontend does not infer lifecycle from dates or stale pointers.

Archive and Restore are explicit landlord commands. Each command revalidates tenant ownership and authoritative lease/unit context inside one Firestore transaction, writes the tenant overlay and its append-only canonical lifecycle event atomically, and preserves all historical business records. Archive is rejected for a canonical current relationship, a valid upcoming relationship, or unresolved occupancy conflict. Upcoming blocks Archive because it is an operational future relationship that must remain visible in the active workspace. Restore removes only the archive overlay and lets the canonical projection return the tenant to Current, Upcoming, or Past; it never forces Current.

Tenant detail presents the workspace lifecycle and uses only persisted `endedAt`, `terminatedAt`, or `terminationDate` as the actual end date. A scheduled lease end is never relabelled as the actual end. End Lease continues to produce Past rather than Archived, and signing completion remains execution-only.

The separate `CURRENT_LEASE_CONTEXT_MISMATCH` and legacy `TENANT_CURRENT_WITHOUT_CURRENT_LEASE` remediation workstreams remain unimplemented. PR J does not change the canonical occupancy reason set or introduce a second current-lease or occupancy evaluator.
