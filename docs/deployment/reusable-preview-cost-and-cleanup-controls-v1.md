# Reusable Preview Cost and Cleanup Controls v1

## Status

All numeric values are proposed ceilings pending cost-owner approval. They are initial safeguards for one shared staging project and one mutable authenticated run at a time.

## Proposed numeric guardrails

| Resource/control | Proposed initial limit |
| --- | --- |
| Cloud Run minimum instances | 0 |
| Cloud Run maximum instances per PR service | 2 |
| Cloud Run concurrency | 20 requests per instance |
| Cloud Run CPU | 1 vCPU |
| Cloud Run memory | 512 MiB; raise to 1 GiB only with build/runtime evidence |
| Cloud Run request timeout | 60 seconds |
| Maximum active PR backend services | 2, with only 1 mutable QA run |
| Maximum preview lifetime | 24 hours; one approved extension to 48 hours |
| Maximum retained Cloud Run revisions per service | 3 |
| Artifact image retention | 14 days |
| Maximum retained PR images | 20 across the preview repository |
| Preview builds per PR per day | 5 |
| Firestore synthetic documents per run | 500 |
| Firestore operations per run | 10,000 reads and 2,000 writes/deletes |
| Storage data per run | 100 MiB; disabled for PR #1435 |
| Storage object retention | 24 hours unless evidence review requires up to 7 days |
| Application log retention | 7 days |
| Audit/deployment metadata retention | 30 days |
| Browser traces/screenshots | Failure-only, redacted, maximum 7 days |
| Monthly preview budget proposal | CAD 100 |
| Budget alerts | 50%, 80%, and 100% of monthly budget |
| Automatic new-deployment pause | 100% budget or abnormal daily spend above CAD 15 |
| Maximum mutable E2E concurrency | 1 |
| Seed lock duration | 2 hours with heartbeat; hard expiry at 4 hours |

The platform owner must confirm current regional pricing and translate budget alerts into the billing account's supported currency before Phase B.

## Cost controls

- Scale Cloud Run to zero.
- Reject unapproved minimum instances.
- Use one shared project before per-PR projects.
- Pin active-service and build-frequency limits.
- Apply Artifact Registry cleanup policy after provenance retention needs are met.
- Keep Storage disabled unless required.
- Use fixture and log caps.
- Pause new deployments at the cost threshold; do not automatically delete active evidence during an incident.
- Require cost-owner approval for extensions or increased limits.

## Seed and namespace model

Each run receives a non-sensitive run ID derived from PR number plus a random suffix. Seed manifests include schema version, owner, exact head, expiry, record categories, expected counts, and cleanup state.

Requirements:

- idempotent seed for the same run ID;
- collision rejection for active namespaces;
- synthetic data only;
- maximum fixture-size preflight;
- one transactionally acquired mutable-run lease;
- heartbeat during QA;
- no broad collection delete;
- no cleanup outside manifest ownership.

## Manual teardown

The run owner initiates teardown after QA or abort. Ordered actions:

1. Stop new QA traffic and mark the run closing.
2. Revoke browser sessions and disable test users.
3. Delete manifest-owned conversation and child-message fixtures.
4. Delete remaining manifest-owned tenancy, lease, unit, property, membership, user-profile, and organization fixtures in dependency-safe order.
5. Delete preview Storage objects if enabled.
6. Delete temporary per-run secrets.
7. Disable and delete the PR Cloud Run service after evidence capture.
8. Apply image/revision retention policy.
9. Release the run lease.
10. Verify zero manifest-owned resources remain and record metadata-only evidence.

## Automatic cleanup

A scheduled cleanup mechanism is a Phase B requirement but begins in report-only mode. After repeated manual teardown proves scope:

- scan only explicit preview fixture/run manifests;
- identify expired runs and orphan services/images;
- quarantine first when state is ambiguous;
- revoke sessions and disable traffic before deletion;
- enforce maximum delete counts;
- record per-category counts and outcomes;
- alert on partial failure;
- never access production projects.

PR-close and merge events should request teardown but must not bypass ownership and exact-project checks.

## Partial-failure recovery

| Failure | Immediate action | Recovery |
| --- | --- | --- |
| Session revocation fails | Disable backend traffic | Retry Auth cleanup with assigned owner |
| Firestore delete partially fails | Keep namespace quarantined | Resume from manifest cursor; do not broad-scan delete |
| Storage cleanup fails | Remove bucket access | Retry object manifest and retention deletion |
| Cloud Run deletion fails | Route zero traffic and cap instances at zero where supported | Retry platform deletion and alert |
| Secret deletion fails | Remove runtime binding | Revoke version/access and retry deletion |
| Lease release fails | Mark expired/quarantined | Operator reviews before new mutable run |
| Cost limit exceeded | Pause new builds/deploys | Cost owner reviews resources and approves restart |

## Orphan detection

Daily checks compare active PRs, run manifests, Cloud Run services, Auth fixture users, Firestore namespaces, Storage prefixes, secrets, and images. Unknown or mismatched resources are quarantined and reviewed, not automatically deleted.

## Cleanup evidence

Record run ID, PR, exact head, categories removed, counts, service state, session-revocation status, completion time, exceptions, and reviewer. Exclude raw IDs, credentials, personal data, message bodies, tokens, and provider payloads.

## Approval gates

- Cost owner approves currency-adjusted ceilings and alerts.
- Platform owner approves quotas and scale-to-zero behavior.
- Data owner approves TTL and delete ordering.
- Security approves quarantine and credential revocation.
- Release owner approves PR-close/merge triggers.
