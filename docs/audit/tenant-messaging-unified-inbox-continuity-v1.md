# Tenant Messaging and Unified Inbox Continuity Audit v1

## Executive summary

Tenant-to-landlord messaging currently has a P1 RC1 operational-continuity defect. A tenant message is persisted successfully and makes the landlord's global Inbox badge show unread activity, but the landlord Unified Inbox cannot display the corresponding conversation. The send did not fail; two landlord read models consume incompatible source shapes.

The exact root cause is that the badge and legacy `/messages` workspace read landlord-scoped `conversations`, while `/api/landlord/inbox` loads raw `messages` and applies landlord-scope filtering directly to each message. Tenant-created message documents contain a `conversationId`, sender role, body, and timestamps, but no landlord ownership field. The ownership relationship is held on the parent conversation. The inbox therefore filters valid tenant messages out before its already-mounted `landlord.message` adapter runs.

The existing `/messages` workspace and landlord reply APIs are supported and ownership-checked, but the route is hidden from normal landlord navigation. Unified Inbox recognizes `landlord.message` as a source type, yet does not generate a source action for it. Unified Inbox read state is also separate from `conversations.lastReadAtLandlord`, which drives the global badge.

RC1 sign-off should require one focused corrective PR before Operational Credits Phase 1A begins. The smallest safe slice is a first-class Unified Inbox conversation bridge backed by authoritatively landlord-scoped conversation records, with a safe action into the existing `/messages` workspace and a single compatible message-read source of truth. Embedded conversation rendering and reply inside Unified Inbox should remain deferred.

## Defect summary

Observed workflow:

1. A tenant sends a message from the tenant portal.
2. The backend persists the message and updates its conversation.
3. The landlord's global Inbox badge reports unread activity.
4. The Inbox control opens `/landlord/unified-inbox` (with `/landlord/inbox` acting as a redirect alias).
5. Unified Inbox contains no corresponding tenant conversation.
6. The landlord is not given a visible path from the operational inbox to read or reply.

This violates a basic trust invariant: every unread activity signal presented by the global Inbox must have a corresponding accessible item or an explicit safe bridge.

## Reproduction path

1. Use an authorized tenant associated with a property, unit, application, or active lease.
2. Open the tenant messages center and send a non-empty message.
3. Confirm the tenant thread renders the new message.
4. Sign in as the owning landlord.
5. Observe the unread indicator on the global Inbox control.
6. Open the Inbox control and arrive at the Unified Inbox.
7. Observe that the tenant conversation is absent.
8. Navigate directly to `/messages`; observe that the landlord conversation can be loaded, read, and replied to when the messaging capability is available.

No payment, provider, screening, or production-data mutation is needed to reproduce the continuity defect.

## Current architecture

### Tenant compose and persistence

`TenantMessagesCenterPage.tsx` calls `sendTenantCommunicationMessage` in `tenantCommunicationsApi.ts`, which posts to `/tenant/communications/messages`. `tenantPortalRoutes.ts` delegates to `tenantCommunicationsService.ts`.

The service resolves the tenant's permitted context, derives the owning landlord from the linked property, and upserts a deterministic conversation. The conversation carries landlord, tenant, property, unit, application, lease, and participant/read-state context. The child message contains the conversation reference, sender role, body, and timestamps.

This is an intentional parent-owned model: the message document is not independently authoritative for landlord ownership.

### Legacy landlord messaging workspace

The supported landlord workspace is `/messages`, implemented by `MessagesPage.tsx` and `messagesApi.ts`. Its backend endpoints list landlord conversations, load a conversation, send a reply, and mark a conversation read. The backend verifies landlord ownership before returning content or accepting mutations.

The route exists behind authenticated landlord navigation and the messaging capability, but its navigation entry is hidden. A direct authorized visit is supported; it is not a dependable discoverable path for the Inbox workflow.

### Global Inbox badge

`LandlordNav.tsx` and `TopNav.tsx` call `fetchLandlordConversations`. The landlord conversation response computes `hasUnread` from `lastMessageAt` compared with `lastReadAtLandlord`. The badge therefore reflects legacy conversation state, not Unified Inbox read-state records.

The Inbox control routes into the landlord Unified Inbox, not `/messages`.

### Unified Inbox

`unifiedInboxApi.ts` calls the role-specific `/landlord/inbox` endpoint. `landlordInboxRoutes.ts` loads several operational collections, including raw `messages`, and scopes records before passing them to `deriveUnifiedInbox`.

`landlordInboxAdapters.ts` includes `adaptLandlordMessageInboxToInboxEvent`, and the shared source types include `landlord.message`. The type and adapter therefore exist and are mounted in the derivation pipeline. They are not reached for real tenant messages because the route filters each message for a direct `landlordId`, `ownerId`, or `userId` match first.

