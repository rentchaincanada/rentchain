# Mission 9D QA Checklist

## Preconditions
- Sign in as a `starter` landlord with at least one meaningful action:
  - at least 1 property, or
  - at least 1 tenant, or
  - at least 2 dashboard visits.
- Sign in as an `admin` account for bypass verification.

## Checks
1. Starter landlord hits property limit:
   - Try adding a property past cap.
   - Confirm plan-limit response includes `error: "plan_limit"` and `code: "LIMIT_PROPERTIES"`.
   - Confirm one upgrade nudge appears and is dismissible.
2. Starter landlord hits tenant limit:
   - Try inviting tenant past cap (when `STARTER_TENANT_LIMIT` is configured).
   - Confirm `code: "LIMIT_TENANTS"` response and nudge behavior.
3. Cooldown and anti-spam behavior:
   - Trigger same nudge repeatedly in same session.
   - Confirm modal/banner does not spam and only one nudge shows per session.
4. Soft nudges:
   - Visit `/help/templates`, `/reports/monthly-ops`, and screening start flow as starter.
   - Confirm contextual inline nudge appears only when cooldown allows.
5. Upgrade CTA:
   - Click `Upgrade`.
   - Confirm Stripe Billing Portal opens in a new tab when available.
   - Confirm fallback to `/pricing` if portal is unavailable.
   - Confirm app navigates to `/billing?upgradeStarted=1`.
6. Admin bypass:
   - Confirm admin can access gated pages with no upgrade nudges.
   - Confirm admin is never blocked by plan gates.
7. Telemetry:
   - Confirm `POST /api/telemetry` records:
     - `nudge_impression`
     - `nudge_dismiss`
     - `nudge_click_upgrade`
   - Confirm no PII is stored in `eventProps`.

## Regression
- Verify no console errors while navigating nudged pages.
- Verify mobile layout still renders nudge banner/card/modal controls correctly.
