# Deployment Gates

Agent work must not go directly from prompt to production.

## Required Gates
1. Work is completed on a branch.
2. Validation is run and recorded.
3. A PR is prepared with risks and rollback notes.
4. Required reviewer approval is captured.
5. Deployment remains a separate human-controlled step.

## Additional Gates For Yellow Or Red Work
- Confirm the policy id used for the task.
- Confirm whether an AUTHORIZATION OVERRIDE block was required.
- Confirm operator or founder review before merge.
