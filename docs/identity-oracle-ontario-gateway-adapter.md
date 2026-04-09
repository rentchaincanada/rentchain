# Identity Oracle Ontario Gateway Adapter

## Purpose
Developer notes for the Ontario external gateway Identity Oracle adapter introduced in v1.

## Source Type Chosen
- `PAID_GATEWAY`

## Gateway Mode In This Mission
- v1 uses a gateway abstraction with stubbed response handling
- no live Ontario paid gateway credentials are required or exercised in this mission

## Policy Gate Behavior
- Ontario gateway verification is attempted only when policy allows it
- policy may deny when:
  - gateway policy is disabled
  - source is unsupported
  - province is unsupported
  - identifier type is unsupported
  - required inputs are missing

## Usage Gate Behavior
- usage gating is implemented as a lightweight allow/deny hook
- this mission does not mutate billing state
- this mission does not create checkout, invoicing, or metering side effects

## Required Fields For Strong Match Confidence
- normalized 9-digit PIN
- property address context
- gateway address fields
- stable gateway property identifier

## Status Behavior
- `SYNTAX_ONLY` for policy/usage denied fallback
- `VERIFIED_MATCH` for strong PIN + address alignment
- `PARTIAL_MATCH` for plausible but incomplete alignment
- `UNVERIFIED` for deterministic no-match
- `SOURCE_UNAVAILABLE` for malformed, unavailable, or unusable gateway responses
- `MANUAL_REVIEW_REQUIRED` when deterministic resolution is blocked

## V1 Limitations
- live paid verification is not exercised in this mission
- gateway health is configuration/stub-shape based
- no billing or usage charging occurs
- no public access is added
- no tenant/application/lease/billing state is mutated

## Future Expansion
- connect a live Ontario gateway implementation behind the same client abstraction
- strengthen usage controls with real metering integration
- add richer confidence inputs from authoritative parcel/property fields
