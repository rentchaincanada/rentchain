# Messaging Entitlements + Legacy Limits QA

## Messaging gate checks
1. Admin user:
   - Request `GET /api/landlord/messages/conversations`
   - Expect `200`.
   - No upgrade gate for messaging.
2. Elite/pro landlord:
   - Request `GET /api/landlord/messages/conversations`
   - Expect `200`.
3. Starter landlord:
   - Request `GET /api/landlord/messages/conversations`
   - Expect `403` with:
     - `ok: false`
     - `error: "Upgrade required"`
     - `capability: "messaging"`
     - `plan: "starter"`

## Entitlements consistency checks
1. Request `GET /api/me` for each role above.
2. Confirm `/api/me` role/plan matches capability gate behavior for same user.
3. Confirm admin remains unblocked regardless of plan value in downstream checks.

## Legacy limits grep audit
Run from repo root:

```bash
rg -n "screeningCredits|screening_credits|/api/screening-credits" rentchain-api/src rentchain-frontend/src
rg -n "maxProperties|maxUnits|propertyLimit|propertiesLimit|unitLimit|unitsLimit|LIMIT_PROPERTIES|LIMIT_UNITS" rentchain-api/src rentchain-frontend/src
```

Expected result:
- No matches for `screeningCredits` patterns.
- No matches for `maxProperties`, `maxUnits`, `LIMIT_PROPERTIES`, `LIMIT_UNITS`, and related property/unit limit markers.
