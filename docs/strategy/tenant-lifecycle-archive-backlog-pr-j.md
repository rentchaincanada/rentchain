# PR J Backlog — Tenant Lifecycle, Past Tenant Filtering & Archive Workspace

Status: backlog after PR I. This document records design inputs only and does not authorize implementation.

The default tenant workspace should distinguish current, upcoming, past/inactive, and archived relationships. Ended leases must not present a tenant as current or visually resemble a current connected lease. Ending the sole current relationship should make the tenant past/inactive, without automatically archiving the tenant. Archive is a separate, reversible landlord action that requires no current lease and no unresolved occupancy conflict. Past is not archived, and neither transition deletes lease, payment, note, document, application, or audit history.

Future design must cover active/upcoming/past/archived filters, explicit ended-lease and actual-end-date presentation, Archive and Restore actions, and cross-surface lifecycle coherence. `CURRENT_LEASE_CONTEXT_MISMATCH` and legacy `TENANT_CURRENT_WITHOUT_CURRENT_LEASE` remediation remain separate later workstreams.
