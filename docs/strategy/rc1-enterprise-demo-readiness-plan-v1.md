# RC1 Enterprise Demo Readiness Plan v1

Branch: `docs/rc1-enterprise-demo-readiness-plan-v1`
Scope: docs, audit, planning, and mission sequencing only; no product implementation.
Planning issue: #1250

## RC1 Goal

Release Candidate 1 prepares RentChain for credible enterprise demo readiness and one-building pilot validation.

The operating question is:

```text
Would we confidently put RentChain in front of a 3,000-unit operator and ask:
"Would you put one building on this?"
```

RC1 is not an enterprise-complete release. It is a polish, hardening, reconnection, and evidence pass over the current platform so RentChain can be evaluated as a Governed Housing Operations Platform by a large operator without overclaiming readiness.

## Enterprise Demo Persona

The RC1 demo persona is an enterprise or larger portfolio operator evaluating whether RentChain can safely support one building as a pilot.

The persona cares about:

- governed landlord and property manager workflows
- clean permission boundaries
- staff accountability
- reliable lease and document flows
- renewal and vacancy continuity
- operational evidence and audit history
- clear distinction between current capability and roadmap

## Pilot Target

The RC1 target is one building, not a full 3,000-unit migration.

The pilot should prove:

- landlord and PM company collaboration works without shared logins
- staff assignment is visible and auditable
- lease signing and signed-document retrieval are dependable
- renewal visibility is understandable
- workflow handoffs are coherent enough for operations review
- missing or future capabilities are clearly framed

## Success Criteria

RC1 is successful when:

- a landlord can demonstrate PM Company relationship and assignment workflows cleanly
- PM Company Admin users can authenticate and manage accepted relationships without landlord profiles
- signed lease document states do not create broken or misleading links
- renewal and vacancy visibility gaps are identified and sequenced
- critical workflow handoffs have an owner, risk rating, and next mission
- the demo script distinguishes demo-ready behavior from roadmap behavior
- no demo path relies on raw IDs, private data, or unsupported integrations

## Non-Goals

RC1 does not:

- make RentChain enterprise-complete
- implement PAD
- implement screening automation
- implement vacancy feed APIs
- add contractor organization architecture
- add billing delegation
- introduce new broad architecture
- replace Free, Starter, Pro, or Elite tier documentation
- claim full portfolio migration readiness

## Enterprise Strategy Fit

RC1 advances:

- Revenue: by preparing PAD, screening, vacancy, lease-up, and pilot readiness paths.
- Operational efficiency: by tightening PM Company, assignment, lease, and renewal workflows.
- Enterprise readiness: by turning recent architecture into demonstrable workflows.
- Customer validation: by preparing the "one building" pilot conversation.

## Release Readiness Checklist

Before an enterprise demo, confirm:

- PM Company relationship lifecycle works in preview.
- PM Company email notification scope is implemented or explicitly called roadmap.
- Assignment grouping and history are readable for landlord and PM company users.
- Signed lease retrieval handles signed, cancelled, missing, and unavailable states clearly.
- Renewal visibility is audited and reachable from the intended operational surfaces.
- Demo-safe data exists and is clearly marked.
- No raw internal IDs are shown as user-facing labels.
- Mobile layouts are usable for core demo paths.
- Empty states explain what is missing without implying deletion.
- All roadmap capabilities are described as roadmap, not current behavior.

## Required RC1 Workstreams

1. PM Company polish.
2. Lease lifecycle hardening.
3. Renewal pipeline visibility.
4. Workflow continuity audit.
5. Enterprise demo walkthrough.
6. RC1 mission queue and issue tracking.

## Merge Readiness For RC1 Planning PR

This planning PR is ready only when:

- all requested docs exist under `docs/strategy/`
- docs do not add backend, frontend, schema, infrastructure, or runtime changes
- issue queue is created or updated without duplicates
- `git diff --check` passes
- new docs are searched for explicit competitor names
- PR is opened as draft
