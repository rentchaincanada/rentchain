# Bounded Vercel-to-Cloud-Run OIDC feasibility spike

This directory contains the minimal dependency-free hello service for the separately authorized identity-bridge spike. It is not RentChain application code and has no database, Firebase, storage, provider, payment, messaging, or customer-data dependency.

The service returns only success status, its fixed service name, the injected exact commit SHA, the Cloud Run-provided revision, and a server-generated timestamp.

The authorized deployment constraints are:

- isolated non-production project only;
- `northamerica-northeast1`;
- runtime identity `cloud-run-spike-runtime`;
- IAM-authenticated invocation only;
- zero minimum instances and one maximum instance;
- no static service-account key;
- no production resource or credential;
- maximum CAD 10 incremental cost; and
- teardown within 24 hours.

## Identity-bridge result

The first controlled Vercel Preview exchange attempt reached Google Security Token Service and was rejected because the implementation used one audience representation for two distinct protocol boundaries. No federated access token was issued during that attempt, and no IAM change followed it.

The revised exact-head implementation then validated the complete bounded bridge:

1. Vercel issued a Preview OIDC assertion for the HTTPS Workload Identity Provider audience.
2. Google Security Token Service accepted the canonical provider resource audience.
3. The restricted federated identity generated a Google-signed ID token for the exact Cloud Run service audience.
4. The authenticated Cloud Run request returned only the expected hello evidence.

The positive path passed. Anonymous access, a malformed bearer token, and an intentionally wrong Cloud Run ID-token audience were denied. Both temporary service accounts had zero user-managed keys, federation was restricted to one exact Preview subject, and Cloud Run Invoker was scoped to the single temporary service.

The revised implementation keeps three audience domains separate and derives them from existing Preview-only identifiers:

- the Vercel-issued OIDC token uses the HTTPS Workload Identity Provider URL;
- the Google Security Token Service request uses the canonical `//iam.googleapis.com/...` provider resource name; and
- the Google-signed ID token uses the exact Cloud Run service URL.

These values are separately named and tested. The HTTPS and canonical provider audiences are derived from `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, and `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`; no additional credential or ambiguous shared audience variable is required.

Classification: **Identity bridge validated under bounded non-production conditions**.

## Teardown

The temporary Vercel Preview configuration and manual deployment, Workload Identity Pool and provider, IAM bindings, Cloud Run service and revision, image and Artifact Registry repository, source-bucket read binding, and both spike service accounts were removed on `2026-07-21`. The isolated project was retained without an active spike workload; project deletion or reuse requires separate authorization.

The bridge source and focused tests in this branch are reusable technical proof and do not require live cloud resources. The temporary Preview API route was removed after validation, so the merged proof cannot expose an active spike endpoint. This validation does not cover Firebase Auth, Firestore, authenticated user fixtures, full preview infrastructure, or product workflow QA, and it does not authorize Phase B.
