# Cloud Run Separation Enforcement v1

## Scope

This document records current Cloud Run/backend separation controls and review requirements. It does not modify Cloud Run configuration, deployment pipelines, IAM, environment variables, or runtime code.

## Current Backend Deployment

`rentchain-api/cloudbuild.yaml` builds the backend image and deploys a Cloud Run service using substitutions for region, service, repository, image name, and image tag. The committed deployment path targets the production backend service and uses `--allow-unauthenticated`; application authorization remains enforced by backend routes and middleware.

The frontend currently rewrites `/api/:path*` and `/health` to `https://rentchain-landlord-api-915921057662.us-central1.run.app`.

## Runtime Separation Controls

- Production backend startup is allowed when `NODE_ENV=production`.
- Missing hard-required env values fail production startup in `requiredEnv.ts`.
- Firebase Admin initialization goes through `rentchain-api/src/firebase/admin.ts`.
- Firestore environment guard blocks local/development/test Admin initialization unless emulator or explicit diagnostic override is configured.
- Application route authorization remains the boundary for tenant, landlord, admin, and support data access.

## Deployment Checklist

Before a Cloud Run deployment:

1. Confirm target service is the intended production service.
2. Confirm image tag corresponds to the approved commit.
3. Confirm runtime environment variables are production scoped.
4. Confirm runtime identity has only the access required for the production backend.
5. Confirm no preview or local Firestore emulator variables are present.
6. Confirm frontend API routing points to the intended backend host for the deployed environment.
7. Confirm health endpoint returns expected Firebase initialization mode.

## Separation Breach Signals

Investigate immediately if any of the following appear:

- Production Cloud Run revision logs show emulator variables.
- Preview deployment unexpectedly sends traffic volume to production API.
- Production Firestore receives writes from an unexpected runtime identity.
- API health metadata reports an unexpected initialization mode.
- Vercel preview traffic produces production data mutations outside operator-approved QA.

## Rollback Procedure

1. Stop additional deploys.
2. Identify last known good Cloud Run revision.
3. Route traffic back to the known good revision.
4. Verify health endpoint and auth-protected route behavior.
5. Review Firestore writes during the incident window.
6. Preserve Cloud Run, Vercel, and Firestore audit logs.
7. Document root cause and required prevention.

## IAM Review Requirements

Cloud Run runtime identity details are not committed in source and must be reviewed in the cloud console by an authorized operator. The review must verify:

- No broad owner/editor grants.
- Firestore access limited to required backend operations.
- Storage access limited to required buckets.
- Secret access limited to required runtime secrets.
- Preview services, if introduced, use separate identity and separate secret scope.

## Known Gaps

- No separate preview Cloud Run service is committed in source.
- Cloud Run IAM bindings are not inspectable from repository files.
- `cloudbuild.yaml` deploys the production service; it is not a preview deployment manifest.
