# Signup Flow Cleanup QA

## Paths
1. `/signup` creates a landlord account with `plan: "free"` and `approved: true`.
2. `/request-access` submits to `POST /api/access/request` and stores lead as `pending`.
3. `/invite` (or `/invite/:token`) redeems code via `POST /api/invites/redeem` and grants at least `starter`.

## API Checks
1. Signup:
   - `POST /api/auth/signup` with email/password/fullName returns `ok: true`, token, user.
   - Firestore `users/{uid}` has `role: "landlord"`, `approved: true`, `plan: "free"`.
2. Request access:
   - `POST /api/access/request` returns `ok: true`, `status: "pending"`.
   - `landlordLeads` contains pending lead record.
3. Invite redeem:
   - `POST /api/invites/redeem` with valid code returns token + user.
   - `users/{uid}` and `landlords/{uid}` updated to approved true and invite plan (default `starter`).

## UI Checks
1. Marketing header shows:
   - `Sign up (Free)`
   - `Request access`
   - `I have an invite`
2. Login page includes links to:
   - `/signup`
   - `/request-access`
   - `/invite`
3. After signup or invite redeem, user lands on `/dashboard`.
4. `/api/me` after signup resolves `plan: "free"` and authenticated user payload.
