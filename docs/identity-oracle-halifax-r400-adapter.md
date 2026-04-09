# Identity Oracle Halifax R-400 Adapter

## Purpose
Developer notes for the Halifax R-400 Identity Oracle adapter introduced in v1.

## Source Type Chosen
- `OPEN_DATASET`

Reason:
- the adapter reads Halifax R-400 registry data from the existing HRM open-data ingestion path
- no paid gateway or feature-service integration is introduced in v1

## Source Assumptions
- Halifax R-400 normalized records are available in `registryRecordsNormalized`
- each trusted record includes:
  - `sourceKey`
  - `jurisdictionProvince`
  - `jurisdictionMunicipality`
  - `registryRecordId`
  - `pid`
  - normalized address data
- PID lookup is the primary verification path in v1

## Verification Assumptions
- namespace for PID verification is `NS:PVSC:<pid>`
- related Halifax registration identifiers may be surfaced as `NS:HRM:<registration_number>`
- strong PID + property-address alignment can produce `VERIFIED_MATCH`
- PID-only or multi-row ambiguity should not be overclaimed as full verification

## Required Fields For Strong Matching
- normalized PID
- normalized property address context
- normalized Halifax registry address
- source registration status

## V1 Limitations
- verification strength depends on imported Halifax dataset freshness
- no live HRM network fetch is performed in this mission
- no Ontario source integration is included
- no public route is added
- no application/lease/tenant state mutation is performed

## Future Strengthening Options
- stronger registration-status interpretation rules
- freshness windows tied to latest import metadata
- secondary-source fallback for PID authority resolution
- explicit operator review surfaces for `PARTIAL_MATCH` and `MANUAL_REVIEW_REQUIRED`
