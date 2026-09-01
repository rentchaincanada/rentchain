# ADR-003: Legacy and external input precedence

Status: Accepted as current-state documentation

## Decision

Legacy fields may be read only where current evaluators explicitly normalize
them. They must not override stronger canonical evidence or manufacture a
transition. Provider status is external evidence until a RentChain service
validates ownership, chronology, idempotency, and permitted transition.

Provider webhooks, document URLs, screening responses, settlement events, and
communication delivery states therefore do not become canonical merely because
they were persisted.

## Fail-closed rule

Unknown, conflicting, foreign-context, stale, incomplete, or multiply-attributed
input produces rejection, conflict, Review Needed, or no transition according to
the current domain service. Administrative access does not waive this rule.
