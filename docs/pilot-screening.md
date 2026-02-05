# Pilot Screening Ops (Canada) — TransUnion KBA

## Overview
This pilot implements a landlord-paid screening flow using a reseller-provided TransUnion ShareAble for Rentals (KBA) API.

### Happy path
1) Landlord creates a screening order (UI: “Send screening invite”).
2) Stripe Checkout payment completes.
3) Tenant receives invite email and opens /verify/:token.
4) Tenant provides consent (name, checkbox). Consent is stored with timestamp/IP/UA.
5) TU KBA request initiated; tenant completes KBA (redirect if provider-hosted).
6) Provider webhook marks report ready; PDF is fetched server-to-server, stored in GCS, and exposed via short-lived signed URL.
7) Landlord sees status and can open the report URL.

### Failure/edge cases
- Provider not configured or preflight fails: checkout creation is blocked (503 in production).
- KBA failed / thin file: order marked failed and Stripe Identity fallback can be created.
- Payment succeeds but KBA fails: show “Manual verification required”.

## Status tracker meanings
- Sent: Payment received / invite sent.
- Tenant started: Consent recorded.
- Identity verification in progress: KBA in-progress event from provider.
- Completed: Provider reported completion.
- Report ready: PDF stored; signed URL available.
- Failed → Manual verification required: KBA failed; fallback required.

## Data storage rules
- Do NOT store raw bureau JSON/PDF in Firestore.
- Store only provider refs, status fields, consent proof metadata, and the PDF object key.
- PDF is stored in private GCS; serve only via short-lived signed URLs.

## Required environment variables
### Stripe (billing + screening)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_IDENTITY_WEBHOOK_SECRET (if Stripe Identity fallback is enabled)

### Pricing (preferred)
- STRIPE_PRICE_STARTER_MONTHLY_LIVE / STRIPE_PRICE_STARTER_YEARLY_LIVE
- STRIPE_PRICE_PRO_MONTHLY_LIVE / STRIPE_PRICE_PRO_YEARLY_LIVE
- STRIPE_PRICE_BUSINESS_MONTHLY_LIVE / STRIPE_PRICE_BUSINESS_YEARLY_LIVE
- STRIPE_PRICE_STARTER_MONTHLY_TEST / STRIPE_PRICE_STARTER_YEARLY_TEST
- STRIPE_PRICE_PRO_MONTHLY_TEST / STRIPE_PRICE_PRO_YEARLY_TEST
- STRIPE_PRICE_BUSINESS_MONTHLY_TEST / STRIPE_PRICE_BUSINESS_YEARLY_TEST

Fallbacks supported:
- STRIPE_PRICE_*_MONTHLY / STRIPE_PRICE_*_YEARLY
- STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO / STRIPE_PRICE_BUSINESS

### Screening provider (TU reseller placeholders)
- SCREENING_PROVIDER=transunion
- TU_RESELLER_API_URL
- TU_RESELLER_API_KEY
- TU_WEBHOOK_SECRET

### GCS (PDF storage)
- GCS_BUCKET_NAME (or the bucket env already used by the GCS helper)
- GOOGLE_APPLICATION_CREDENTIALS or workload identity

### Email (tenant invites)
- SENDGRID_API_KEY
- SENDGRID_FROM_EMAIL (or SENDGRID_FROM / FROM_EMAIL)

### Frontend
- FRONTEND_URL / FRONTEND_ORIGIN

## Webhook endpoints
- Stripe (billing + screening): /api/webhooks/stripe (Cloud Run)
- TransUnion reseller: /api/webhooks/transunion

Provider webhook setup notes:
- Use TU_WEBHOOK_SECRET for signature verification (reseller spec).
- Ensure the webhook URL is reachable from the reseller and maps to landlord API.

## Smoke tests (curl)
1) Pricing health
```
curl -i https://<api-host>/api/health/pricing
```

2) Screening provider health
```
curl -i https://<api-host>/api/health/screening-provider
```

3) Screening invite (auth required)
```
curl -i https://<api-host>/api/screening/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"propertyId":"<id>","tenantEmail":"tenant@example.com","screeningTier":"basic","serviceLevel":"SELF_SERVE","scoreAddOn":false}'
```

## Secret rotation notes
- Rotate STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET together; revalidate webhook delivery.
- Rotate TU_RESELLER_API_KEY and TU_WEBHOOK_SECRET with reseller coordination.
- Rotate SENDGRID_API_KEY; verify invite email delivery.
- Regenerate GCS credentials / workload identity when rotating storage access.
