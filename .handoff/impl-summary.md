PR: #1145
PR URL: https://github.com/rentchaincanada/rentchain/pull/1145
Branch: audit/free-tier-journey-v1

WHAT WAS AUDITED:
Comprehensive code inspection audit of the complete free tier user journey covering route entitlements, frontend navigation visibility, onboarding workflows, upgrade decision points, narrative consistency, and locked-state UX patterns. Inspected 25+ backend and frontend files to identify why the platform "feels broken rather than limited" to free tier users.

**Backend Route and Entitlement Analysis:**
- Inspected capability gating middleware in `rentchain-api/src/middleware/entitlements.ts` - returns structured 402 responses with `upgrade_required` error, capability key, current plan, required plan, and `/billing` upgrade path
- Audited lease route entitlements in `rentchain-api/src/routes/leaseRoutes.ts` - all lease operations (`/active`, `/archived`, creation, editing) protected by `enforceLeaseCapability` function requiring "leases" capability
- Verified landlord inbox routes in `rentchain-api/src/routes/landlordInboxRoutes.ts` - free tier accessible with full unified inbox aggregating applications, screenings, leases, maintenance, messages, notices
- Confirmed messaging routes in `rentchain-api/src/routes/messagesRoutes.ts` - protected by messaging capability enforcement at lines 675-688, returns upgrade-required 403 for locked plans

**Frontend Navigation and Visibility Analysis:**
- Analyzed navigation config in `rentchain-frontend/src/components/layout/navConfig.ts` - Messages requires "messaging" feature, Analytics requires "portfolio_health_summary" feature, filtering applied via `getVisibleNavItems` function
- Inspected mobile navigation in `rentchain-frontend/src/components/layout/LandlordNav.tsx` - landlord mobile tabs include Dashboard, Documents, Leases, Inbox, Messages (with messaging filter), creating 5 primary command surfaces
- Found navigation inconsistency: desktop drawer prioritizes Operations and Decisions as primary command entries, but mobile bottom tabs elevate Inbox and Messages while relegating Operations/Decisions to "More" menu
- Verified free tier navigation visibility: Messages hidden when `features.messaging === false`, other surfaces remain visible but show locked content

**Onboarding and Property Creation Workflow Analysis:**
- Examined property creation form in `rentchain-frontend/src/components/properties/AddPropertyForm.tsx` - includes structured free tier guidance via `FREE_TIER_UPGRADE_GUIDANCE.propertyCreate` with title "Free tier keeps setup manual", explanation of manual vs Starter tier differences, and "Learn more" CTA linking to `/pricing`
- Verified property overview guidance in `rentchain-frontend/src/pages/PropertiesPage.tsx` - displays free tier guidance card with `FREE_TIER_UPGRADE_GUIDANCE.propertyOverview` content and `UpgradeCTA` component using "applications" feature key and "properties_free_tier_overview" source tracking
- Confirmed tier guidance constants in `rentchain-frontend/src/constants/tiers.ts` - defines structured guidance for property creation, applications, and property overview with consistent messaging about manual intake on Free vs batch invitations on Starter

**Upgrade Decision Points and Locked State UX Analysis:**
- Inspected lease page locked state in `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx` - uses `isUpgradeRequiredError` detection and `LockedFeature` component presentation, silently handles upgrade errors without showing broken state
- Analyzed messaging locked state in `rentchain-frontend/src/pages/MessagesPage.tsx` - clean capability check via `features?.messaging !== false`, shows full `LockedFeature` component when disabled with "Upgrade to Starter" CTA
- Examined operations page tier gating in `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx` - uses `entitlements.hasCapability("leases")` check, locks lease_lifecycle, payments, and documents lanes when `leaseSignalsLocked` is true, displays locked cards instead of errors
- Verified LockedFeature component structure in `rentchain-frontend/src/components/billing/LockedFeature.tsx` - professional presentation with "Locked feature" label, clear feature description, required plan indication, upgrade CTA, and reassuring copy about checkout process

**Narrative Consistency and Messaging Analysis:**
- Found consistent tier labeling: "Free tier" and "Starter" used throughout guidance constants
- Verified upgrade messaging consistency: all upgrade CTAs link to `/pricing` or `/billing` paths
- Confirmed locked state language: "Available on Starter" messaging with professional upgrade prompts rather than error language
- Identified clear upgrade driver messaging: manual intake vs batch invitations, basic property management vs tenant portals, manual applicant handling vs screening workflow tools

KEY FINDINGS:

**1. Navigation Complexity Creates Decision Overload**
Current free tier users face 8+ primary command surfaces (Dashboard, Operations, Properties, Tenants, Applications, Leases, Inbox, Messages) with unclear prioritization. Mobile navigation prioritizes Inbox/Messages while desktop prioritizes Operations/Decisions, creating inconsistent mental models across devices.

