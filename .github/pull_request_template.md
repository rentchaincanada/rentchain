## Summary

- 

## Changes

- 

## Validation

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`

----------------------------------------------------
## ⚠ Hook Dependency Guardrail (TDZ Safety)

If this PR modifies any of the following:
- DashboardPage.tsx
- UpgradeNudges components
- Timeline components
- Any hook-heavy module

Confirm:

- [ ] All variables referenced in hook dependency arrays are declared ABOVE the hook.
- [ ] No module-scope const references later-declared variables.
- [ ] No new circular imports were introduced.
- [ ] `npm run lint`, `npm run test`, and `npm run build` pass locally.

Reference:
- docs/engineering/hooks-tdz-guardrail.md
----------------------------------------------------
