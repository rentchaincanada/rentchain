# Entitlements Consistency QA (Messaging/Admin)

## Purpose
Validate that role/plan/capabilities are resolved from one backend entitlements source and that admin users are never blocked by plan capability gates.

## Cases
1. Admin messaging access
   - Login as admin user.
   - Open `/messages`.
   - Expected: conversations load with no `403` and no `upgrade_required`.
2. Elite landlord messaging access
   - Login as non-admin landlord on pro/business/elite-equivalent plan.
   - Open `/messages`.
   - Expected: `200` responses for messaging endpoints.
3. Starter landlord messaging gate
   - Login as starter landlord.
   - Open `/messages`.
   - Expected: `403` payload includes:
     - `ok: false`
     - `error: "upgrade_required"`
     - `capability: "messaging"`
     - `plan: "starter"`
4. `/api/me` plan consistency
   - For each test user above, call `/api/me`.
   - Expected:
     - admin returns `role: "admin"` and never blocked by capability checks
     - non-admin `plan` from `/api/me` matches the `plan` in any capability-gate error payloads

## Regression checks
- `/properties`, `/tenants`, and admin pages still load for admin users.
- Tenant messaging routes continue to authorize correctly.
