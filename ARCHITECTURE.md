# RentChain Architecture & Deployment Quick Guide

## 1) What runs where
- **Vercel**: `rentchain-frontend` only (static build + client-side app + serverless functions under `rentchain-frontend/api/*` for lightweight proxies/waitlist).
- **Cloud Run**: `rentchain-api` (Express app). All core API routes live here.

## 2) Canonical API base
- Frontend must call Cloud Run via `VITE_API_BASE_URL` (absolute, no trailing slash), e.g. `https://rentchain-landlord-api-915921057662.us-central1.run.app`.
- Frontend requests should resolve to `${VITE_API_BASE_URL}/api/...`.
- Never rely on `https://www.rentchain.ai/api/*` — that hits Vercel and many endpoints 404.

## 3) Verification commands
- Cloud Run health:  
  `curl https://rentchain-landlord-api-915921057662.us-central1.run.app/health`
- Cloud Run application links (requires valid landlord JWT):  
  `curl -X POST https://rentchain-landlord-api-915921057662.us-central1.run.app/api/landlord/application-links -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"propertyId":"PROP_ID","unitId":"UNIT_ID"}'`
- Browser check: open app and confirm Network requests point to the Cloud Run host, not `www.rentchain.ai/api`.

## 4) Common pitfalls
- Relative `/api/...` calls will hit Vercel and 404. Always use the API fetch helpers that prepend `VITE_API_BASE_URL`.
- Changing `app.build.ts` only affects the Cloud Run API. Vercel serverless functions live under `rentchain-frontend/api/*` and are deployed separately.

## 5) Env vars (frontend)
- `VITE_API_BASE_URL` (required; absolute Cloud Run base, no trailing slash).
- Other public vars as needed by the app (e.g., feature flags), but `VITE_API_BASE_URL` is critical for all API calls.
