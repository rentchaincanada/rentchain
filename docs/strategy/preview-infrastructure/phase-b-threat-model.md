# Phase B Threat Model

| Threat/attack path | Impact | Preventive control | Detective control | Recovery | Residual risk |
| --- | --- | --- | --- | --- | --- |
| Production URL/project fallback | Production access/mutation | denylist and exact environment manifest | startup/routing mismatch alert | disable route/revoke identity | configuration error remains |
| Token theft from logs/client | service invocation | server-only exchange, redaction, short TTL | token-pattern scanning | revoke binding/deployment | active token window |
| Token replay | unauthorized calls | audience-bound short-lived token | request/audience anomalies | rotate/revoke federation | within-TTL replay |
| Audience confusion | cross-service access | exact Cloud Run audience | negative tests | disable provider | claim/config drift |
| Subject widening | malicious deployment trust | exact owner/project/environment condition | IAM drift policy | revoke WIF binding | Vercel subject may cover all Previews |
| Privilege escalation | project control | role matrix/separation | Cloud Audit Logs | revoke/time-bound admin | human admin power |
| Compromised Preview | synthetic data abuse | least privilege, per-service routing | request/cost anomaly | delete service/fixtures | shared-data availability |
| Malicious PR | credential/use abuse | trusted-PR approval; forks denied backend | workflow provenance checks | cancel/delete resources | insider PR risk |
| Dependency compromise | code execution | lockfiles/scans/immutable digest | SBOM/vulnerability alerts | block digest/rebuild | zero-day risk |
| Secret leakage | account compromise | no static keys/provider secrets | secret scans/log filters | revoke/incident process | human mishandling |
| Provider side effect | real screening/payment/message | typed deny-by-default gates | side-effect audit assertions | disable egress/provider | hidden integration path |
| Synthetic-data escape | production contamination | project/bucket denylist | cross-project denied-event alert | delete/quarantine | mistaken labeling |
| Fixture account takeover | role abuse | dedicated Auth, random short-lived credentials | login anomaly | disable account/reset namespace | shared credentials |
| Stale deployment access | old vulnerable endpoint | routing TTL/service deletion | stale inventory | delete/revoke | cleanup failure |
| Orphaned resources | exposure/cost | labels, manifest, TTL cleanup | daily inventory | manual bounded cleanup | API outage |
| Cost abuse | billing loss | max 1, trusted triggers, budgets | daily threshold | freeze deployments | alerts are not hard caps |
| Log leakage | privacy/security loss | structured redacted logging | DLP/pattern scans | purge/restrict/incident | stack traces |
| Administrator misuse | broad access | time-bound roles, dual approval | audit logs/review | revoke/escalate | trusted insider risk |

Shared data makes confidentiality low-impact because it is synthetic, but availability and test integrity remain material. The highest residual risks are malicious trusted Preview code under the Vercel project-wide Preview subject, environment misconfiguration, and human administrative misuse. These block any production data/provider connectivity.
