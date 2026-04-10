# Application Completion Engine v1

## What It Does

Application Completion Engine v1 gives tenants a guided view of what is complete, missing, pending, or needs review in their application journey.

It turns the existing tenant-safe workspace data into:

- a progress indicator
- grouped completion checklist sections
- clear item statuses
- next-step guidance
- direct links to existing tenant flows when those flows already exist

## What Data It Uses

The completion engine is a projection layer only. It does not create a new application model.

It aggregates existing tenant-safe data from:

- application status projection
- identity verification status
- document checklist visibility
- profile completeness signals
- lease and readiness context where safely available

## Status Meanings

The completion engine uses tenant-safe status translations such as:

- `completed`
- `verified`
- `pending`
- `missing`
- `needs_review`
- `not_started`
- `in_progress`

These are friendly, tenant-safe translations of the current platform state. Internal-only landlord, compliance, or risk reasoning is not exposed here.

## Supported Tenant Actions

When a step can be completed through an existing tenant flow, the completion engine links tenants into it directly, including:

- tenant profile
- invite redemption
- tenant messages
- lease or feed views where relevant

It does not add fake actions for unsupported flows.

## What Is Intentionally Deferred

This version does not:

- auto-submit applications
- auto-approve or auto-deny anything
- expose landlord/admin-only reasoning
- redesign the broader tenant portal
- re-architect upload or verification systems

## How It Improves Downstream Review

By making missing and pending steps clearer for tenants, the completion engine helps improve:

- application completeness
- profile quality
- document readiness
- identity readiness
- downstream landlord review clarity
- downstream Risk Agent input quality
