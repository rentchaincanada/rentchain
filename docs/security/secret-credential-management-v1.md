# Secret And Credential Management v1

## Scope

This policy defines how RentChain secrets and credentials must be classified, stored, rotated, audited, and handled during incidents. It does not publish secret values, service account emails, credential file names, database paths, or private infrastructure identifiers.

## Secret Classification

| Class | Examples | Repository Handling |
| --- | --- | --- |
| Service credentials | Google service account material, private credential JSON | Never commit; store only in approved cloud secret stores or deployment settings |
| API secrets | Stripe secrets, webhook secrets, email provider keys | Never commit; use environment-specific secret stores |
| Auth signing secrets | JWT signing secret, bootstrap token | Never commit; rotate on suspected exposure |
| Internal tokens | Internal job token, service-to-service token | Never commit; scope to environment |
| Public client config | Vite Firebase public config, public API base URL | May be present as public env values, but still environment-scoped |
| Local placeholders | Fake local template values | May be committed only when obviously fake |

## Storage Policy

- Production secrets must live in approved production deployment settings or secret management systems.
- Preview secrets must be separate from production secrets unless the preview intentionally routes to production and is approved as production-adjacent.
- GitHub Actions must not print secret values in logs.
- Vercel public `VITE_*` values must not contain private credentials.
- Local `.env` files must remain uncommitted.
- `rentchain-api/.env.example` may contain fake local placeholders only.

## Rotation Policy

| Secret Type | Rotation Trigger | Required Action |
| --- | --- | --- |
| Service credential | Suspected exposure, role change, access review finding | Disable old credential, provision replacement, verify Cloud Run startup |
| JWT secret | Exposure or signing boundary change | Rotate, invalidate affected sessions where possible, document residual JWT risk |
| Stripe or email provider secret | Exposure or provider dashboard warning | Rotate in provider, update runtime secret, verify webhook delivery |
| Internal job token | Exposure, team transition, endpoint scope change | Rotate and verify internal routes fail with old token |
| Vercel env value | Wrong environment routing or stale preview config | Update environment-scoped value and redeploy affected frontend |

## Audit Requirements

Authorized operators must be able to answer:

- Who can view or modify each production secret.
- Which deployment consumes each secret.
- When each secret was last rotated.
- Whether preview and production values are distinct.
- Whether any CI or deployment logs exposed secret-shaped content.

## Prohibited Practices

- Do not paste service account JSON into documentation, issue comments, PR descriptions, or commits.
- Do not add real API keys to env templates.
- Do not log raw tokens, provider payloads, or credential paths.
- Do not use production secrets in local development.
- Do not use preview secrets in production runtime.

## Incident Response

If a secret is suspected exposed:

1. Contain by disabling or revoking the exposed credential where possible.
2. Rotate the secret in the provider or secret store.
3. Redeploy affected runtime with the new value.
4. Verify old value no longer works.
5. Search code, docs, CI logs, and deployment logs for exposure.
6. Record impacted environment, time window, and affected service.
7. Follow `docs/runbooks/environment-separation-incident-response-v1.md`.

## Review Checklist For New Secrets

- Name and purpose documented.
- Environment scope documented.
- Storage location approved.
- Rotation owner assigned.
- Validation or startup behavior documented.
- No raw value committed.
- No user-facing surface can display the value.
