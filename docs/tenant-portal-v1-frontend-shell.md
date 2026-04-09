# Tenant Portal v1 Frontend Shell

## Included In This Mission
- coherent tenant shell navigation focused on workspace, application, lease, maintenance, messages, notices, and account
- workspace summary page backed by the tenant foundation `/tenant/workspace` route
- dedicated tenant application and lease pages backed by tenant-safe projections
- maintenance list/create/detail flow aligned to the foundation maintenance routes
- authenticated invite redemption entry page for one-time token redemption
- loading, empty, unauthorized, and error states for the new tenant workspace surfaces

## Intentionally Deferred
- broader tenant automation
- screening provider UI
- compliance-agent UI
- landlord/admin redesign
- duplicate tenant-side source-of-truth state
- broad tenant route cleanup outside the workspace shell

## Data Handling Notes
- the frontend uses the tenant foundation backend as the source of truth
- no landlord endpoints are used for the new tenant workspace views
- invite redemption stays authenticated and server-scoped
- tenant pages render only the whitelisted response shapes returned by the backend
