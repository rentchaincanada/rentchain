# Provider-Neutral Screening Provider Contract

Phase A screening providers implement `IScreeningProvider` from `src/types/providerNeutralScreening.ts`.

Required methods:

- `getName()` returns a display-safe provider name for internal operations.
- `isConfigured()` returns whether required environment settings are present.
- `initiateScreening(input)` starts a provider request and returns safe references only.
- `verifyWebhookSignature(input)` validates the provider webhook signature.
- `parseWebhookPayload(input)` maps a provider payload into a provider-neutral request result.
- `getScreeningResult(requestId)` retrieves a provider-neutral result summary when supported.

Provider implementations must not expose raw provider IDs, payloads, tokens, credentials, or private report content to tenant-facing or landlord-facing projections. Store only safe references, hashes, status values, and summary fields.

The registry starts empty by default. Provider configuration must register implementations explicitly through `screeningProviderRegistry.register(providerId, provider)`.
