# Signing Provider Evaluation

## Decision

Selected production provider: Dropbox Sign.

Local provider: mock.

## Current Research

- Dropbox Sign maintains official API documentation at `https://developers.hellosign.com/docs/overview` and documents full endpoint testing with `test_mode`.
- Dropbox Sign documents migration to the maintained `@dropbox/sign` Node package at `https://developers.hellosign.com/docs/sd-ks/migration-guides/node`; package version selected for this mission is `1.10.0`.
- BoldSign has a Node SDK and embedded signing support documented in its repository and embedded signing documentation, but its operational footprint is less aligned with the existing RentChain provider-governance pattern.
- HelloSign is treated as Dropbox Sign legacy naming, not a separate provider choice.

## Evaluation Matrix

| Provider | Strengths | Risks | Outcome |
| --- | --- | --- | --- |
| Dropbox Sign | Official Node package, test mode, mature e-signature API, legacy HelloSign continuity | SDK is ESM-focused while backend currently compiles CommonJS, so production adapter remains isolated | Selected |
| BoldSign | Node SDK, sandbox, embedded signing link support | New dependency surface and less existing naming continuity | Future adapter candidate |
| HelloSign | Existing market familiarity | Rebranded into Dropbox Sign and legacy SDK paths | Not selected as separate provider |

## Implementation Choice

The mission adds a provider-neutral interface, mock provider, and Dropbox Sign adapter boundary. Runtime local workflows use the mock provider by default. The Dropbox Sign SDK is pinned for future production implementation, while the adapter remains isolated to avoid pulling SDK internals into route code.

## Governance Notes

- Tenant responses do not expose provider request IDs.
- Landlord responses expose signing workflow status and internal signing request reference only.
- Webhooks are validated before processing and invalid provider payloads are rejected or dead-lettered.
- Lease state is derived from request and event facts.
