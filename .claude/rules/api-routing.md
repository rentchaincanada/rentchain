# Rule: API Routing (applies to rentchain-frontend/**)

## CRITICAL
Never use relative `/api/...` paths for backend calls.
Always use the absolute Cloud Run base URL via the env var:

  fetch(`${import.meta.env.VITE_API_BASE_URL}/api/...`)

## Why
Vercel does not proxy `/api/*` to Cloud Run.
`www.rentchain.ai/api/*` does not exist.
Relative calls 404 silently in production.

## Allowed patterns
- `${import.meta.env.VITE_API_BASE_URL}/api/tenant/...`
- `${import.meta.env.VITE_API_BASE_URL}/api/landlord/...`
- `${import.meta.env.VITE_API_BASE_URL}/api/maintenanceRequests/...`

## Blocked patterns
- fetch('/api/...')
- axios.get('/api/...')
- Any hardcoded Cloud Run URL string (use env var only)
