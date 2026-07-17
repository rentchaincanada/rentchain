# PAD Provider Feasibility Request v1

Status: provider inquiry only; no provider selected and no PAD implementation authorized

## RentChain context

RentChain is a Canadian proptech/SaaS platform serving landlords/property managers and tenants across lease-linked rental workflows. It is evaluating recurring monthly rent collection using a processor-led Canadian PAD/ACSS model. RentChain does not intend to hold funds and prefers provider-managed bank verification, authorization/mandate evidence, payment-method lifecycle, processing, and settlement.

The initial opportunity is a bounded enterprise pilot, not a public launch. The planning reference is $30/unit/year, or $90,000/year for 3,000 units, with final pricing validated in a paid pilot and provider costs modeled separately.

## Proposed flow to validate

1. Landlord enables PAD for an eligible lease/property.
2. Tenant receives a versioned authorization link.
3. Tenant authorizes Canadian bank-account debit through a provider-managed flow.
4. Provider stores the payment method and mandate and returns opaque references/evidence.
5. RentChain stores only approved provider references, status, agreement metadata, and audit evidence—never raw bank credentials.
6. RentChain creates lease-linked, versioned rent obligations.
7. RentChain initiates one approved off-session debit attempt per obligation using durable idempotency.
8. Signed provider webhooks and status retrieval update processing, success, failure, return, cancellation/dispute, and settlement evidence.
9. Landlord and tenant see role-appropriate payment status, receipts, failures, returns, and support paths.
10. An append-safe audit trail links authorization, obligation, attempt, provider evidence, reconciliation, notices, and receipt/reversal.

This flow is a hypothesis for validation. `Pending` is not paid, and an initial success can still be followed by a return.

## Questions for the provider

### Eligibility and account model

1. Does your Canadian ACSS/PAD product support recurring residential rent for this proposed platform/customer structure?
2. Who should be payee/merchant of record and settlement recipient?
3. Should each landlord/property manager have a connected/provider account? If so, which current account configuration and capabilities apply?
4. Which party collects KYC/verification requirements, pays provider fees, and bears losses, returns, disputes, reserves, and negative balances?
5. Is a platform/Connect model required, optional, or inappropriate? Please describe responsibilities rather than relying only on legacy account-type labels.
6. Can settlement route directly to the landlord-designated account without RentChain possessing or controlling funds?
7. What onboarding/KYC, underwriting, volume, reserve, prohibited-business, and ongoing verification requirements apply to RentChain and each landlord?

### Authorization and debit lifecycle

8. Can a provider-managed SetupIntent or equivalent create a reusable Canadian bank payment-method and mandate reference for future rent debits?
9. Which payment-method, mandate, customer, account-context, agreement, and verification references should RentChain store or avoid storing?
10. Which fixed, interval, sporadic, combined, or variable schedule model best fits monthly rent with lawful future rent changes?
11. Can one off-session PaymentIntent or equivalent be created for each specifically approved debit under the mandate?
12. Which current events and statuses represent authorization pending/verified, debit processing, succeeded, failed, returned, cancelled, disputed, refunded, and settled?
13. What are expected verification, submission, settlement, return, and dispute timelines? How late can a return arrive?
14. Who sends required mandate confirmation and debit notifications, and what evidence is retrievable/exportable?

### Reliability, testing, and operations

15. What idempotency scope and retention apply? How should ambiguous network timeouts be resolved without resubmission?
16. How are webhook signatures verified, events replayed, duplicates/out-of-order delivery handled, and missed events recovered?
17. How can NSF, closed account, verification failure, delayed success/failure, return, dispute, cancellation race, and settlement delay be simulated in sandbox?
18. Which sandbox behavior differs from live mode, and what certification or production approval is required?
19. What reporting/API/export evidence supports per-attempt and aggregate settlement reconciliation?
20. What transaction, verification, platform, onboarding, return, dispute, refund, payout, reserve, minimum, support, and currency-conversion fees apply?
21. What rate/amount/volume limits, availability commitments, escalation paths, response targets, and support exclusions apply?
22. What data-processing locations, subprocessors, retention/deletion behavior, incident terms, and portability/export options apply?
23. What restrictions or additional terms apply specifically to rent collection and PAD authorization?

## Requested deliverables

- Written feasibility conclusion with assumptions, restrictions, and expiry.
- Recommended participant, account, responsibility, and no-custody funds-flow model.
- Sandbox account/access/setup steps and production eligibility path.
- Authorization/mandate and bank-verification artifact examples.
- Test event matrix, current webhook event/status list, return codes, and timelines.
- Idempotency, replay, status-retrieval, and reconciliation recommendations.
- Fee schedule, limits, reserves, liability, onboarding/KYC, support, and escalation terms.
- Explicit unresolved risks, unknowns, and questions for counsel.

## Email-ready request

**Subject:** Canadian ACSS/PAD rent collection feasibility review for RentChain

Hello [Provider contact],

RentChain is a Canadian proptech/SaaS platform evaluating a limited paid beta for provider-processed pre-authorized rent debits. PAD is planned, not implemented. We prefer provider-managed bank verification and mandate/payment-method lifecycle, and RentChain does not intend to hold funds.

Please review the attached proposed flow and answer the account/payee, connected-account, KYC, settlement, mandate, off-session debit, webhook, delayed return, idempotency, sandbox, reconciliation, fee, and support questions. We need written confirmation for the actual rent use case and participant structure, not a generic product-capability statement.

This request does not authorize production use. Provider findings will be reviewed with Canadian payments/privacy/commercial counsel before any implementation or live testing.

Regards,

[Payments/product owner]

## Current official references to confirm

- Stripe Canadian PAD setup/future payments: <https://docs.stripe.com/payments/acss-debit/set-up-payment>
- Stripe connected-account configuration: <https://docs.stripe.com/connect/accounts-v2/connected-account-configuration>
- Stripe onboarding options: <https://docs.stripe.com/connect/onboarding>

These references are starting points only. The provider response must confirm current applicability to RentChain's actual account and funds-flow model.
