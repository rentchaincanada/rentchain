# Frontend Security Headers and CSP v1

## Executive Summary

This mission adds a conservative browser-security baseline for the RentChain Vercel frontend. The change is limited to frontend response headers and config-level regression tests. It does not change authentication, Firebase logic, backend routes, Firestore rules, payment flows, screening flows, exports, or review workflows.

The baseline is designed to improve protection against script injection, clickjacking, MIME sniffing, referrer leakage, unsafe browser capabilities, and accidental third-party loading while preserving Vercel preview deployments, Cloud Run API rewrites, Firebase/Auth, Stripe/provider redirects, app assets, and PDF preview behavior.

## Headers Added

The following headers are applied to static assets and non-asset SPA routes in `rentchain-frontend/vercel.json`:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- `Cross-Origin-Resource-Policy: same-origin`

The existing cache policies are preserved:

- immutable long-lived cache for `/assets/(.*)`
- `no-store` for non-asset SPA routes

The Cloud Run rewrites remain unchanged, including `/api/:path*`.

## CSP Posture

The CSP is intentionally conservative rather than maximally strict. It blocks object embeds, blocks framing of RentChain pages, limits scripts to same-origin built assets, permits inline styles for the existing React style usage, and permits required app connectivity for RentChain, Firebase/Google APIs, Stripe, and the Cloud Run API.

Key directives:

- `default-src 'self'`
- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'`
- `connect-src 'self' ...`
- `frame-src 'self' blob: data: https:`
- `worker-src 'self' blob:`
- `form-action 'self'`
- `upgrade-insecure-requests`

## Allowed External Sources

The CSP allows the following external source families where currently needed or safely anticipated by existing flows:

- RentChain domains: `https://*.rentchain.ai`
- Cloud Run API: `https://rentchain-landlord-api-915921057662.us-central1.run.app`
- Firebase and Google APIs: `https://*.googleapis.com`, `https://*.firebaseio.com`, `https://*.firebaseapp.com`, `https://*.gstatic.com`, `wss://*.firebaseio.com`
- Stripe: `https://*.stripe.com`
- Images and frames: `https:` in addition to `self`, `blob:`, and `data:` for compatibility with existing document/PDF/provider preview behavior

## Known Limitations

- `style-src` includes `'unsafe-inline'` because the frontend uses React inline styles and component-level dynamic styling. Removing it should be a later staged mission after style usage is inventoried.
- `frame-src` remains broad enough to avoid breaking document/PDF/provider preview behavior. Future tightening should be based on deployed CSP violation data and a full iframe/embed inventory.
- CSP reporting is not enabled because there is no governed CSP report ingestion endpoint yet.
- This mission does not introduce runtime header middleware. Vercel remains the frontend header authority.
- This mission does not harden backend Cloud Run responses.

## Verification

Config regression tests assert:

- security headers are present on both asset and SPA route header rules
- header names do not conflict within each route rule
- cache policies remain unchanged
- CSP includes required RentChain, Firebase/Google, Stripe, Cloud Run, worker, and frame directives
- `/api/:path*` continues to rewrite to the Cloud Run API before the SPA fallback

## Post-Deploy QA

After Vercel preview deployment:

1. Load `/`
2. Load `/login`
3. Load `/dashboard`
4. Load `/operations`
5. Verify normal `/api` calls still work through the preview
6. Verify login/auth screens load
7. Verify there are no CSP console errors blocking required app resources
8. Verify Stripe/provider redirect entry points still render
9. Verify document/PDF preview surfaces still render where available

## Future Hardening

Recommended follow-up work:

1. Add a governed CSP report endpoint or third-party report collector with redaction.
2. Inventory iframe, image, worker, and external navigation dependencies from preview CSP reports.
3. Tighten `frame-src` from broad `https:` to explicit provider/domain allowlists.
4. Remove `'unsafe-inline'` from `style-src` after replacing required inline style usage or adopting a nonce/hash strategy.
5. Evaluate backend Cloud Run security headers separately.
