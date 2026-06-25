# Enterprise Feature Gap Audit v1

Branch: `docs/enterprise-layer-roadmap-v1`
Scope: documentation-only feature audit; no implementation.

## Audit Frame

This audit compares current RentChain direction and known capabilities against enterprise landlord needs surfaced by a 3,000+ unit operator and a Yardi Voyager comparison point.

Status meanings:

- Existing: implemented enough to serve as a current product capability.
- Partial: foundations or adjacent workflows exist, but enterprise completeness is not ready.
- Missing: no product-ready capability identified.

## Feature Gap Table

| Area | Status | Current capability | Enterprise risk | Suggested mission |
| --- | --- | --- | --- | --- |
| Yardi-like enterprise needs | Partial | RentChain has governed workflows, property manager company foundations, audit/evidence architecture, tenant portal, leasing/payment/screening foundations. | Full Yardi replacement would require mature accounting, bulk ops, reporting, integrations, and support. | `docs/enterprise-operating-model-readiness-v1` |
| PAD payments | Missing | Payment boundary and Stripe-oriented rent payment surfaces exist, but PAD is not implemented. | Enterprise landlords may reject product without automatic PAD. | `research/pad-payments-canada-provider-options-v1` |
| Vacancy publishing API | Missing | Vacancy data exists operationally, but no governed external feed/API is productized. | Landlords cannot publish availability to their own websites. | `feat/vacancy-publishing-feed-api-v1` |
| Application screening | Partial | Screening consent/provider architecture and manual fallbacks exist in code paths, but enterprise application workflow needs clearer productization. | Screening is a buying requirement and has compliance risk. | `feat/applications-manual-screening-workflow-v1` |
| Automated screening from applications | Partial | Provider and callback patterns exist; automation is not enterprise packaged. | Automation without consent/review controls can create compliance and UX risk. | `feat/applications-automated-screening-add-on-v1` |
| Accounting/reporting | Partial | Export and payment boundary architecture exists; accounting-specific exports are not complete. | Yardi comparison will expose accounting gaps quickly. | `feat/accounting-export-framework-v1` |
| Lease lifecycle | Partial | Lease execution, signing, tenant portal, and lease document surfaces exist. | Enterprise needs high-volume lifecycle states, exception handling, bulk operations, and signed-document reliability. | `feat/enterprise-lease-lifecycle-hardening-v1` |
| PM company management | Partial | Backend foundations, relationship APIs, acceptance, staff assignment APIs, read APIs, auth profile, and management UI have been implemented. | Needs email notifications, landlord visibility polish, and enterprise hierarchy integration. | `feat/property-manager-company-email-notifications-v1` |
| Delegated access | Existing | Delegated access V1 supports invite lifecycle, acceptance, delegate workspace, grants, revoke, and history. | Enterprise needs advanced templates, reporting, and scale UX. | `feat/delegated-access-enterprise-permission-templates-v1` |
| Audit/evidence | Partial | Strong audit and evidence architecture exists across multiple docs and foundation modules. | Enterprise buyers need searchable/exportable operational audit consoles. | `feat/enterprise-audit-console-v1` |
| Operational command center | Partial | Dashboard, operations, decision, and review foundations exist. | Large portfolios need exception queues, portfolio triage, and bulk follow-up. | `feat/enterprise-operations-command-center-v1` |
| Work orders | Partial | Maintenance/work-order references exist in tiers and tenant portal workflows. | Enterprise needs assignment, SLA, vendor, bulk, and reporting support. | `feat/work-order-enterprise-operations-v1` |
| Tenant portals | Partial | Tenant portal routes and tenant workspace capabilities exist. | Enterprise needs high-volume onboarding, identity recovery, payment automation, and support-safe controls. | `feat/tenant-portal-enterprise-readiness-v1` |
| APIs/integrations | Missing | Internal APIs exist, but enterprise API keys, scopes, versioning, rate limits, and documentation are not productized. | Integration buyers need stable API contracts and audit trails. | `feat/enterprise-api-key-management-v1` |
| Organization hierarchy | Partial | Property manager company provides one organization model; landlord ownership hierarchy is missing. | Multi-entity owners and development firms need entity and portfolio segmentation. | `feat/enterprise-organization-hierarchy-foundations-v1` |
| Bulk operations | Missing | No enterprise bulk operations layer identified. | Thousands of units make single-record workflows inefficient. | `feat/enterprise-bulk-operations-foundations-v1` |
| Institutional reporting | Partial | Portfolio and export architecture exists, but enterprise reporting is not complete. | Enterprise buyers need board, investor, lender, and operator reporting. | `feat/enterprise-portfolio-reporting-v1` |
| Pricing/packaging | Partial | Current pricing and entitlement docs/code references exist, but enterprise packaging is not settled. | Sales conversations can drift without approved packaging. | `docs/enterprise-pricing-and-packaging-v1` |

## Key Gaps

The highest-priority gaps from the feedback are:

1. PAD payment automation.
2. Vacancy publishing feed/API.
3. Application screening workflow.
4. Enterprise packaging and pricing.
5. Accounting/export readiness.
6. Organization hierarchy and role governance.

## Current Strengths

RentChain is well-positioned in:

- governance-first workflow design
- tenant-facing operations
- property manager company authority modeling
- delegated access
- evidence and audit posture
- metadata-safe exports
- modern API-friendly architecture direction

These strengths should shape the enterprise wedge.

## Primary Risks

### Enterprise Overclaim Risk

RentChain should not describe itself as a Yardi Voyager replacement today.

### Payment Rail Risk

PAD touches banking authorization, consent, compliance, reconciliation, returns, disputes, and support. It requires provider and legal review before implementation.

### Screening Risk

Screening workflows must preserve consent, provider boundaries, manual review, and tenant-visible status. Automated screening should be a paid add-on only after manual workflow readiness.

### API Exposure Risk

Vacancy and enterprise APIs must be projection-safe and rate-limited. Internal IDs, tenant PII, and private landlord metadata must not leak.

### Role Governance Risk

Enterprise role modeling must remain server-side and fail closed. Client-side assumptions cannot define authority.
