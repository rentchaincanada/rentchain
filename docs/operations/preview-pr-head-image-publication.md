# Preview PR-head image publication

This manual path exists only to prepare an immutable backend image for separately authorized, isolated Preview QA. Merging its workflow governance does not authorize dispatch. Every dispatch requires a Founder-approved PR number, exact 40-character head SHA, exact base SHA, and authorization reference.

The workflow definition always runs from trusted `main` under the existing main-only GitHub OIDC and Google Workload Identity Federation boundary. Before any Google authentication, it retrieves current GitHub PR metadata and fails closed unless the PR is open, targets `main`, belongs entirely to `rentchaincanada/rentchain`, is not a fork, and still has the authorized head and base SHAs. It then verifies commit existence and ancestry and checks out the exact head detached. Critical build files must match trusted `main`; the PR cannot change the project, registry, identity, publication command, or tag construction.

Publication is limited to one `linux/amd64` build and one push to `northamerica-northeast1-docker.pkg.dev/rentchain-preview/rentchain-preview/backend`. The tag is deterministic: `pr-<PR_NUMBER>-sha-<FULL_SHA>`. Runtime, filesystem, and credential checks must pass before OIDC authentication. The workflow records the immutable digest and full image reference but performs no Cloud Run deployment, traffic change, IAM mutation, Terraform operation, or Firestore operation.

PR #1453 at `0822687bd0bbfb0708ed2baa8f1397fcd989b8e7` is the first intended use. Its dispatch remains separately gated. The published tag and digest must be retained through QA evidence review, then removed only through a separately authorized cleanup operation after the QA service and synthetic namespace are retired.

Stop if the PR moves, closes, changes base or repository ownership, if the authorized base changes, if any critical build file differs from trusted `main`, if runtime validation fails, or if the destination cannot remain Preview-only. A successful workflow-governance PR does not authorize dispatch, image publication, deployment, QA infrastructure, synthetic writes, PR readiness, or merge.
