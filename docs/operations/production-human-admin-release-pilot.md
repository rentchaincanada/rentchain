# Production human-admin release pilot

Status: repository preparation only. The pilot is not activated by merging this document. Every candidate deployment and promotion command requires fresh Founder authorization.

## Governance

The pilot uses Reviewer Model 3:

- GitHub workflows prepare and preserve non-secret evidence only.
- No GitHub machine identity holds Production mutation authority.
- A human operator prepares each request; a Founder reviews candidate and promotion evidence separately.
- Self-review is prohibited. The person preparing or executing a stage cannot be its sole approver.
- The Founder may approve both stages, but candidate authorization never implies promotion authorization.
- A separately authenticated approved administrator executes at most one reviewed command per authorization.
- Process controls do not create field-level IAM separation. The administrator remains technically capable of broader Cloud Run updates; exact command review, interactive authentication, Cloud Audit Logs, and recorded evidence are compensating controls.

Roles:

| Role | Responsibility |
| --- | --- |
| Operator | Starts evidence-preparation workflows and assembles non-secret evidence |
| Founder approver | Independently reviews and authorizes candidate and promotion stages |
| Human administrator | Authenticates interactively, revalidates evidence, executes exactly the authorized command, and records results |
| Transition owner | Tracks releases, elapsed time, incidents, and migration to Reviewer Model 1 |

## Sunset

The pilot ends at the earliest of:

- five successful Production releases;
- 90 days from the recorded pilot activation date;
- activation of automated Production releases;
- sufficient independent reviewers to adopt Reviewer Model 1;
- Founder cancellation.

Do not invent an activation date. At activation, record the pilot start date, calculated 90-day sunset date, release count starting at zero, and transition owner in the approved release record. Reassess after every release.

## Candidate procedure

The candidate request artifact is a proposal, not execution authorization.

1. Confirm the Founder-approved full source SHA.
2. Confirm the SHA is reachable from protected `main`.
3. Confirm build provenance, immutable digest, and exact `sha-<source SHA>` tag.
4. Confirm the active build trigger and verified build-only identity are unchanged.
5. Record current Production created/ready revisions, traffic, template, and `/health` result.
6. Confirm no Cloud Run operation or other deployment is active.
7. Obtain fresh Founder candidate authorization for the exact artifact and command.
8. Authenticate interactively as the approved administrator; do not use a GitHub or legacy-deployer credential.
9. Re-run every preflight check and compare the proposed command byte-for-byte with the authorized command.
10. Execute one digest-pinned zero-traffic deployment.
11. Identify the resulting candidate revision.
12. Prove the candidate has zero traffic and is Ready.
13. Prove the candidate revision image equals the approved immutable digest.
14. Compare governed template fields with the pre-deployment baseline.
15. Confirm the serving Production revision and `/health` remain unchanged.
16. Record all candidate evidence and stop before promotion.

The preparation workflow emits this inert form:

```text
gcloud run deploy rentchain-landlord-api \
  --image=<IMMUTABLE_DIGEST_REFERENCE> \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --revision-suffix=candidate-<SOURCE_SHA_12> \
  --no-traffic \
  --quiet
```

The template is not pre-authorized for execution. Replace placeholders only from reviewed evidence and obtain explicit Founder authorization for the final command.

## Promotion procedure

1. Confirm the candidate-preparation run and human-admin candidate evidence are linked.
2. Confirm the exact source SHA, immutable digest, candidate revision, administrator, and timestamps.
3. Confirm the candidate remains Ready, uses the approved digest, and has zero traffic.
4. Record current Production traffic, ready revision, and `/health` result.
5. Obtain a separate Founder promotion authorization for the exact revision and command.
6. Authenticate interactively as the approved administrator and execute one exact revision traffic command.
7. Verify 100% traffic targets the approved revision.
8. Verify Production `/health` returns HTTP 200 and record any readiness observations.
9. Record the command, result, approver, timestamps, and incident notes.
10. Use rollback only under separate Founder authorization unless a documented active-outage response was explicitly pre-authorized.

The preparation workflow emits inert promotion and rollback templates. It never executes them.

## Required release evidence

Each release record must contain:

- release number;
- pilot start date, current release count, sunset date, and transition owner;
- approved source SHA and immutable image digest;
- candidate request ID and preparation run URL;
- candidate administrator identity, command, timestamp, and authorization;
- candidate revision, zero-traffic proof, readiness proof, digest proof, and template-parity proof;
- promotion request ID and preparation run URL;
- separate promotion authorization and approver identity;
- traffic command, traffic result, Production health result, and timestamp;
- rollback command template, rollback authorization/status, and incident notes.

Evidence artifacts must remain non-secret. Do not record access tokens, credentials, cookies, secret environment values, signed URLs, or credential files.

## Failure and rollback boundaries

- Any failed validation stops the stage without mutation.
- A candidate readiness, digest, template, or zero-traffic mismatch stops before promotion.
- A serving-health regression after candidate creation stops and requires incident review; candidate creation does not authorize traffic.
- Promotion failure triggers evidence capture and escalation. Rollback is a separate mutation and requires separate authorization unless the approved incident procedure explicitly covers it.
- The build-only trigger continues to publish immutable images and cannot deploy.
- The legacy deployer remains enabled with zero authority and must not be reused.
- Preview, Vercel, PR #1453, and PR #1435 remain out of scope.

## Deferred automation

Automated promoter authority remains prohibited until an isolated, non-Production runtime test proves the behavior of promotion without runtime-service-account `actAs` and the Founder separately approves the resulting design. The target governance model is Reviewer Model 1. A privileged release broker remains the preferred long-term architecture and must be reconsidered when release frequency, staffing, compliance requirements, or manual burden justify it.
