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

Workload Identity Federation and Vercel identity-bridge resources are deliberately absent from this initial checkpoint. They require review after the authenticated Cloud Run service and service-level invoker binding are verified.
