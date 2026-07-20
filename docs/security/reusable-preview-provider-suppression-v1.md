# Reusable Preview Provider Suppression v1

## Policy

All outbound providers are denied or suppressed by default in Preview. Absence of a provider credential is the preferred control. A preview service must not start or receive QA traffic when a production provider credential, live-mode identifier, or uncontrolled outbound destination is present.

No suppression flag may weaken application authorization or silently report successful external execution.

## Suppression matrix

| Provider/capability | Default Preview mode | Guard | Network control | Required evidence | Failure behavior | Logging | Production enablement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Certn/screening | Disabled, no credentials | Environment classification plus credential absence | Deny provider hosts where feasible | Startup inventory and negative integration test | Fail closed before request creation | Provider name, suppressed reason, no applicant data | Production secrets and explicit production environment only |
| Stripe | Disabled, no live or test key initially | Reject any Stripe key in Phase B | Deny Stripe hosts initially | Secret inventory and egress observation | Return explicit unavailable response; no mutation | Suppressed capability only | Separate later sandbox mission; production live mode separately gated |
| Rotessa | Disabled, no credentials | Reject credential/config presence | Deny hosts | Secret inventory and negative test | Fail closed; no PAD schedule | Suppressed capability only | Separate approved integration mission |
| PAD/payment/rent/deposit | Disabled | Feature and environment guards; no payment identity | Deny payment endpoints | Mutation-route and outbound-call tests | No money movement; explicit unavailable state | No bank or amount payload | Production-only enablement after separate validation |
| Email/Mailgun | Non-delivering sink or disabled | Recipient-domain allowlist and preview mode | Allow sink only if required | Delivery sink assertion | Persist internal event only when workflow supports it; never claim delivered | Template/event metadata, no body or address | Production credential and domain only in production |
| SMS | Disabled | No credential; destination allowlist if later sandboxed | Deny provider hosts | Negative test | Explicit unavailable state | No phone number or body | Separate production enablement |
| Push notifications | Disabled | No push credentials | Deny endpoints | Negative test | No send | Suppression event only | Production-only configuration |
| Webhooks | Disabled except local reviewed sink | Destination allowlist | Deny public destinations | Sink receipt or negative test | Queue disabled or explicit failure | Event type only | Approved destinations per environment |
| Document signing | Disabled | No signing credential or production template | Deny vendor host | Negative test | No envelope creation | Suppression event only | Separate sandbox/production approval |
| Storage notifications | Disabled | Preview bucket only; no production topic | Project-scoped IAM | Bucket/topic inventory | No notification dispatch | Object category only | Environment-specific binding |
| Analytics/export destinations | Local metadata only | Destination allowlist empty | Deny external endpoints | Egress observation | Drop or local no-op according to approved contract | Aggregate status only | Production destination only in production |
| AI/external model APIs | Disabled | No API keys; explicit preview deny | Deny model-provider hosts | Secret scan and negative test | Deterministic unavailable state | No prompt, response, tenant, or message content | Separate supervised AI approval |
| Other vendor SDKs | Disabled until inventoried | Startup provider registry | Default-deny egress | Complete dependency/config scan | Block deployment | Provider identifier only | Explicit environment approval |

## Provider registry requirement

Phase B must maintain a deterministic startup registry of externally executable capabilities. It reports only provider identifier, configured/absent, enabled/disabled, mode classification, and guard result. It must never log keys, account identifiers, endpoints containing tokens, recipients, payloads, or financial values.

Deployment fails when:

- an unknown provider is configured;
- a production/live mode is detected;
- a required disabled provider is enabled;
- an outbound destination is outside the allowlist;
- environment classification is missing;
- suppression evidence cannot be generated.

## Email sink constraints

If authentication or messaging workflows require email during a later phase, use a non-delivering sink with synthetic reserved-domain recipients only. The sink must not forward, relay, or accept arbitrary external domains. PR #1435 QA should use direct secure test-account provisioning and must not require real email delivery.

## Test evidence

- secret/config scan proves production credentials absent;
- startup registry reports every provider suppressed;
- negative tests exercise each executable adapter boundary;
- controlled egress observation shows no vendor traffic;
- QA logs contain suppression status but no sensitive payload;
- any attempted provider call fails the run.

## Incident handling

Any real provider request is a stop event. Disable the service, revoke credentials, preserve metadata-only network evidence, assess external side effects, notify security and the provider owner, and invalidate the QA result.

## Phase B boundary

Phase B may add preview-safe suppression configuration and tests. It may not add Certn, Stripe, Rotessa, PAD, payment, signing, email, SMS, AI, or other vendor sandbox integrations.
