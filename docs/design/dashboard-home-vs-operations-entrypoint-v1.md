# Dashboard Home Versus Operations Entrypoint V1

## Scope

This document finalizes the landlord entrypoint architecture before Dashboard 2.0 implementation.

It answers whether Dashboard or Operations should be the default post-login destination, and how decision queue items should flow from Dashboard to Operations to the owning workspace.

This is a design-only document. It does not implement UI, routes, APIs, backend services, navigation shell changes, CSS, or visual mockups.

## Recommendation

Dashboard should remain the default post-login destination.

Operations should be the full triage workspace one click away from Dashboard.

Reason:

- The first screen after login should answer whether the landlord's portfolio is healthy.
- Most landlords should not land directly in a dense queue every session.
- Operations is essential, but it is a workbench for triage, filtering, and resolution routing.
- Dashboard should offer calm orientation first, then route to Operations or source workspaces when action is needed.

## 1. What Is Dashboard?

Dashboard is the landlord operational home.

It should provide:

- Portfolio health.
- Top critical or warning decisions.
- Today's or soonest upcoming actions.
- Financial pulse.
- Compact portfolio navigation.

Dashboard is not a detailed workbench. It is the first 10-second answer to:

1. Is anything materially wrong?
2. What should I do next?
3. Where do I go to resolve it?

Dashboard should summarize and route, not contain every record.

## 2. What Is Operations?

Operations is the landlord decision triage workspace.

It should provide:

- Full normalized decision queue.
- Severity and workspace filters.
- Due date and status views.
- Cross-domain triage.
- Saved or focused lanes in later versions.
- Routes into the source workspace for resolution.

Operations answers:

1. Show me all open work.
2. Let me filter by risk, domain, or timing.
3. Help me decide what to handle next.
4. Route me to the correct workspace.

Operations should not replace source workspaces like Leases, Tenants, Maintenance, Payments, Notices, or Messaging.

## 3. What Belongs Only On Dashboard?

Dashboard-only content:

- Overall portfolio status.
- First-login or empty-state activation prompts.
- Critical issue count summary.
- Top 3 to 5 decision preview.
- Upcoming action preview.
- Financial snapshot.
- Portfolio health summaries.
- Links to primary workspaces.
- Calm "nothing urgent" state.

Dashboard should show a compressed view of the landlord's business, not the full work queue.

## 4. What Belongs Only On Operations?

Operations-only content:

- Full normalized decision queue.
- Queue filters by severity, workspace, status, source type, due date, and related domain.
- All open critical, warning, needs-review, and upcoming items.
- Communication-derived decision filters.
- Dense cross-domain review.
- Queue item debugging labels only if safe and admin/operator scoped in the future.
- Resolved/dismissed history only if later approved.

Operations is where a landlord goes when they want the full list, not just the top few items.

## 5. What Should Never Appear On Dashboard?

Dashboard should never show:

- Full tenant list.
- Full lease list.
- Full maintenance request list.
- Full message inbox.
- Full ledger.
- Full audit trail.
- Full document library.
- Full compliance center.
- Raw Firestore IDs.
- Storage paths.
- Provider request IDs.
- Payment processor IDs.
- Full message bodies.
- Screening report payloads.
- Debug source-generator metadata.
- Long legal or workflow guidance.
- Ordinary unread messages with no action required.
- Informational history as if it is a decision.

Dashboard should not become a filing cabinet.

## 6. What Should Never Appear On Operations?

Operations should never show:

- Source edit forms.
- Lease document generation forms.
- Message reply composer as the primary interaction.
- Full tenant portal surfaces.
- Full signed document viewer.
- Legal advice.
- Compliance certification language.
- Raw provider payloads.
- Raw storage paths.
- Unfiltered private support/admin context.
- Tenant-only data outside landlord-safe projection.

Operations can route to those source surfaces, but should not absorb them.

## 7. Should Dashboard Be The Default Post-Login Destination?

Yes.

Dashboard should be the default post-login destination for landlords.

Default post-login experience:

1. Show portfolio health first.
2. Show critical issues if any exist.
3. Show the next few decisions or upcoming actions.
4. Show financial pulse.
5. Offer routes to Operations and source workspaces.

This supports peace of mind. A landlord who has nothing urgent should not be dropped into a dense operational queue.

## 8. Should Operations Be The Default Post-Login Destination?

No, not by default.

Operations should be easily reachable and may be the preferred destination for power users later, but it should not be the default for all landlords.

Operations can become a user preference later if product evidence supports it, but the platform default should remain Dashboard because:

- New/free landlords need orientation.
- Small landlords may only need top tasks.
- Operations can feel heavy if there is no urgent work.
- Dashboard better supports conversion and confidence.