Unified Inbox read mutations use `unifiedInboxReadStates`. They do not update `conversations.lastReadAtLandlord`.

## Exact root cause

The defect has three coupled causes:

1. **Incorrect aggregation input.** The landlord inbox aggregates child `messages` as though each were an independently landlord-scoped source record. Real tenant message documents are scoped through their parent conversation, so the route's direct-record scope filter removes them.
2. **Missing message action.** `buildLandlordSourceAction` does not handle `landlord.message`. Even a synthetic message item that reaches the list has no supported action into the existing conversation workspace.
3. **Divergent unread stores.** The badge uses `conversations.lastReadAtLandlord`; Unified Inbox uses `unifiedInboxReadStates`. Marking one read does not necessarily clear the other.

This is not caused by a missing source enum or an entirely unmounted adapter. Tests currently obscure the source-shape mismatch by constructing message fixtures with a direct landlord/user field that real tenant-created messages do not contain.

## Verification findings

| Question | Finding |
| --- | --- |
| Are tenant messages persisted? | Yes. The tenant communications service writes the conversation and child message. |
| Is the correct landlord linked? | Yes, on the conversation after property/context resolution; not redundantly on the child message. |
| Does the badge derive from legacy conversations? | Yes. It polls landlord conversations and uses legacy `hasUnread`. |
| Does Unified Inbox exclude real tenant messages? | Yes. Direct message-record scope filtering removes them before adaptation. |
| Is a tenant-message adapter unmounted? | No. The `landlord.message` adapter is in the mounted derivation path, but receives incompatible fixtures rather than real parent-scoped data. |
| Is the source type unknown? | No. Backend and frontend types recognize `landlord.message`. |
| Does the source action work? | No. No landlord message source action is generated. |
| Is `/messages` blocked? | No for an authorized landlord with messaging capability, but it is hidden from normal navigation. |
| Do landlord reply APIs exist? | Yes. Read, reply, and mark-read endpoints exist and enforce landlord ownership. |
| Are read states compatible? | No. Legacy conversation and Unified Inbox read-state records are independent. |
| Can unread counts describe invisible records? | Yes. That is the observed defect. |

## Affected frontend files and routes

- `rentchain-frontend/src/pages/tenant/TenantMessagesCenterPage.tsx` — tenant composer and thread UI.
- `rentchain-frontend/src/api/tenantCommunicationsApi.ts` — tenant communications requests.
- `rentchain-frontend/src/api/messagesApi.ts` — landlord legacy conversation list, detail, reply, and read requests.
- `rentchain-frontend/src/pages/MessagesPage.tsx` — supported landlord conversation workspace and query-parameter selection.
- `rentchain-frontend/src/components/layout/LandlordNav.tsx` — legacy-conversation unread polling.
- `rentchain-frontend/src/components/layout/TopNav.tsx` — legacy-conversation unread polling and Unified Inbox navigation.
- `rentchain-frontend/src/components/layout/navConfig.ts` — hidden `/messages` entry and visible Unified Inbox entry.
- `rentchain-frontend/src/api/unifiedInboxApi.ts` — role-specific landlord inbox endpoint.
- `rentchain-frontend/src/components/UnifiedInbox/UnifiedInboxList.tsx` — source labels and missing-action fallback.
- `rentchain-frontend/src/pages/UnifiedInboxPage.tsx` and tests — filters, selection, read behavior, and navigation.
- `/landlord/unified-inbox` — canonical landlord operational inbox.
- `/landlord/inbox` — frontend redirect alias.
- `/messages` — existing landlord conversation workspace.

## Affected backend files and routes

- `rentchain-api/src/routes/tenantPortalRoutes.ts` — `/tenant/communications/messages` endpoints.
- `rentchain-api/src/services/tenantPortal/tenantCommunicationsService.ts` — participant resolution, conversation upsert, persistence, and tenant read state.
- `rentchain-api/src/routes/messagesRoutes.ts` — `/landlord/messages/conversations` list/detail/reply/read endpoints and tenant counterparts.
- `rentchain-api/src/routes/publicRoutes.ts` — overlapping legacy landlord message endpoints that require separate consolidation review, not change in the first corrective slice.
- `rentchain-api/src/routes/landlordInboxRoutes.ts` — `/api/landlord/inbox` aggregation, direct-record scope filtering, and independent read-state persistence.
- `rentchain-api/src/services/unifiedInbox/deriveUnifiedInbox.ts` — source adaptation pipeline.
- `rentchain-api/src/services/unifiedInbox/landlordInboxAdapters.ts` — existing message adapter.
- `rentchain-api/src/services/unifiedInbox/unifiedInboxService.ts` — landlord-safe projection and source-action generation.
- `rentchain-api/src/services/unifiedInbox/types.ts` — `landlord.message` source contract.
- `rentchain-api/src/tests/unifiedInbox/landlordInboxAdapters.test.ts` — synthetic directly scoped message fixtures.
- `rentchain-api/src/tests/unifiedInbox/unifiedInboxService.test.ts` and route tests — projection/action/aggregation coverage gaps.

