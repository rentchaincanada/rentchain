Pricing, Upgrade, Navigation & Account — Discovery Report

Canonical reference document for pricing conversion work, Timeline monetization, upgrade nudges, and “My Account” workspace restructuring.

Discovery Report (Pricing / Upgrade / Nav / Account)
A) Pricing Surfaces
rentchain-frontend/src/App.tsx

PricingGate component controls auth split for pricing.

Routes:

/pricing → PricingGate → authenticated users see in-app pricing.

/site/pricing → marketing pricing page.

rentchain-frontend/src/pages/PricingPage.tsx

In-app pricing surface (inside LandlordNav via PricingGate).

Uses:

DEFAULT_PLANS

startCheckout

createBillingPortalSession

Primary copy is local to this file.

rentchain-frontend/src/pages/marketing/PricingPage.tsx

Marketing/public pricing page.

Uses localized copy from:

rentchain-frontend/src/content/marketingCopy.ts

Starts checkout directly for authenticated users.

Otherwise routes to login.

rentchain-frontend/src/content/marketingCopy.ts

Canonical marketing pricing copy.

Controls:

headline

subheadline

Tier labels

CTA text

Comparison table content

B) Upgrade Flow
Provider & Modal System

rentchain-frontend/src/main.tsx

Wraps app with UpgradeProvider.

rentchain-frontend/src/context/UpgradeContext.tsx

Exposes useUpgrade().openUpgrade(...)

Renders:

rentchain-frontend/src/components/billing/UpgradeModal.tsx

rentchain-frontend/src/components/billing/UpgradePromptModal.tsx

Checkout Utility

rentchain-frontend/src/billing/startCheckout.ts

Payment entry helper used by pricing pages and modals.

Billing Portal / Upgrade Redirect Utility

rentchain-frontend/src/billing/openUpgradeFlow.ts

openUpgradeFlow({ navigate })

Sends users to billing portal if available.

Otherwise falls back to pricing route.

Existing Nudge System

rentchain-frontend/src/features/upgradeNudges/UpgradeNudgeHost.tsx

Mounted globally in LandlordNav.

rentchain-frontend/src/features/upgradeNudges/UpgradeNudgeInlineCard.tsx

Inline nudge card component.

Recommended Single Action for New “Upgrade to Pro” Nudges

Use:

openUpgradeFlow({ navigate })

For:

Timeline paywall CTA

Dashboard soft nudge

Reason:

Already used by nudge stack.

Avoids duplicating modal wiring.

Keeps billing/upgrade flow centralized.

C) Navigation System
Primary Landlord Nav Shell

rentchain-frontend/src/components/layout/LandlordNav.tsx

Uses getVisibleNavItems(...)

Applies feature/role gating.

Mounts UpgradeNudgeHost.

Canonical Nav Item Source

rentchain-frontend/src/components/layout/navConfig.ts

NAV_ITEMS

getVisibleNavItems(...)

Correct place to add new nav item.

Drawer Implementations

LandlordNav.tsx → includes primary drawer.

TopNav.tsx → opens WorkspaceDrawer.

WorkspaceDrawer.tsx → also reads navConfig.

Mobile Tabs

LandlordNav.tsx

Builds bottom tabs from navConfig (showInTabs).

Legacy / Alternate Tab Component

rentchain-frontend/src/components/layout/MobileTabBar.tsx

Has /account tab.

No /account route registered in App.tsx.

Treat as non-canonical unless explicitly confirmed active.

D) Account-Related Pages and Routes
Existing Routes (rentchain-frontend/src/App.tsx)

/account/security → AccountSecurityPage

/billing → BillingPage

/billing/checkout-success → BillingCheckoutSuccessPage

/privacy → PrivacyPage

/terms → TermsPage

/help/templates → TemplatesPage

Existing Pages

AccountSecurityPage.tsx

2FA + account security controls.

BillingPage.tsx

Subscription + receipts table.

BillingCheckoutSuccessPage.tsx

PrivacyPage.tsx

TermsPage.tsx

Missing Today

No /account hub route/page registered.

No explicit frontend “Data export / Delete account” settings page.

Only legal deletion copy in PrivacyPage.

E) Timeline Monetization Enforcement
Entitlement Logic

rentchain-frontend/src/features/automation/timeline/timelineEntitlements.ts

canUseTimeline(...)

Allows:

pro

elite

elite_enterprise

Timeline Gate Location

rentchain-frontend/src/features/automation/timeline/AutomationTimelinePage.tsx

Non-entitled users see paywall content and upgrade CTAs.

Route

/automation/timeline

Registered in rentchain-frontend/src/App.tsx

Wrapped in RequireAuth + LandlordNav

Recommendation: Where to Implement Upcoming Work
Pricing Copy Updates (Timeline Pro Conversion)

Marketing:

src/content/marketingCopy.ts

src/pages/marketing/PricingPage.tsx

In-App:

src/pages/PricingPage.tsx

Optionally src/pages/BillingPage.tsx

Upgrade Nudges

Timeline paywall CTA:

src/features/automation/timeline/AutomationTimelinePage.tsx

Dashboard soft nudge:

src/pages/DashboardPage.tsx

Or reusable UpgradeNudgeInlineCard

Action via openUpgradeFlow({ navigate })

“My Account” Hub

Add new route in:

src/App.tsx → /account

Add nav item in:

src/components/layout/navConfig.ts

Add new page:

src/pages/AccountPage.tsx

Link to:

/account/security

/billing

/privacy

/terms

Implementation Branch Plan

feat/pricing-timeline-pro-copy

feat/timeline-upgrade-nudges

feat/nav-my-account-hub
