# Phase B B1 Project State

## State classification

The `RentChain Preview` project is a permanent, isolated, non-production administrative foundation. Its current classification is **B1 complete; B2 unstarted**.

This state record captures supplied administrative evidence without querying or changing cloud configuration.

## Administrative state

| Field | Value | B1 assessment |
| --- | --- | --- |
| Project name | `RentChain Preview` | Recorded |
| Project ID | `rentchain-preview` | Recorded |
| Project number | `501298948635` | Recorded |
| Organization placement | `rentchain-ca-org` | Confirmed |
| Billing attachment | Attached | Confirmed without recording billing identifiers |
| Labels | Configured | Confirmed |
| Budget | Configured | Confirmed |
| Monthly planning ceiling | CAD 100 | Confirmed |
| Alert thresholds | 25%, 50%, 75%, 90%, 100% | Confirmed |
| Production isolation | Confirmed | No production coupling recorded |

## Service and workload state

| Surface | Current state | Boundary |
| --- | --- | --- |
| APIs | Disabled | Must remain disabled until separately authorized |
| Cloud Run | None | No service or workload exists |
| Artifact Registry | None | No repository or image exists |
| Firebase | Not initialized | No Firebase project linkage is recorded |
| Firestore | Not initialized | No database or data exists |
| Storage | None | No bucket or object exists |
| Custom IAM | None | No custom role or binding is recorded |
| Custom service accounts | None | No workload or deployment identity exists |
| Workload Identity | None | No pool, provider, or federation binding exists |
| Terraform | Not configured | No workspace, state, variables, or managed resources exist |

## Isolation assessment

The supplied state is consistent with the Phase B plan: a dedicated non-production project exists without application resources, identities, data services, runtime dependencies, or production coupling. Nothing in this package changes production, PR #1435, Operational Credits, or an external provider.

## Spike relationship

`RentChain-BoundedOIDC` was the temporary bounded feasibility project. Its workload was successfully retired as recorded by PR #1441, and the project is pending deletion after that retirement. It is not the permanent Preview project and is not part of the B1 foundation.

## Drift and future verification

This file is the B1 completion baseline. A future separately authorized stage must compare live administrative state against this baseline before making changes. Any unexpected enabled API, runtime, repository, data service, IAM customization, service account, federation resource, Terraform configuration, or production dependency is a stop condition requiring review.

The baseline does not authorize cloud inspection or remediation by itself.

## B2 boundary

B2 has not started. No conclusion in this state record authorizes API activation, Terraform setup, IAM configuration, Firebase initialization, workload deployment, federation, Vercel changes, or any other technical foundation work.
