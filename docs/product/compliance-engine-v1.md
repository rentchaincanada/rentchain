# Compliance Engine v1

## Scope
- Province-aware compliance rules registry with a consistent interface.
- Ontario rules module for v1.
- Nova Scotia stub rules module for v1 compatibility.
- Auth-protected API endpoint for rules lookup:
  - `GET /api/compliance/rules?province=ON`

## Out of scope
- No lifecycle automation scheduling.
- No notice drafting or sending.
- No legal notice dispatch workflows.

## API
- Endpoint: `GET /api/compliance/rules?province={code}`
- Auth: required
- Current supported province codes:
  - `ON`
  - `NS`
- Response:
  - `ok`
  - `province`
  - `complianceVersion` (`v1`)
  - `rules` object with:
    - `rentIncrease`
    - `leaseEnd`
    - `notices`

## Rule shape
- `rentIncrease`
  - `minMonthsBetweenIncreases`
  - `noticeDays`
  - `exemptions` (optional)
- `leaseEnd`
  - `renewalWindowDays`
  - `fixedTermBehavior`
- `notices`
  - `entryNoticeMinHours`

## Versioning
- This release stamps all rule payloads with `complianceVersion: "v1"`.
- Future changes should be additive or versioned to avoid silent behavior changes.
