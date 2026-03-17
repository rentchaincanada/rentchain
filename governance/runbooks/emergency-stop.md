# Emergency Stop

Use this runbook if an agent appears to be operating outside approved scope or attempts a protected action.

1. Stop the run immediately.
2. Do not merge or deploy the resulting changes.
3. Capture the task id, branch, changed files, and the command or instruction that triggered the issue.
4. Review the diff against the approved scope.
5. Revoke the override or task approval if necessary.
6. Open a containment PR or revert branch if any unsafe changes were committed.
7. Document the incident in the audit trail.
