# Rollback Procedure

Rollback remains a Git and PR workflow, not an ad hoc production edit.

1. Identify the offending commit or PR.
2. Create a rollback branch from the appropriate base.
3. Revert the commit set with a reviewable diff.
4. Run the minimum validation needed to confirm the rollback is safe.
5. Open a rollback PR with the reason, impact, and follow-up plan.
6. Merge through normal approval gates.
