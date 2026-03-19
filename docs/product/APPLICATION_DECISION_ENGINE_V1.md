# Application Decision Engine V1

## Purpose
Application Decision Engine v1 adds a compact landlord review layer before lease generation. It summarizes current application signals, AI risk context, reference prompts, screening recommendation, and next best action without changing the broader application workflow.

## Surface
The decision support card appears in the existing landlord applications detail view on `ApplicationsPage`.

## Included Signals
- application status context
- compact AI or derived risk insights
- 3-5 landlord reference questions
- screening recommendation with priority
- screening summary when existing screening data is available
- one summary line and one next best action

## Screening Recommendation Logic
- screening already complete: review existing screening and references
- screening in progress: no duplicate recommendation
- sparse or elevated application signals: recommend screening with higher priority
- otherwise: screening remains a confidence-building option

## V1 Limits
- no new screening provider integrations
- no raw AI payload exposure
- no raw screening payload exposure
- no automatic approval or denial decisions
- no tenant-facing UI in this phase

## Follow-up Ideas
- link inquiry intake status into the decision summary
- add approval workflow actions beside the summary
- add reference outreach workflow support
- deepen screening synthesis once provider summaries stabilize