## Affected data models

### Conversation

The conversation is the ownership and context authority. Relevant fields include landlord, tenant, property, unit, application, lease, last-message timestamp, and separate landlord/tenant last-read timestamps.

### Message

The child message contains its conversation reference, sender role, body, and timestamps. It must not be treated as independently landlord-authoritative merely because it is stored in the messages collection.

### Unified Inbox event

The internal event supports `landlord.message`, safe labels, a source reference, priority, timestamp, and read projection. Public projections must not expose raw conversation, landlord, tenant, lease, property, unit, provider, or storage identifiers as labels.

### Unified Inbox read state

`unifiedInboxReadStates` is a separate inbox-local store. For message items, it cannot safely supersede the conversation's `lastReadAtLandlord` without an explicit synchronization contract.

## Authorization and organization-isolation findings

The existing landlord conversation detail, reply, and read endpoints compare the authenticated landlord scope with the conversation's landlord ownership before permitting access. Tenant endpoints similarly resolve tenant/context authority. These are the correct existing enforcement points for a transitional bridge.

Unified Inbox also requires landlord authentication and derives records in landlord scope. The corrective path must query conversations by canonical landlord ownership first and join messages only after that proof. It must fail closed if ownership, participant, property, unit, or conversation mapping is absent or ambiguous.

The current model primarily uses landlord scope rather than a separate organization identifier. A future organization model must not be inferred from display labels or child message data. Another landlord or tenant must be unable to obtain a conversation by guessing a query parameter or inbox item reference; the destination endpoint must always repeat server-side ownership checks.

The implementation must not add landlord IDs to user-visible titles, previews, URLs intended as labels, analytics labels, or logs. An existing authorized conversation reference may be used only as opaque routing context, with authorization repeated at the destination.

## Unread-count findings

The global badge is a Boolean unread signal derived from landlord conversations. It is compatible with the legacy `/messages` workspace but incompatible with the current Unified Inbox contents.

For tenant-message items, `conversations.lastReadAtLandlord` should remain the authoritative unread state during the bridge phase. Unified Inbox should project that state rather than independently deciding that the message is read. Opening the actual authorized conversation should use the existing mark-read endpoint and cause both the conversation list and badge to refresh consistently.

The implementation must define whether selecting an inbox row marks it read. It must not write only `unifiedInboxReadStates` for a message and leave the global badge unread. The safer initial behavior is to mark a tenant conversation read only through the ownership-checked conversation read mutation, either on successful workspace open/load or through a backend operation that re-derives and verifies the mapped conversation.

## Legacy `/messages` findings

`/messages` is not obsolete at the API level. It provides the only current supported landlord conversation reader/reply UI and is covered by focused frontend and backend tests. Its navigation item is hidden, so it cannot be the sole discoverability mechanism.

Changing the global Inbox destination back to `/messages` would conceal rather than repair the aggregation split and would weaken Unified Inbox's role as the central operational workspace. The safe temporary solution is to surface conversation bridge items in Unified Inbox and deep-link authorized landlords to `/messages` until embedded messaging is separately designed.

The duplicated legacy message route implementations in `messagesRoutes.ts` and `publicRoutes.ts` should be inventoried later. Consolidating them is not required to restore RC1 continuity and would broaden the corrective PR.

## Unified Inbox aggregation findings

The route should aggregate a landlord-scoped conversation projection, not raw globally loaded message documents. A safe projection can select the latest relevant inbound tenant message after the conversation has proven landlord ownership. It should emit one stable operational item per conversation or latest unread inbound message, with:

- tenant display name when safely available, otherwise a neutral fallback;
- property and unit display labels, never raw IDs;
- subject if the model has a safe subject, otherwise a bounded message preview;
- received timestamp;
- unread state from `lastReadAtLandlord` versus the relevant message timestamp;
- neutral priority unless an explicit deterministic priority source exists;
- `landlord.message` source type; and
- a safe action into the authorized landlord conversation workspace.

The item should participate in All, Unread, and search. A dedicated Messages category may be added only if it is a small extension of existing filter contracts; it is not required for the first bridge if All and Unread clearly label message items.

## Reply-path findings

Landlord reply capability already exists in the legacy workspace and backend. The first corrective slice should reuse it. It must not duplicate reply mutations inside Unified Inbox.

