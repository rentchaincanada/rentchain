# Production human-admin release pilot

Status: Active — dry rehearsal phase. Activation does not authorize a candidate deployment, promotion preparation, traffic change, or rollback.

## Activation record

| Field | Activated value |
| --- | --- |
| Activation date | `2026-08-02` |
| Completed Production releases | `0` |
| Technical operator | `Boulos001` |
| Founder approver | `rentchaincanada` |
| Reviewer model | Model 3 |
| Self-review | Prohibited |
| First authorized action | Candidate-preparation dry rehearsal |
| Production candidate deployment | Not authorized |
| Promotion preparation | Not authorized |
| Traffic promotion | Not authorized |

The dry rehearsal does not count as a completed Production release, so the release counter remains zero. Pilot activation does not authorize any mutation command. Every real candidate deployment requires a new, explicit Founder authorization, and every real promotion requires a second, separate Founder authorization.

The pilot expires at the earliest of:

- five completed Production releases;
- `2026-10-31`;
- activation of automated Production releases;
- sufficient independent reviewers for Reviewer Model 1;
- Founder cancellation.

### Approved dry-rehearsal evidence

| Field | Approved value |
| --- | --- |
| Source SHA | `0757e284c32341df4bb9b464a32c4e13815bca83` |
| Immutable tag | `sha-0757e284c32341df4bb9b464a32c4e13815bca83` |
| Artifact Registry repository | `rentchain-api` |
| Artifact Registry package | `rentchain-landlord-api` |
| Immutable digest | `sha256:b06be8a74101998e43aecdd0e18f60ffaf518b0cbe8501b1bbde6d3a29af085f` |
| Complete immutable image reference | `us-central1-docker.pkg.dev/project-0d9658de-af29-4dc0-a99/rentchain-api/rentchain-landlord-api@sha256:b06be8a74101998e43aecdd0e18f60ffaf518b0cbe8501b1bbde6d3a29af085f` |

The earlier reference containing `/rentchain-api/rentchain-api@sha256:...` was incorrect and must not be used. Build `9eca674c-6164-44f1-b519-7bdbff3fd1f6` and Artifact Registry evidence proved that the immutable package is `rentchain-landlord-api`. This approval authorizes only one evidence-preparation rehearsal. It does not authorize creation of a candidate revision or execution of the generated deployment command.

## Candidate startup incident and correction

### Rejected replacement digest: fatal startup exited successfully

Cloud Build `5bb65876-f98e-4522-ac30-fd5d1976a3b6` published digest `sha256:ac1fdfb6bfe64473098db631a3daf54c4e9e950ac649fc10408f1f81259b3f7c`. Exact-image testing proved that missing or incorrect Production project configuration logged the expected fatal error but exited with status `0`, so the runtime contract failed and no private smoke service was deployed. This digest is ineligible for smoke, candidate deployment, or promotion and must not be retagged or overwritten. A corrected replacement image must be built only from a later merged SHA under separate authorization.

Candidate `rentchain-landlord-api-candidate-0757e284c323` failed during the separately authorized promotion attempt on `2026-08-03`. Its process exited before listening on port 8080 with `Production requires GOOGLE_CLOUD_PROJECT to be explicitly configured.` The healthy revision `rentchain-landlord-api-01967-djh` remained at 100% traffic, the failed candidate returned to zero traffic, and the completed Production release counter remains zero. No promotion retry is authorized.

The runtime guard is intentionally fail closed. Production must explicitly receive the non-secret configuration `GOOGLE_CLOUD_PROJECT=project-0d9658de-af29-4dc0-a99`. Root Terraform is not the authoritative owner for this correction: it still models an obsolete Montréal service and image with no live environment configuration. Applying that model could reintroduce unrelated service drift. Until full Terraform reconciliation is separately approved, the reviewed human-admin candidate command uses the additive `--update-env-vars` operation for this one value. It must never use `--set-env-vars`, `--clear-env-vars`, or `--env-vars-file`, because those operations replace or clear existing environment configuration.

The incident also proved that zero-traffic revision metadata was insufficient startup evidence. Image import and revision readiness without an active instance do not prove that the application process starts, binds `0.0.0.0:$PORT`, or serves `/health`. CI must start the exact Dockerfile output without Production credentials and verify the listener and HTTP 200 health response before a replacement image can be approved.

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
7. Confirm the generated command additively supplies the approved `GOOGLE_CLOUD_PROJECT` value and contains no environment replacement operation.
8. Confirm the exact immutable image passed the CI runtime contract and the separately authorized isolated Cloud Run smoke described below.
9. Obtain fresh Founder candidate authorization for the exact artifact and command.
10. Authenticate interactively as the approved administrator; do not use a GitHub or legacy-deployer credential.
11. Re-run every preflight check and compare the proposed command byte-for-byte with the authorized command.
12. Execute one digest-pinned zero-traffic deployment.
13. Identify the resulting candidate revision.
14. Prove the candidate has zero traffic and is Ready.
15. Prove the candidate revision image equals the approved immutable digest and contains the explicit project configuration.
16. Compare governed template fields with the pre-deployment baseline, allowing only the reviewed project-variable addition.
17. Confirm the serving Production revision and `/health` remain unchanged.
18. Record all candidate evidence and stop before promotion.

