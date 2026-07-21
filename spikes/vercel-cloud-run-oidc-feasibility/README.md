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

## Identity-bridge checkpoint

The bounded non-production resources were created and reviewed through the first controlled Vercel Preview exchange attempt. The retained configuration remains limited to one IAM-protected hello service, one service-level invoker binding, one Workload Identity Pool and provider, and one exact-subject Workload Identity User binding. Both service accounts have zero user-managed keys.

The exact-head Preview route acquired a short-lived Vercel OIDC assertion, then Google Security Token Service rejected the exchange with HTTP 400. No federated access token was issued, so service-account impersonation, Google ID-token generation, and authenticated Cloud Run invocation were not attempted. No IAM change or second exchange attempt followed.

The revised implementation keeps three audience domains separate and derives them from existing Preview-only identifiers:

- the Vercel-issued OIDC token uses the HTTPS Workload Identity Provider URL;
- the Google Security Token Service request uses the canonical `//iam.googleapis.com/...` provider resource name; and
- the Google-signed ID token uses the exact Cloud Run service URL.

These values are separately named and tested. The HTTPS and canonical provider audiences are derived from `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, and `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`; no additional credential or ambiguous shared audience variable is required.

The controlled retry result and final classification are recorded as exact-head PR evidence so this architecture note does not imply an unverified outcome.

This result does not authorize Phase B. Temporary resources remain bounded by the CAD 10 and 24-hour limits and must be removed after the evidence review window.
