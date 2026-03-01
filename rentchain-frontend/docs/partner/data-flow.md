# Data Flow

## High-Level Flow

```text
Landlord Action
   -> Platform UI
      -> Authenticated API Request
         -> Consent Validation + Policy Checks
            -> Provider Adapter
               -> External Bureau Service
            <- Normalized Result
         <- Stored Result + Audit Entry
      <- UI Status Update
```

## Timeline/Event Mapping (Read-Only)

```text
Provider Request Submitted     -> Event Type: SCREENING
Provider Result Received       -> Event Type: SCREENING
Lease Follow-up Action         -> Event Type: LEASE
Operational Failure/Retry      -> Event Type: SYSTEM
```

## Data Handling Boundaries

- Frontend: displays workflow state and user actions.
- Backend: validates authorization, consent, and provider communication.
- Provider: receives approved request payload and returns result payload.

## Failure Behavior

- Provider errors must be mapped to safe, user-readable states.
- Workflows remain non-destructive on transient provider failures.
- Retries should be controlled by policy, not by user spam actions.
