# Environment Separation Incident Response v1

## Purpose

This runbook defines response steps for suspected preview, staging, development, or production environment separation breaches.

## Incident Types

| Type | Example | Severity Driver |
| --- | --- | --- |
| Preview-to-production write | Preview workflow mutates production data unexpectedly | Tenant data impact |
| Production-to-preview routing | Production frontend points to preview backend | Service integrity impact |
| Credential exposure | Secret appears in logs, docs, code, or deployment output | Credential scope |
| Wrong backend host | Vercel env or rewrite routes to wrong Cloud Run host | User/data impact |
| Wrong Firestore target | Backend initializes against unexpected database/emulator | Data integrity impact |
| Wrong auth project | Frontend Firebase config points to unintended Auth project | Account access impact |

## Immediate Containment

1. Stop new deployments.
2. Identify affected environment and deployment SHA.
3. Disable or roll back the misconfigured deployment if active traffic is affected.
4. Preserve Cloud Run, Vercel, Firestore, Auth, and CI logs.
5. Rotate exposed secrets if credential exposure is possible.
6. Prevent further writes if production data may be affected.
7. Notify the responsible operator and security reviewer.

## Investigation Checklist

- Which frontend deployment served the request?
- Which API host received the request?
- Which backend revision processed it?
- Which runtime identity was used?
- Which Firestore collections were read or written?
- Which auth token issuer and role/scope were involved?
- Was the access expected for that environment?
- Were raw secrets, tokens, or provider payloads exposed?
- Were tenant, landlord, admin, or support boundaries crossed?

## Scenario: Preview Code Mutated Production Data

1. Freeze preview deployment and stop test actions.
2. Identify write window from Cloud Run and Firestore logs.
3. List affected collections and documents without exposing raw IDs publicly.
4. Determine whether correction requires append-safe remediation.
5. Avoid destructive rollback unless explicitly authorized.
6. Notify affected stakeholders according to governance policy.
7. Add routing or credential guardrails before preview resumes.

## Scenario: Production Frontend Routed To Preview Backend

1. Roll back Vercel deployment or restore correct environment variable.
2. Confirm production `/api` requests reach production backend.
3. Review preview backend logs for production user traffic.
4. Check whether tokens or cookies were sent to wrong backend.
5. Rotate secrets if backend trust boundary was compromised.
6. Document duration and affected user paths.

## Scenario: Secret Exposure

1. Revoke or rotate exposed secret.
2. Remove exposure from code/docs/logs where possible.
3. Redeploy affected service with replacement value.
4. Verify old value fails.
5. Search for repeated exposure.
6. Record root cause and prevention.

## Scenario: Wrong Firestore Target

1. Stop affected backend revision.
2. Confirm health metadata and runtime env values.
3. Identify read/write impact window.
4. Preserve Firestore audit evidence.
5. Use append-safe correction where required.
6. Re-enable only after startup guard and environment assignment are verified.

## Postmortem Requirements

- Timeline of detection, containment, and recovery.
- Root cause and failed control.
- Affected environment, users, collections, and routes.
- Whether data was read, written, exported, or exposed.
- Credential rotation record if applicable.
- Follow-up controls and owner.
- Verification evidence that separation is restored.
