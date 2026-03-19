# Move-In Requirements Tracking v1

## Purpose
Move-In Requirements Tracking v1 gives landlords a structured view of the explicit items that should be completed before move-in. It complements the derived move-in readiness summary by tracking item-by-item state.

## Surface
- Landlord tenant detail view
- Displayed near the existing move-in readiness module

## Tracked items
- Lease signed
- Tenant portal invite sent
- Tenant portal activated
- Deposit received
- Insurance received
- Utility setup received
- Inspection scheduled
- Inspection completed
- Keys release ready

## Progress logic
- `requiredCount` counts only items marked `required: true`
- `completedCount` counts only required items with `state: complete`
- `progressPercent` is completed required items divided by required items
- If no current move-in context exists, the model remains `unknown`

## Relationship to readiness
- Requirements tracking = explicit structured item states
- Move-in readiness = derived operational summary based on requirement completion and move-in evidence

## What v1 does not do
- No tenant-facing completion workflow
- No payment, e-sign, or email ingestion implementation
- No inspection scheduling engine
- No broad admin editing surface

## Future extensions
- Tenant portal completion actions
- Deposit, insurance, and utility ingestion
- Internal/manual item updates
- Inspection workflow hooks
- Property-level requirement rollups
