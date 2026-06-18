# Dashboard 2.0 Risk Register V1

## Scope

This document identifies risks for the future `feat/dashboard-2.0-operational-home-v1` implementation.

It is planning only. It does not implement UI, routes, APIs, backend services, tests, CSS, or deployment changes.

## Risk Summary

Dashboard 2.0 risk is mainly about hierarchy and trust:

- If the decision queue is wrong, the dashboard will feel unreliable.
- If the dashboard shows too much, it becomes Operations.
- If the dashboard shows too little, landlords miss work.
- If mobile is dense, the first-login experience fails.
- If empty states are alarmist, landlords lose confidence.

## Decision Queue Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Queue API not merged before implementation | Dashboard implementation blocks or reintroduces local derivation. | Medium | Treat PR #1185 merge as Phase 0 precondition. Do not duplicate queue logic in frontend. |
| Queue items are technically correct but not landlord-actionable | Dashboard feels noisy and unactionable. | Medium | Dashboard preview should include only critical, warning, blocking needs-review, and near-term upcoming items. |
| Duplicate queue items appear from multiple source generators | Dashboard looks repetitive and untrustworthy. | Medium | Rely on service dedupe and add frontend grouping only if needed. Do not hide source conflicts without review. |
| Informational items appear as decisions | Dashboard becomes a filing cabinet. | Medium | Exclude informational by default. Route activity/history to source workspaces. |
| Messaging unread state floods the dashboard | Landlords see noise instead of action. | High | Only show message-derived decisions when urgent, awaiting response, notice relevant, maintenance blocking, or support escalation. |
| Source workspace links are too generic | Decisions feel like dead-end links. | Medium | Use `recommendedActionHref` where available. Prefer focused workspace destination over generic summaries. |
| Queue API degraded state looks like no decisions | Landlords may miss work. | Medium | Show explicit "Decision queue unavailable" state and avoid false all-clear messaging. |
| Severity colors overstate risk | Dashboard becomes stressful. | Medium | Use red only for critical or materially overdue issues. Use calm labels for setup/readiness gaps. |

## Performance Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Dashboard waits on too many domain APIs | First screen loads slowly. | Medium | Load queue and summary sections independently. Degrade per section, not whole page. |
| Decision queue request is expensive | Dashboard first render slows. | Low to medium | Use safe `limit` for Dashboard preview. Avoid fetching full queue on Dashboard. |
| Financial and portfolio summaries duplicate expensive fetches | Increased API load and flicker. | Medium | Reuse existing hooks/adapters where stable. Cache at page level if existing pattern allows. |
| Mobile rendering has too many cards | Slow perceived load. | Medium | Prioritize Portfolio Status, top decision, upcoming action, financial pulse. Collapse details. |
| Loading states shift layout | Poor perceived polish. | Medium | Reserve stable section structure and use compact skeletons or stable empty rows. |

## Mobile Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Dashboard becomes vertically overwhelming | Mobile landlords miss important work. | High | Limit visible decisions and upcoming actions to three each. Collapse Portfolio Detail. |
| Primary action is below the fold | Dashboard fails as operational home. | Medium | Place top health and primary action in first viewport. |
| Charts or dense metrics dominate small screens | Low usability. | Medium | Use concise status rows before visualizations. Do not add charts for decoration. |
| Operations and Dashboard feel indistinguishable on mobile | Navigation confusion. | Medium | Dashboard shows preview; Operations shows filters and full queue. |
| Sticky navigation later conflicts with dashboard sections | Layout churn in future shell work. | Medium | Keep Dashboard section labels and route targets stable. |

## Navigation Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Dashboard actions route to generic summary pages | Landlords feel the UI is not guiding them. | Medium | Route to owning workspace and focused workflow pages where available. |
| Operations becomes a duplicate Dashboard | Users lose clear mental model. | Medium | Dashboard summarizes; Operations filters and triages. |
| Source workspaces become hidden behind Operations | Users lose context for resolution. | Low to medium | Every queue item should expose a direct source workspace action. |
| Breadcrumb/sticky shell changes later break context | Future navigation refactor creates regressions. | Medium | Use stable action paths and workspace labels in Dashboard contracts. |
| Messaging route ownership is unclear | Messages can duplicate tenant/maintenance decisions. | Medium | Route replies to Messaging or source workspace; queue only actionable message decisions. |

## Empty-State Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Empty portfolio looks broken | New landlords lose confidence. | Medium | Provide setup path and calm copy. |
| No decisions looks like missing data | Users distrust Dashboard. | Medium | Distinguish "No open decisions" from "Decision queue unavailable." |
| Missing rent/payment setup appears critical | Free/new landlords feel punished. | Medium | Keep setup prompts separate from critical issues. |
| No messages needing action hides inbox access | Landlords may miss ordinary communication. | Low | Include route to Messages without treating it as a warning. |
| Empty upcoming actions implies no lease lifecycle data | Confusion when data unavailable. | Medium | Use "No upcoming actions in this window" only when data is loaded. Use degraded state otherwise. |

## Data Integrity Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Dashboard and source workspace disagree | Landlords lose trust. | Medium | Source workspace remains source of resolution. Dashboard should render queue/source labels, not invent states. |
| Lease and tenant state coherence regressions reappear | Dashboard shows stale blockers. | Medium | Use normalized queue and existing projection fixes; add QA around signed/executed lease state. |
| Payment readiness and delinquency are conflated | False critical financial states. | Medium | Treat readiness as setup warning; delinquency as financial decision. |
| Maintenance status lacks queue integration | Dashboard under-reports maintenance work. | Medium | Use normalized maintenance source types as they become available. |
| Property action requests are omitted | Landlords miss property readiness work. | Low to medium | Include property workspace queue counts and source items when present. |

## Compliance And Trust Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Dashboard uses legal/compliance language too strongly | Overclaims readiness. | Medium | Use operational readiness language only. Avoid certification or enforceability claims. |
| Evidence/compliance items appear without context | Dashboard feels alarmist. | Low to medium | Show only material trust/evidence blockers; route to Trust/Compliance. |
| Raw IDs or sensitive metadata leak into widgets | Privacy/security issue. | Low | Display safe labels only. Do not display source IDs, provider IDs, storage paths, message bodies, or processor IDs. |

## Release Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Dashboard implementation starts before docs/API merge | Rework and conflict risk. | Medium | Keep Phase 0 precondition explicit. |
| Large one-shot dashboard rewrite | Hard review and QA. | Medium | Implement in phases and preserve current dashboard behavior until replacements validate. |
| Manual QA is skipped because change is "just dashboard" | User-facing regressions. | Medium | Require authenticated preview QA for first-login, active landlord, mobile, empty states, and routing. |
| Feature flags are absent | Rollback may require revert. | Low to medium | Consider scoped adapter-first rollout; keep old sections until new sections are verified. |

## Risk Acceptance

Accepted for first implementation:

- Dashboard may initially use existing Operations route as the "View all" destination.
- Some domain summary data may remain coarse until source workspaces expose better summaries.
- Visual polish can lag behind hierarchy as long as the operational home is coherent and usable.

Not accepted:

- Duplicating backend decision queue logic in the frontend.
- Showing full queue or full inbox on Dashboard.
- Treating no queue data as no work.
- Reintroducing raw IDs, storage paths, provider IDs, or message bodies into dashboard widgets.
- Starting Dashboard implementation before PR #1185 is resolved.