The source action should open the exact conversation in `/messages` using the existing supported query-selection contract. The conversation reference is opaque routing context, not a display label, and the backend must recheck landlord ownership. If a safe exact deep link cannot be guaranteed, the fallback is `/messages` with the conversation visibly discoverable at the top of the scoped list; a dead or inaccessible action is not acceptable.

Embedded thread rendering, composing, attachments, notification delivery, or automation inside Unified Inbox are separate post-RC1 work.

## Privacy and security risks

- Joining child messages before proving parent conversation ownership could disclose private message content across landlords.
- Copying broad conversation/message documents into Unified Inbox responses could expose raw IDs, emails, participant metadata, provider data, or internal paths.
- Full message bodies in list previews could overexpose sensitive tenant communication; previews must be bounded and projection-safe.
- Search indexes, logs, analytics events, or audit records must not capture unrestricted message bodies.
- An opaque conversation reference must never substitute for server-side authorization.
- Ambiguous tenant/property/unit relationships must fail closed rather than falling back to another participant or organization.
- Read synchronization must not permit a landlord to mutate another landlord's conversation state.

## RC1 impact and priority

Classification: **P1 pre-demo operational continuity fix**.

There is no evidence of message loss or cross-tenant access in the audited flow, so this is not presently classified as P0. It does block a trustworthy guided workflow: the product announces unread tenant activity and then fails to present it in the destination workspace. That inconsistency should be fixed before RC1 operational sign-off and before starting Operational Credits Phase 1A.

Until fixed, a demo must not claim that Unified Inbox contains all tenant communications. Direct `/messages` access is a support workaround, not an acceptable final RC1 experience.

## Recommended smallest safe implementation slice

Create one focused full-stack corrective PR, proposed branch:

`fix/rc1-tenant-messaging-unified-inbox-bridge-v1`

The PR should:

1. Add a pure backend conversation-to-inbox assembler that accepts only authoritatively landlord-scoped conversations and their scoped latest inbound message.
2. Change landlord inbox aggregation to query/derive landlord conversations first, then join message evidence by conversation ID; do not infer ownership from a child message or add broad denormalized ownership fields as a shortcut.
3. Emit a projection-safe `landlord.message` item with bounded preview, safe labels, received timestamp, and conversation-derived unread state.
4. Add a safe source action to the existing authorized `/messages` workspace and select the exact conversation when possible.
5. Make message unread/read behavior derive from, or explicitly synchronize with, `conversations.lastReadAtLandlord`. Do not allow an inbox-only read write to clear one surface while leaving the global badge inconsistent.
6. Ensure message items work in All, Unread, and search. Add a dedicated Messages filter only if it remains a narrow contract extension.
7. Add end-to-end focused tests covering persistence, owner resolution, aggregation, action, read/reply continuity, and cross-landlord/cross-tenant denial.

The corrective PR must remain provider-neutral and must not touch billing, screening, payments, PAD, Firestore rules, infrastructure, or Operational Credits.

## Required validation for the corrective PR

Automated coverage must prove:

- a tenant send persists a message and updates the correct conversation;
- the conversation belongs to the correct landlord;
- the global badge reports the unread conversation;
- Unified Inbox includes the same conversation;
- All, Unread, and search can find the message item;
- the action opens an accessible landlord conversation workspace;
- the landlord can read and reply when authorized;
- marking the conversation read clears compatible badge and inbox unread projections;
- a different landlord cannot list, open, read, reply to, or mark the conversation;
- a different tenant cannot access the conversation;
- safe projections omit raw/internal/provider/storage identifiers and unrestricted payloads.

Run focused frontend and backend tests, frontend and backend production builds, `git diff --check`, protected-scope scans, and responsive manual QA of the Unified Inbox item/action. Because the implementation would change user-visible routing and API behavior, manual preview QA is required.

## Explicitly deferred work

- Embedded conversation rendering and reply composition inside Unified Inbox.
- Attachments, delivery receipts, typing indicators, reminders, escalation automation, or AI message analysis.
- Replacing the legacy conversation APIs or broadly consolidating duplicate route modules.
- Reworking all Unified Inbox categories or redesigning its layout.
- Organization-model migration beyond the existing authoritative landlord scope.
- Adding provider integrations, email/SMS sending behavior, payment behavior, PAD, rent, deposits, billing, subscriptions, or Operational Credits behavior.
- Changing RC1 behavior outside tenant-message continuity.

## Audit recommendation

Proceed with the focused tenant-message Unified Inbox bridge PR before RC1 operational sign-off. Keep the bridge narrow: authoritative conversation aggregation, safe message projection, supported action, and compatible read state. Defer embedded messaging and broader inbox redesign.

Operational Credits Phase 1A remains paused and requires separate authorization after this messaging audit is reviewed.
