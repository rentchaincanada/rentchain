# Risk Agent v1

## Purpose

Risk Agent v1 is RentChain's first deterministic application and tenancy risk evaluation layer. It converts existing canonical platform signals into a structured, explainable risk result for landlord and admin review workflows.

This version is intentionally:

- deterministic
- auditable
- machine-readable
- non-mutating

It does not auto-approve, auto-decline, or change tenant, application, or lease state.

## What It Uses

Risk Agent v1 evaluates only signals already available in canonical backend data. The current application-focused input set includes:

- monthly rent
- monthly income
- income-to-rent ratio
- identity verification status
- document completeness status
- employment duration
- co-tenant count
- application completeness
- payment history proxy when linked tenant/payment data exists
- lease/application consistency when a linked lease exists

Missing signals do not trigger hidden inference. They reduce confidence and may move the result to `insufficient_data`.

## Score Model

Risk Agent v1 uses:

- score range `0-100`
- higher score = lower risk / stronger file
- grade bands:
  - `A` = 85-100
  - `B` = 70-84
  - `C` = 55-69
  - `D` = 40-54
  - `E` = 0-39

The engine starts from a neutral baseline and applies explicit positive or negative factors.

Examples:

- strong income-to-rent coverage improves the score
- verified identity improves the score
- missing documents lower the score
- incomplete application lowers the score
- short employment history lowers the score
- lease/application conflicts trigger manual review behavior

## Status Model

Risk Agent v1 returns one of:

- `completed`
- `insufficient_data`
- `manual_review_required`

Rules:

- `completed` when the engine has enough core signals and no deterministic blocker
- `insufficient_data` when too many core inputs are missing
- `manual_review_required` when deterministic conflict or review-only conditions are present, such as lease/application inconsistency or identity/document review states

## Confidence Model

Confidence is deterministic and documentation-based. It increases when more core signals are present and consistent. It decreases when:

- monthly income or rent is missing
- identity or document status is unknown
- employment history is missing
- application completeness cannot be determined
- linked lease/application context conflicts

Confidence is not an ML probability. It is a coverage and consistency indicator.

## Output Contract

Each evaluation returns structured fields including:

- `version`
- `score`
- `grade`
- `confidence`
- `confidenceBand`
- `status`
- `factors`
- `flags`
- `recommendations`
- `inputs`
- `createdAt`

## Persistence

Risk Agent v1 writes to dedicated collections:

- `risk_agent_runs`
  - append-only evaluation runs
- `risk_agent_latest`
  - latest snapshot per evaluated entity

Current entity support:

- `application`

Each stored run includes:

- application id
- landlord id
- property id
- tenant id when available
- lease id when available
- review summary snapshot
- structured factors, flags, recommendations
- version and timestamp

## Access Surface

Risk Agent v1 is exposed only to landlord/admin-safe backend routes:

- `POST /api/risk-agent/applications/:id/evaluate`
- `GET /api/risk-agent/applications/:id/latest`

Access rules:

- landlord can only access their own application
- admin can access any application
- no tenant-facing route exposes internal risk reasoning in v1

## What It Does Not Do

Risk Agent v1 does not:

- use LLM reasoning
- use opaque ML scoring
- auto-approve or auto-decline applications
- mutate tenant/application/lease state
- expose risk reasoning to tenant routes
- store raw sensitive document payloads

## How To Interpret It

Landlords and admins should treat Risk Agent v1 as a structured decision-support layer, not a final decision maker.

Use it to answer:

- what factors are currently increasing or lowering confidence in this file
- what should be reviewed next
- whether the current application looks complete enough for manual decisioning

## Future V2 Ideas

Possible future extensions:

- richer screening-result normalization
- stronger payment history signals
- lease-review summary integration
- policy-specific overlays for different landlord operating models
- explicit comparison of multiple applicants or co-applicant bundles
