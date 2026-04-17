# Mission Queue

## Status Key
- queued
- active
- in_review
- blocked
- merged

| Mission | Title | Branch | Status | Depends On | Purpose |
|---|---|---|---|---|---|
| 24 | Subscription / Tier System v2 | feat/subscription-tier-system-v2 | active | mission-system-hardening-v1 | Normalize canonical plans, pricing, entitlements, and upgrade semantics |
| 25 | Upgrade Prompt and Locked-State System v1 | feat/upgrade-prompt-and-locked-state-system-v1 | queued | 24 | Standardize upgrade prompts, locked states, and required-plan messaging |
| 26 | Portfolio Intelligence Entitlements v1 | feat/portfolio-intelligence-entitlements-v1 | queued | 24, 25 | Apply clean plan-aware access to portfolio intelligence surfaces |
| 27 | Marketplace Premium Access Controls v1 | feat/marketplace-premium-access-controls-v1 | queued | 24, 25 | Add premium marketplace gating, visibility, and upgrade handling |
| 28 | Billing Status and Access Reliability v1 | feat/billing-status-and-access-reliability-v1 | queued | 24 | Harden subscription-state resolution and access consistency |
| 29 | Subscription Conversion Analytics v1 | feat/subscription-conversion-analytics-v1 | queued | 24, 25, 28 | Measure upgrade prompts, pricing engagement, and conversion funnel performance |

## Notes

- Branches are reserved in mission files but should only be created when the mission is activated.
- Codex must validate the active branch before implementation and stop if it is incorrect.
- Each mission should begin with a short audit of source-of-truth files before coding.
- Do not run dependent missions until their required predecessor missions are merged unless explicitly approved.
