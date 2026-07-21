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

The current implementation uses the HTTPS provider URL both as the Vercel token audience and as the Security Token Service request audience. Google accepts the canonical provider name with or without the HTTPS prefix as the incoming OIDC token audience when the provider has no explicit allowed-audience list, while its Security Token Service examples use the `//iam.googleapis.com/...` canonical resource form for the request audience. Separating those two audience representations is the narrow revision to review before another attempt.

Classification: **Identity bridge requires revision**.

This result does not authorize Phase B. Temporary resources remain bounded by the CAD 10 and 24-hour limits and must be removed after the evidence review window.
