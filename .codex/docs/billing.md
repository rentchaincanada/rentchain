# Billing Route Contract

## Subscription Checkout

Canonical checkout route: `POST /api/billing/checkout`.

The route requires authenticated landlord scope through the billing route middleware. It accepts a paid plan tier and interval, resolves Stripe price configuration server-side, and returns a safe checkout redirect response:

```json
{
  "ok": true,
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

`checkoutUrl` is retained for older frontend callers. New frontend code should use `url`, while `billingApi.createCheckoutSession` exposes both fields for compatibility.

Compatibility routes `POST /api/billing/create-checkout-session`, `POST /api/billing/subscribe`, and `POST /api/billing/upgrade` share the same handler. They are compatibility aliases only; `/api/billing/checkout` remains canonical.

## Subscription Status

Canonical status route: `GET /api/billing/subscription-status`.

The response intentionally excludes raw Stripe customer IDs, subscription IDs, invoice objects, payment tokens, checkout session IDs, and provider payloads.

Safe response fields:

```json
{
  "ok": true,
  "tier": "free | starter | pro | elite",
  "planId": "free | starter | pro | elite",
  "status": "active | past_due | canceled",
  "interval": "month | year | null",
  "renewalDate": "ISO8601 | null",
  "currentPeriodEnd": "ISO8601 | null",
  "isActive": true,
  "statusSource": "stripe_subscription | plan_tier",
  "subscriptionStatusSource": "stripe_subscription | plan_tier"
}
```

`statusSource: "stripe_subscription"` means the status was derived from stored Stripe subscription sync fields on the landlord record. `statusSource: "plan_tier"` means no synced Stripe subscription state was available and the status is inferred from the current plan tier for compatibility.

## Deferred Track B

Landlord payouts, statements, Stripe Connect, tenant rent payment settlement, and payout reconciliation are not part of subscription checkout alignment. Those remain Track B and require a separate mission.