The preparation workflow emits this inert form:

```text
gcloud run deploy rentchain-landlord-api \
  --image=<IMMUTABLE_DIGEST_REFERENCE> \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --revision-suffix=candidate-<SOURCE_SHA_12> \
  --update-env-vars=GOOGLE_CLOUD_PROJECT=project-0d9658de-af29-4dc0-a99 \
  --no-traffic \
  --quiet
```

The template is not pre-authorized for execution. Replace placeholders only from reviewed evidence and obtain explicit Founder authorization for the final command.

## Promotion procedure

1. Confirm the candidate-preparation run and human-admin candidate evidence are linked.
2. Confirm the exact source SHA, immutable digest, candidate revision, administrator, and timestamps.
3. Confirm the candidate remains Ready, uses the approved digest, has zero traffic, and includes the approved explicit project configuration.
4. Require evidence that an instance using the exact immutable digest was started in the approved isolated smoke boundary, `/health` returned HTTP 200, and corresponding successful startup logs were captured.
5. Record current Production traffic, ready revision, and `/health` result.
6. Obtain a separate Founder promotion authorization for the exact revision and command.
7. Authenticate interactively as the approved administrator and execute one exact revision traffic command.
8. Verify 100% traffic targets the approved revision.
9. Verify Production `/health` returns HTTP 200 and record any readiness observations.
10. Record the command exit separately from authoritative traffic and health state, plus approver, timestamps, and incident notes.
11. Use rollback only under separate Founder authorization unless a documented active-outage response was explicitly pre-authorized.

The preparation workflow emits inert promotion and rollback templates. It never executes them.

## Required release evidence

Each release record must contain:

- release number;
- pilot start date, current release count, sunset date, and transition owner;
- approved source SHA and immutable image digest;
- candidate request ID and preparation run URL;
- candidate administrator identity, command, timestamp, and authorization;
- candidate revision, zero-traffic proof, readiness proof, digest proof, and template-parity proof;
- explicit Production project-configuration proof;
- candidate instance-start proof, isolated smoke method, `/health` status, exact-digest proof, startup-log proof, and null startup error;
- promotion request ID and preparation run URL;
- separate promotion authorization and approver identity;
- traffic command, command exit code, authoritative traffic state, authoritative Production health state, and timestamp;
- rollback command template, rollback authorization, rollback command exit code, authoritative post-rollback traffic and health states, and incident notes.

Evidence artifacts must remain non-secret. Do not record access tokens, credentials, cookies, secret environment values, signed URLs, or credential files.

## Failure and rollback boundaries

- Any failed validation stops the stage without mutation.
- A candidate readiness, digest, template, or zero-traffic mismatch stops before promotion.
- Missing instance-start evidence, a non-200 candidate smoke, a digest mismatch, missing startup logs, or any startup error stops before promotion. Zero-traffic revision metadata alone is never sufficient.
- A serving-health regression after candidate creation stops and requires incident review; candidate creation does not authorize traffic.
- Promotion failure triggers evidence capture and escalation. Rollback is a separate mutation and requires separate authorization unless the approved incident procedure explicitly covers it.
- A nonzero promotion or rollback command exit is recorded independently from authoritative routing and health observations. It does not authorize a retry, and it must not be treated by itself as proof that serving traffic is unhealthy.
- The build-only trigger continues to publish immutable images and cannot deploy.
- The legacy deployer remains enabled with zero authority and must not be reused.
- Preview, Vercel, PR #1453, and PR #1435 remain out of scope.

## Deferred automation

### Recommended isolated smoke architecture

Use a dedicated temporary, private Cloud Run smoke service rather than disrupting Preview or exposing a tagged Production revision. Under separate authorization, deploy the exact immutable digest with isolated non-secret configuration, no public access, no Production traffic, and no Production secret values unless separately reviewed as unavoidable. Send an authenticated `/health` request, verify HTTP 200, verify the running revision resolves to the approved digest, capture successful startup logs for that exact smoke revision, and remove the temporary service under separate cleanup authorization. The smoke service does not authorize creation or promotion of a Production candidate.

Promotion preparation fails closed unless the evidence records `candidateInstanceStarted=true`, the isolated smoke method, `candidateSmokeHttpStatus=200`, `candidateSmokePath=/health`, exact-digest verification, successful startup-log observation, and `candidateStartupError=null`. Creating this smoke service is not authorized by the current repository correction.

Automated promoter authority remains prohibited until an isolated, non-Production runtime test proves the behavior of promotion without runtime-service-account `actAs` and the Founder separately approves the resulting design. The target governance model is Reviewer Model 1. A privileged release broker remains the preferred long-term architecture and must be reconsidered when release frequency, staffing, compliance requirements, or manual burden justify it.
