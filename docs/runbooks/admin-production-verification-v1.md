# Admin Production Verification v1

## Purpose
Use this checklist after admin-platform releases to verify auth boundaries, global admin pages, exports, saved filters, integrity drill-throughs, and audit activity without touching landlord-facing scope.

## Scope
Applies to:
- `/admin`
- `/admin/properties`
- `/admin/tenants`
- `/admin/leases`
- `/admin/integrity`
- `/admin/audit`
- `/api/admin/*`

## Preconditions
- Use a platform admin account with `system.admin`
- Use a separate non-admin landlord account for negative checks
- Keep one browser session signed in as admin and one private window for unauthenticated/non-admin checks

## 1. Auth And Access
- Open `/admin` as admin
  - Expect dashboard to load
- Open `/admin/properties`, `/admin/tenants`, `/admin/leases`, `/admin/integrity`, `/admin/audit` as admin
  - Expect each page to load without redirect loops
- Open the same pages as a non-admin landlord
  - Expect access denied or redirect according to current admin UX
- Call an admin API without auth:
  - `curl -i https://<api-host>/api/admin/overview`
  - Expect `401`
- Call an admin API as non-admin:
  - Expect `403`

## 2. Overview Dashboard
- Visit `/admin`
- Confirm KPI cards render:
  - total properties
  - total tenants
  - total leases
  - active leases
  - integrity warnings
  - orphan records
- Confirm quick links navigate to:
  - `/admin/properties`
  - `/admin/tenants`
  - `/admin/leases`
  - `/admin/integrity`

## 3. Global Admin Pages
### Properties
- Load `/admin/properties`
- Search by property name and address
- Filter by province and integrity
- Open a property row drawer
- Confirm only safe view-model fields are shown

### Tenants
- Load `/admin/tenants`
- Search by name, email, and phone
- Filter by lease/screening/move-in status
- Open a tenant row drawer
- Confirm no sensitive application payloads or private file URLs appear

### Leases
- Load `/admin/leases`
- Search by lease id, property name, and tenant name
- Filter by status, risk grade, and integrity
- Open a lease row drawer
- Confirm lease/property/unit/tenant summary renders cleanly

## 4. Integrity Dashboard
- Load `/admin/integrity`
- Confirm totals strip renders
- Confirm each issue section shows:
  - severity
  - count
  - description
  - bounded samples
- Click at least one sample drill-through link per populated section
  - Expect navigation to the relevant admin page with a useful query
- If no issues exist:
  - Expect a clean zero-state, not empty warning shells

## 5. CSV Export
- From each admin page, click `Export CSV`
  - `/admin/properties`
  - `/admin/tenants`
  - `/admin/leases`
  - `/admin/integrity`
- Confirm each download completes and the filename is descriptive:
  - `admin-properties-YYYY-MM-DD.csv`
  - `admin-tenants-YYYY-MM-DD.csv`
  - `admin-leases-YYYY-MM-DD.csv`
  - `admin-integrity-YYYY-MM-DD.csv`
- Apply a filter before export and confirm the CSV reflects that filter
- Current implementation note:
  - exports are bounded by the backend export cap
  - verify row counts make sense for the filtered dataset

## 6. Saved Filters
- On `/admin/properties`, save a new preset
- Load the preset
  - Expect URL query params to update
  - Expect page data to refresh from URL state
- Delete the preset
  - Expect it to disappear from the dropdown
- Repeat one smoke check on `/admin/leases` or `/admin/integrity`
- Confirm presets are:
  - page-specific
  - user-specific

## 7. Audit Tooling
- Load `/admin/audit`
- Confirm summary cards render:
  - recent admin actions
  - recent exports
  - recent integrity events
  - recent saved filter actions
- Perform one export and one saved-filter action
- Refresh `/admin/audit`
  - Expect recent export and saved-filter activity to appear
- Open at least one related admin link from each populated audit section

## 8. Spot-Check Curl Commands
Replace `TOKEN` and host as needed.

```bash
curl -i -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/overview"
curl -i -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/properties?q=main&page=1&pageSize=25"
curl -i -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/tenants?q=jane"
curl -i -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/leases?status=active"
curl -i -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/integrity"
curl -i -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/audit"
curl -I -H "Authorization: Bearer TOKEN" "https://<api-host>/api/admin/properties/export.csv?q=main"
```

## 9. Structured Logs To Inspect
If something fails, inspect logs for:
- `[properties.scope]`
- `[admin.export]`
- `[admin.savedFilters]`
- `[admin.audit]`
- route-specific admin errors such as:
  - `[adminPropertiesRoutes]`
  - `[adminTenantsRoutes]`
  - `[adminLeasesRoutes]`
  - `[adminIntegrityRoutes]`
  - `[adminAuditRoutes]`
  - `[adminSavedFiltersRoutes]`

## 10. Expected Unauthorized Responses
- Unauthenticated admin API request:
  - `401`
  - body similar to `{ "ok": false, "error": "unauthenticated" }`
- Authenticated non-admin request:
  - `403`
  - body similar to `{ "ok": false, "error": "Forbidden" }`

## Environment Limits
- Full production verification of auth tokens, live data volume, and export download behavior requires a deployed environment and real admin credentials.
- Local test coverage validates shaped responses and route behavior, but does not replace live smoke checks against production/staging.
