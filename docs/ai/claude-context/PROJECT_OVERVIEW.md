# RentChain Project Overview

## Platform Purpose

RentChain is governed rental operations and property intelligence infrastructure. It is not positioned as generic landlord SaaS. The platform organizes rental operations around auditable workflows, safe projections, tenant trust, evidence continuity, operational review, and institution-ready summaries.

RentChain's current product surface supports landlord, tenant, admin, and support workflows while preserving clear boundaries between user-facing views and internal governance metadata.

## Core Users

- Landlords and operators managing properties, applications, leases, maintenance, messages, documents, and portfolio operations.
- Tenants using a tenant portal for profile, lease, documents, messages, maintenance, and trust/export workflows.
- Admin/support operators reviewing platform health, support escalations, security incidents, projection safety, and governed review workspaces.
- Future institutional reviewers such as lenders, insurers, auditors, and program partners, through controlled export and trust-package concepts.

## Current Focus

The current engineering focus is operational governance:

- projection-safe read models
- admin/support metadata boundaries
- tenant-safe document and profile projections
- mobile landlord and tenant usability
- support escalation and review workspace foundations
- deployment verification discipline across Vercel and Cloud Run
- AI cowork process safety for Codex, Claude, Playwright, and operator approval

## Long-Term Institutional Direction

The long-term direction is institutional rental infrastructure:

- consent-scoped trust exports
- evidence-backed landlord and tenant operational history
- metadata-only review workspaces
- governed escalation and incident review
- identity, property, lease, and export readiness foundations
- supervised AI-assisted workflows, not autonomous enforcement

Future-facing docs describe readiness layers and strategy. Claude should not treat every strategic document as production behavior.

## Stack Summary

- Frontend: React, TypeScript, Vite, SWC, Vercel.
- Backend: Node.js, Express, TypeScript, Cloud Run.
- Auth: Firebase Auth and server-side authorization middleware.
- Database: Firestore.
- Storage: Google Cloud Storage where applicable.
- CI/CD: GitHub Actions, Vercel previews, Google Cloud Build/Cloud Run, Terraform context checks.
- QA: Vitest, Playwright readiness, manual preview QA, Cloud Run revision verification for backend changes.
