## Tenant Profile Edit and Document Entry Points

This mission makes the tenant workspace more actionable without introducing a new tenant-owned data model.

### What is editable

The tenant profile now supports a bounded edit surface for:

- `displayName`
- `phone`

These values update existing canonical tenant and application records when that tenant authority context allows it. The route does not allow edits to landlord-only notes, admin-only notes, verification state, approval state, or risk-related fields.

### What document entry actions exist

Document-related next steps now point tenants into the existing tenant attachments/documents surface at `/tenant/attachments`.

This mission reuses the existing document visibility flow instead of introducing a separate upload subsystem. The goal is to give tenants a direct, safe place to review document-related completion needs from:

- the tenant profile page
- the application completion checklist

### What remains deferred

This mission does not:

- redesign document uploads
- add a new document-management system
- add hidden automation
- expose landlord/admin-only internal reasoning
- change Risk Agent scoring logic

If a richer upload or document-resolution workflow is needed later, it should build on the existing canonical records and tenant authority rules rather than introducing a second source of truth.

### How this improves completion flow

The tenant can now:

- correct a small set of profile gaps directly
- follow document-related checklist actions into a real tenant page
- move from “what is missing” to “what do I do next” with fewer dead ends

That should improve application completeness and data quality while preserving the existing projection-based tenant architecture.

### Projection architecture preserved

This mission continues to treat the tenant portal as a projection layer over canonical records:

- profile updates write through controlled backend routes into existing tenant/application records
- document entry points reuse existing tenant-safe document surfaces
- no separate tenant profile or document source-of-truth model was created
