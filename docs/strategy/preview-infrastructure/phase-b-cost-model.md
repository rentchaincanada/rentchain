# Phase B Cost Model

## Planning assumptions

Currency is CAD planning range; Google list prices are generally billed in account currency and vary by region/exchange rate. Assumptions: Montréal, request-based Cloud Run, min 0/max 1 per PR, 10–30 active PR previews/month, 5–15 build minutes each, fewer than 20 fixture users, under 1 GiB Firestore/Storage, under free-tier request/operation ranges where shared billing permits, and aggressive cleanup.

Official references: [Cloud Run pricing](https://cloud.google.com/run/pricing), [Cloud Build pricing](https://cloud.google.com/build/pricing), [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing), [Firebase pricing](https://firebase.google.com/pricing), and [Firestore billing](https://firebase.google.com/docs/firestore/pricing). Free tiers are billing-account scoped in several products and must not be treated as guaranteed zero cost.

| Component | Idle/month | Normal active/month | Control |
| --- | ---: | ---: | --- |
| Cloud Run | CAD 0–2 | CAD 1–15 | request billing, min 0, max 1, TTL |
| Cloud Build | CAD 0 | CAD 1–10 | trusted PR only, cache, one build/SHA |
| Artifact Registry | CAD 0–2 | CAD 1–5 | seven images/14 days |
| Firebase Auth | CAD 0 | CAD 0–3 | synthetic email accounts; no phone auth |
| Firestore | CAD 0–2 | CAD 1–8 | small namespaces, capped tests, seven-day TTL cleanup |
| Storage | CAD 0–2 | CAD 0–5 | synthetic small files, lifecycle delete |
| Logging/Monitoring | CAD 0–5 | CAD 1–8 | exclusions, seven-day retention, no payloads |
| Network egress | CAD 0–2 | CAD 0–5 | small North American QA traffic |
| Vercel/Terraform Cloud | CAD 0 incremental* | CAD 0–10* | confirm plan entitlements/seat effects |
| **Total** | **CAD 0–20** | **CAD 10–60** | ceiling below |

`*` Existing plan/seat costs are unknown from repository evidence and require owner confirmation.

One-time engineering/setup effort is excluded from cloud spend. Per-PR incremental cloud cost is estimated CAD 0.25–2.00; unusually long builds or retained services invalidate this range.

## Governance

- Monthly budget: CAD 100.
- Alerts: CAD 50 informational, CAD 80 owner action, CAD 100 freeze new Preview creation.
- Abnormal daily threshold: CAD 15; investigate same day.
- Hard operational stop: disable new deployments and scale/delete expired compute at CAD 100 or unexplained CAD 15/day; do not automatically destroy evidence/data during an incident.
- Retention: min 0/max 1; three revisions per active PR; seven images per service line/14 days; logs seven days; run metadata 30 days; fixtures seven days; approved defect holds at most 30 days.

Billing owner reviews actuals weekly during rollout and recalibrates after 30 days. Budget alerts are detective, not a guaranteed spend cap.
