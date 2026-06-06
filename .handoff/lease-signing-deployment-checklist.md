# Lease Signing Deployment Checklist

1. Set `SIGNING_PROVIDER=dropbox_sign` only after provider credentials are available.
2. Store `SIGNING_PROVIDER_API_KEY` and `SIGNING_PROVIDER_WEBHOOK_SECRET` in managed secret storage.
3. Set `SIGNING_PROVIDER_FROM_EMAIL` to the approved sender address.
4. Set `SIGNING_CALLBACK_URL` to the deployed webhook URL.
5. Set `SIGNING_DOCUMENT_STORAGE_BUCKET` or confirm reuse of the approved lease document bucket.
6. Register the webhook URL with the provider and confirm signature validation.
7. Run backend route, service, provider, and webhook tests.
8. Run frontend tests and build.
9. Manually verify landlord send, tenant sign, webhook processing, and signed-document retrieval with non-production accounts.
10. Confirm logs contain no API keys, webhook secrets, raw provider payloads, or tenant email addresses in audit records.
