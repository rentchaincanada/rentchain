## Tenant Document Upload / Review UX Refinement

This mission refines the existing tenant document surface at `/tenant/attachments` so it works as a clearer destination from tenant profile and application completion.

### What was improved

- The tenant attachments route now returns tenant-safe document status metadata in addition to the underlying attachment list.
- The attachments page now shows a completion-aware summary instead of a raw list of files.
- Document items now use clearer tenant-safe statuses and next-step guidance.
- Profile and application-completion document links now direct tenants into `/tenant/attachments`.

### Document states tenants now see

The refined UX uses tenant-safe status labels:

- `missing`
- `uploaded`
- `pending_review`
- `verified`
- `needs_attention`
- `reupload_requested`

These states are derived from existing checklist and attachment records. They are intended for tenant guidance only and do not expose landlord/admin-only reasoning.

### What remains deferred

This mission does not:

- redesign the upload backend
- add a new storage subsystem
- create a separate tenant document model
- expose internal review notes or screening reasoning
- silently mutate application state

Direct tenant upload/re-upload from this page is still deferred because there is not yet a dedicated tenant-safe upload flow on this surface.

### How this connects to application completion

The attachments page now acts as the clearer document destination for:

- tenant profile document checklist prompts
- application completion document-related steps

This makes the completion engine more actionable by giving tenants a better answer to:

- what is missing
- what is pending review
- what needs attention
- what they should do next

### Existing document architecture preserved

This mission keeps the current document/storage architecture intact:

- canonical attachment records remain the source of truth
- tenant-safe checklist data is used for status translation
- no duplicate document system was introduced
