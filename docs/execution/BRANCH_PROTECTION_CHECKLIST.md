# Branch Protection Checklist

Manual GitHub UI reminder for PR merge policy:

- Require `ci / frontend (pull_request)`
- Require `ci / backend (pull_request)`
- Require `Vercel – rentchain`
- Require `Vercel – rentchain-status`
- Keep `merge-gate / merge-gate (pull_request)` supplemental
- Do not require duplicate `push` and `pull_request` CI contexts for PR merge policy
- Ensure required check names match the exact emitted check names
