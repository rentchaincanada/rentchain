# Environment Separation Operational Dashboard v1

## Purpose

This document defines the monitoring views and review cadence operators should use to verify environment separation health. It does not create dashboards, alerts, metrics, or infrastructure.

## Dashboard Scope

Dashboards should help answer:

- Which environment is receiving traffic?
- Which backend host is serving requests?
- Which runtime identity is reading or writing Firestore?
- Which frontend deployment is routing API traffic?
- Whether preview activity is touching production services.
- Whether auth failures indicate cross-environment token use.

## Core Metrics

| Metric | Source | Expected Use |
| --- | --- | --- |
| Cloud Run request count by revision | Cloud Run logs/metrics | Detect unexpected traffic to old or preview revisions |
| Cloud Run request count by host/referrer | Cloud Run logs | Detect Vercel preview traffic reaching production backend |
| Firestore writes by collection and runtime identity | Firestore audit/logging | Detect unexpected production writes |
| Firestore read/write errors | Cloud Run logs | Detect wrong database or missing index behavior |
| Auth 401/403 rates by route | Backend logs | Detect token issuer or scope mismatch |
| Vercel deployment request volume | Vercel analytics/logs | Compare preview and production traffic |
| Health endpoint initialization mode | Backend health checks | Detect wrong Firebase initialization mode |
| Secret access events | Secret manager audit logs | Detect unexpected credential access |

## Baseline Expectations

- Production Cloud Run receives normal production traffic from production and approved preview routing only.
- Local development should not appear in production Cloud Run logs.
- Firestore production writes should originate from expected production runtime identity.
- Preview Vercel deployments may generate production API traffic only when current approved routing points them there.
- Backend health metadata should report production mode for production runtime.
- Frontend CI should use local API base values and should not call production backend.

## Alert Thresholds

Create alerts or manual review triggers for:

- Production Firestore writes from unexpected identity.
- Production Cloud Run traffic spike immediately after preview deployment.
- Production health endpoint reporting non-production initialization mode.
- Repeated auth scope mismatch errors after preview login testing.
- Secret access outside expected deploy windows.
- Vercel preview traffic exceeding expected QA volume.
- Sudden increase in Firestore permission errors or missing-index errors.

## Review Checklist

Weekly or after environment changes:

1. Review Cloud Run traffic by revision.
2. Review Vercel preview deployment traffic.
3. Confirm production backend host is expected in frontend network traces.
4. Confirm preview routing is understood and approved.
5. Review Firestore write identities.
6. Review auth failure rates by route and role.
7. Review secret access audit entries.
8. Review open environment-separation incidents and follow-up controls.

## Dashboard Panels To Build

Recommended future dashboard panels:

- Production backend request volume by frontend origin.
- Preview-origin traffic to production backend.
- Firestore write counts by collection and runtime identity.
- Auth failures by route, status, and role.
- Health mode history by backend revision.
- Secret access by principal and secret class.
- Deployment timeline overlaid with traffic and write anomalies.

## Incident Escalation

When dashboard review finds an environment mismatch, follow `docs/runbooks/environment-separation-incident-response-v1.md`. Preserve logs before rotating credentials, deleting data, or changing deployment settings.

## Known Limits

- Source files do not expose all Cloud Run, Vercel, Secret Manager, or IAM settings.
- Dashboard implementation requires cloud-console or observability access outside this documentation mission.
- This document defines monitoring intent only; it does not create alerts.
