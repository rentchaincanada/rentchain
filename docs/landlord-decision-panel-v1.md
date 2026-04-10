# Landlord Decision Panel v1

## Purpose

Landlord Decision Panel v1 turns the existing Risk Agent v1 snapshot into a clear manual review interface inside the landlord application workflow.

It helps a reviewer answer:

- is this applicant lower risk or higher risk
- why
- what should I do next

This panel is decision support only. It does not approve, reject, or mutate application state automatically.

## What Landlords See

The panel is embedded in the existing application review flow and shows:

- risk score
- grade
- confidence
- lower-risk / higher-risk label
- top positive and negative factors
- warnings / flags
- next-step guidance
- manual decision actions

## Decision Actions

Landlords can choose:

- Approve
- Reject
- Request More Info

These actions are audit-only in v1. They create a lightweight decision record and optional note, but they do not change:

- application status
- lease status
- tenant status

## How It Connects To Risk Agent

The panel uses the latest Risk Agent v1 snapshot already surfaced in the review flow.

It does not:

- change scoring rules
- duplicate scoring logic
- infer hidden reasons outside the structured factor/flag/recommendation contract

## What It Does Not Do

Landlord Decision Panel v1 does not:

- auto-approve or auto-deny
- expose risk details to tenants
- send automated messages
- perform compliance logic
- change billing or pricing behavior

## Future Direction

This creates the first monetization-facing decision UI for landlord review. A later version can build on this with richer decision-history views, landlord review workflows, and deeper integration into review dashboards without changing the deterministic Risk Agent core.
