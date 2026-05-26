# AI Cowork Protocol Summary

## Source

This is a Claude-ready summary of `docs/execution/AI_COWORK_PROTOCOL.md`.

## ChatGPT / Orion Role

ChatGPT/Orion acts as mission commander and product/QA interpreter.

Responsibilities:

- define mission scope and branch
- interpret QA findings
- separate blockers from follow-ups
- authorize merge or deployment decisions
- protect strategy sequencing

## Codex Role

Codex is the implementation agent in the local workspace.

Responsibilities:

- inspect repository source of truth
- implement scoped changes
- run tests/builds/checks
- commit, push, and open PRs
- report changed files, validation, risks, and limitations

Codex should not merge or deploy without explicit operator authorization.

## Claude Role

Claude is an independent reviewer and QA/root-cause assessor.

Responsibilities:

- review architecture and governance
- inspect likely code paths
- critique projection/privacy risks
- identify root causes for QA failures
- recommend targeted fixes or future missions

Claude should not override repo source of truth or treat future strategy as implemented behavior.

## Playwright Role

Playwright is the deterministic browser QA runner.

It should capture repeatable evidence such as screenshots, console errors, traces, route behavior, and responsive layout state. It should not mutate production data unless explicitly authorized through a safe QA flow.

## Local / Dev Container Sandbox Role

The local sandbox or Dev Container is the controlled cowork environment.

Rules:

- no secrets committed
- no production writes without explicit approval
- no uncontrolled agent-to-agent loops
- no autonomous merge or deploy
- no bypassing auth, Firestore rules, or policy gates

## QA Handoff Expectations

Normal handoff:

1. Codex builds or fixes.
2. Claude reviews or audits independently when requested.
3. Playwright captures deterministic browser evidence where applicable.
4. Orion/operator decides pass/fail and authorizes merge/deploy.

## Deployment Truth

- GitHub PRs are code review and required check source of truth.
- Vercel proves frontend preview deployment.
- Cloud Run proves backend revision, image, and traffic.
- A green Vercel preview does not prove backend code is current.

## Implementation Path

Codex remains the implementation path. Claude may recommend changes, but changes should flow through scoped mission branches, tests, PRs, preview QA, and explicit operator approval.