## 9. First 10-Second Experience

Within 10 seconds of login, a landlord should know:

1. Portfolio state: stable, needs attention, or critical review.
2. Number of critical issues.
3. Top action, if any.
4. Rent/payment health at a glance.
5. Whether there are upcoming lease, notice, move-in, or maintenance deadlines.
6. Where to go next.

Recommended first screen order:

1. Portfolio Status.
2. Top Decision or "No urgent decisions".
3. Upcoming Actions.
4. Financial Snapshot.
5. Portfolio Detail links.

If there is a critical issue, the Dashboard should make it obvious without flooding the entire page red.

If there is no urgent issue, the Dashboard should feel calm and still useful.

## 10. Decision Queue Flow

Decision items should flow through three layers:

```txt
Dashboard preview -> Operations queue -> Owning workspace
```

### Dashboard Preview

Dashboard shows:

- Critical issues.
- Top warnings.
- Blocking needs-review items.
- Near-term upcoming actions.
- Actionable message-derived items only.

Dashboard does not show every queue item.

### Operations Queue

Operations shows:

- Full normalized queue.
- Filters and sorting.
- Cross-domain grouping.
- One row per deduped issue.
- Route to owning workspace.

Operations owns prioritization but not final resolution.

### Owning Workspace

The owning workspace resolves the issue:

- Leases resolves signing, document readiness, Form P readiness, delivery readiness, lifecycle.
- Tenants resolves move-in readiness, tenant linkage, tenant portal status, tenant-specific messages.
- Payments/Ledger resolves delinquency and payment evidence.
- Maintenance resolves request triage, contractor messages, cost approval, completion.
- Notices resolves notice timing, response, renewal, move-out paths.
- Messaging resolves replies and conversations.
- Properties resolves property/unit readiness and action requests.

## Navigation Flow

Recommended landlord navigation:

```txt
Login
  -> Dashboard
      -> Operations for full queue
      -> Workspace for direct action
      -> Messaging for conversations
      -> Payments/Ledger for financial detail
      -> Properties/Tenants/Leases/Maintenance for domain detail
```

Recommended top-level nav relationship:

- Dashboard: "home".
- Operations: "all decisions and work".
- Messages: "all conversations".
- Properties, Tenants, Leases, Maintenance, Payments: "source workspaces".
- Trust/Compliance: "governance visibility".

Dashboard and Operations should be adjacent in navigation because they are complementary, not competing.

## Workspace Ownership

| Workspace | Owns | Dashboard role | Operations role |
| --- | --- | --- | --- |
| Dashboard | Portfolio status and top actions. | Default landing surface. | Not applicable. |
| Operations | Full normalized decision queue. | Linked from top decision preview. | Primary triage surface. |
| Leases | Execution, documents, signing, readiness, lease workflows. | Show blocking lease issue only. | Queue lease decisions and route to Leases. |
| Tenants | Tenant lifecycle, move-in readiness, current lease/unit linkage. | Show material tenant blocker only. | Queue tenant decisions and route to tenant profile. |
| Payments/Ledger | Rent collection, delinquency, payment evidence. | Financial snapshot and top payment issue. | Queue payment issues and route to Ledger. |
| Maintenance | Request triage, work order state, contractor communication. | Urgent count or top issue. | Queue maintenance items and route to request. |
| Notices | Notice deadlines, responses, renewal/move-out review. | Upcoming warning when timing matters. | Queue notice decisions and route to workflow. |
| Messaging | Conversation management. | Show urgent or awaiting-response count only. | Queue actionable message decisions and route to Messaging or source workspace. |
| Properties | Property/unit readiness and action requests. | Portfolio detail summary. | Queue property action requests. |

## Decision Routing Examples

| Decision | Dashboard treatment | Operations treatment | Final workspace |
| --- | --- | --- | --- |
| Overdue rent | Critical payment item in preview. | Payment critical queue item. | Ledger or payment workspace. |
| Lease active before signing | Critical lease item. | Lease state coherence item. | Lease workspace. |
| Form P readiness missing required fields | Warning only if blocking generation/signing/use. | Lease readiness item. | Lease document/signing panel. |
| Tenant move-in blocked by missing signed lease | Warning if move-in is active. | Tenant needs-review item. | Tenant profile or lease signing panel. |
| Lease expiring soon | Upcoming action. | Upcoming lease lifecycle item. | Lease workflow page. |
| Property action request open | Usually Portfolio Detail count. | Property needs-review item. | Property workspace. |

## Messaging Routing Examples

