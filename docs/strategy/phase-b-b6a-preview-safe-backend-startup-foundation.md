# Phase B B6A Preview-Safe Backend Startup Foundation

## Status

B6A establishes an explicit Preview startup contract. It does not deploy Cloud Run, provision Firestore or Secret Manager, create fixtures, configure Vercel routing, or authorize PR #1453 deployment.

## Environment contract

- `APP_ENV=preview` is required for Preview.
- `GOOGLE_CLOUD_PROJECT=rentchain-preview` is required in Preview.
- Preview rejects the production project `project-0d9658de-af29-4dc0-a99`.
- Production remains strict and must use the approved production project.
- Preview does not infer its identity from `NODE_ENV`, hostname, or missing secrets.

## Datastore boundary

Firestore is explicitly disabled while `FIRESTORE_ENABLED` is not `true`. Firebase Admin does not initialize credentials in this mode. Datastore-dependent routes must fail safely until a separately authorized isolated Preview datastore exists.

The B6A change does not provision a datastore, grant runtime IAM, create secrets, or copy production credentials.

## Health contract

- `/health` is liveness: it reports that the process and routes are running, plus sanitized environment metadata.
- `/health/ready` returns `503` with `datastore: deferred` when Preview Firestore is disabled.
- Readiness must not claim datastore availability that has not been provisioned.

## Remaining B6 prerequisites

Before a Preview workload can be considered ready, a separately authorized mission must provide an isolated Preview datastore, approved Secret Manager configuration for any required secrets, least-privilege runtime IAM, and deployment verification. No production project, credential, provider secret, payment integration, screening integration, or fixture is in scope here.