**2. Mixed Locked State Quality - Some Professional, Some Confusing**
GOOD: Messages, Properties, and Lease creation show professional LockedFeature components with clear upgrade CTAs and plan requirements.
CONCERNING: Operations page mixes free-accessible content with locked lanes in single interface, potentially creating "partially broken" perception rather than clear limitation messaging.

**3. Strong Upgrade Driver Clarity in Property Creation**
Property creation workflow includes excellent free tier guidance explaining manual intake vs Starter tier batch invitations. Clear value prop communication about when to upgrade.

**4. Excellent Backend Capability Architecture**
Backend entitlement system returns structured, API-consistent upgrade responses. Frontend properly detects `upgrade_required` errors and transforms them into professional locked states rather than displaying raw errors.

**5. Mobile vs Desktop Navigation Priority Misalignment**
Desktop users see Operations/Decisions as primary command entries, mobile users see Inbox/Messages as primary. This creates different free tier experiences based on device, potentially contributing to confusion about platform priorities.

**6. Messaging Capability Inconsistency Risk**
Messages workspace enforces messaging capability strictly, but unified inbox can include message summaries without equivalent capability gates. Free tier users might see message activity in inbox while blocked from conversation workspace.

**NARRATIVE GAPS IDENTIFIED:**

**Gap 1: Operations Page Overwhelming Rather Than Limited**
Operations page combines 6 coordination categories (lease lifecycle, payments, occupancy, screening, documents, operational review) into single interface with mixed locked/unlocked lanes. Users experience confusion rather than clear "this feature requires upgrade" messaging.

**Gap 2: Command Surface Decision Overload**
Free tier users must navigate between Inbox, Messages, Operations, Decisions, Properties, Applications without clear guidance on which surfaces are primary vs secondary for their use case.

**Gap 3: Device-Dependent Navigation Priorities**
Mobile users experience different command surface hierarchy than desktop users, creating inconsistent onboarding experiences and mental models.

**Gap 4: Partial Access Confusion**
Operations page and unified inbox show mixed accessible/locked content within same interfaces, creating "partially broken" rather than "intentionally limited" perception.

CURRENT STATE:
- Branch: audit/free-tier-journey-v1
- Implementation approach: Code inspection only, zero source code changes
- Files inspected: 25+ backend routes, frontend pages, components, and configuration files
- Audit coverage: Complete 6-phase analysis per mission requirements
- Findings documentation: Comprehensive with specific code locations and line numbers

RECOMMENDED FIXES (Prioritized by Impact):

**HIGH IMPACT - Immediate Narrative Clarity:**
1. **Split Operations Page:** Move locked lanes (lease lifecycle, payments, documents) behind clear upgrade prompts. Keep free-safe content (property overview, basic inbox) as simplified operations view.
2. **Unify Mobile/Desktop Navigation Priorities:** Establish consistent primary command surfaces across devices. Recommend: Dashboard + Properties + Inbox as primary, Operations + Messages + Leases as secondary.
3. **Consolidate Command Surfaces:** Reduce free tier navigation from 8+ surfaces to 4-5 clear paths with obvious upgrade drivers.

**MEDIUM IMPACT - UX Polish:**
4. **Standardize Locked State Presentation:** Ensure all locked features use LockedFeature component rather than mixed content interfaces.
5. **Clarify Messages vs Inbox Relationship:** Document intended separation and ensure capability enforcement consistency.
6. **Strengthen Property Creation Success Path:** Add clearer "what next?" guidance after property creation completion.

**LOW IMPACT - Consistency:**
7. **Audit Messaging Capability Consistency:** Ensure unified inbox message inclusion matches messages workspace capability enforcement.
8. **Standardize Tier Language:** Confirm "Free tier" vs "Starter" language consistency across all surfaces.

NEXT STEPS:
Based on audit findings, recommend three follow-up implementation missions:
1. `fix/landlord-command-surface-simplification-v1` - Consolidate navigation surfaces and split operations page locked lanes
2. `fix/upgrade-driver-clarification-v1` - Strengthen upgrade decision points and locked state consistency
3. `fix/onboarding-flow-reordering-v1` - Establish device-consistent navigation priorities and success path guidance

KNOWN LIMITATIONS:
- Audit based on code inspection only, no live user testing or account-specific entitlement verification
- Did not inspect every landlord route in repository, focused on primary user journey surfaces
- Tier gating behavior validated through code patterns, not runtime API payload samples
- Mobile responsive breakpoint behavior inferred from CSS/component logic, not device testing