| Message signal | Dashboard treatment | Operations treatment | Final workspace |
| --- | --- | --- | --- |
| Tenant awaiting landlord reply | Show if top actionable communication item. | Needs-review message item. | Tenant profile or message thread. |
| Urgent unread tenant message | Warning or critical preview. | Warning/critical communication item. | Messaging or tenant workspace. |
| Maintenance message requires landlord response | Top maintenance/communication issue if urgent. | Maintenance follow-up item. | Maintenance request. |
| Contractor quote requires response | Not shown unless urgent or due. | Maintenance needs-review item. | Maintenance/cost review context. |
| Notice-relevant message | Upcoming/warning if deadline affected. | Notice relevance item. | Notice or lease workflow. |
| Ordinary unread message | Not shown. | Usually not queued. | Messaging workspace. |

## Maintenance Routing Examples

| Maintenance signal | Dashboard treatment | Operations treatment | Final workspace |
| --- | --- | --- | --- |
| New request submitted | Warning count/top item if unreviewed. | Needs-review maintenance item. | Maintenance request detail. |
| Emergency/urgent request | Critical or warning preview. | Critical/warning maintenance item. | Maintenance request detail. |
| Contractor schedule issue | Show only if blocking/urgent. | Maintenance follow-up item. | Work order or maintenance request. |
| Cost approval required | Usually Operations only unless urgent. | Needs-review item. | Maintenance cost review. |
| Completed maintenance | Not shown as decision. | Informational/history only if later supported. | Maintenance history. |

## Lease Routing Examples

| Lease signal | Dashboard treatment | Operations treatment | Final workspace |
| --- | --- | --- | --- |
| Primary lease document missing before signing | Warning if signing is expected. | Lease document readiness item. | Leases. |
| Signing failed or blocked | Critical/warning preview. | Lease signing item. | Lease signing panel. |
| Signing pending | Dashboard only if blocking move-in or time-sensitive. | Lease needs-review/upcoming based on context. | Leases or tenant profile. |
| Signed lease available | Not a decision. | Informational only. | Lease document action. |
| Signed lease delivery pending | Warning if post-signing delivery context. | Lease delivery readiness item. | Leases. |
| Notice deadline approaching | Upcoming preview. | Upcoming notice/lease lifecycle item. | Notice workflow. |

## Default Entry Rules

Use Dashboard as default when:

- User logs in.
- User has no explicit deep link.
- User returns from general navigation.
- User is a new landlord or small portfolio landlord.

Use Operations as destination when:

- User clicks "View all decisions".
- User clicks severity count from Dashboard.
- User chooses Operations from nav.
- User follows an alert designed for triage.
- Future user preference explicitly sets Operations as the landing page.

Use owning workspace directly when:

- A dashboard item has one clear action path.
- A notification/deep link points to a specific lease, tenant, payment, maintenance request, notice, or thread.
- The user is already inside a source workspace.

## Mobile Entry Rules

Mobile Dashboard should show:

1. Health.
2. Critical action, if any.
3. Next upcoming action.
4. Financial pulse.
5. Workspace shortcuts.

Mobile Operations should show:

1. Severity filter.
2. Top queue item.
3. Workspace filter.
4. Compact list.

Mobile should avoid forcing landlords through dense Operations before giving portfolio context.

## Empty State Rules

Dashboard empty states:

- "No urgent decisions."
- "No upcoming actions in this window."
- "Add your first property."
- "No rent collection data yet."

Operations empty states:

- "No open decisions match these filters."
- "No critical issues."
- "No communication decisions."

Do not use empty states that imply legal approval, compliance guarantee, or production certification.

## Degraded State Rules

If the decision queue is unavailable:

- Dashboard should show portfolio summaries that are independently available.
- Dashboard should label decision preview unavailable.
- Dashboard should not synthesize critical issues from stale local state.
- Operations should show queue unavailable and avoid partial false completeness.

If a source workspace summary is unavailable:

- Mark only that source as degraded.
- Keep other dashboard sections usable.

## Implementation Implications

Future Dashboard 2.0 implementation should:

1. Keep Dashboard as the post-login default.
2. Use normalized decision queue data for decision preview.
3. Cap visible decision rows.
4. Link "View all" to Operations.
5. Route each item to its owning workspace.
6. Keep onboarding/activation prompts separate from critical decisions.
7. Keep messaging-derived decisions filtered to action-required cases.

Future Operations implementation should:

1. Consume the same normalized queue.
2. Preserve deterministic severity and sorting.
3. Add filters before visual polish.
4. Route to owning workspaces.
5. Avoid becoming a source-editing surface.

## Non-Goals

- No implementation.
- No UI changes.
- No route changes.
- No dashboard build.
- No operations build.
- No visual mockups.
- No API changes.
