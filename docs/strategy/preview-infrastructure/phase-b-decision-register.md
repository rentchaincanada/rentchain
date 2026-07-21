# Phase B Decision Register

| Decision | Status | Resolution / approval needed |
| --- | --- | --- |
| Shared vs per-PR data | Recommended | Shared synthetic foundation with run namespaces; executive/security approval. |
| Shared vs per-PR compute | Recommended | Ephemeral PR Cloud Run services using immutable digests. |
| Firebase timing | Decided for plan | Defer until B6; identity/exact-head first. |
| Terraform ownership | Requires executive approval | Name workspace owner/approvers and prove isolated state. |
| Backend routing | Recommended | Vercel server proxy with trusted mapping; no client URL/no fallback. |
| Fixture reset | Recommended | Manifest-driven namespace delete/reseed; never global collection purge. |
| Mutable QA | Decided for plan | Serialize per namespace; parallelize read-only smoke. |
| Provider stubs | Requires technical validation | Typed central gate plus deterministic stubs and visible banner. |
| Project retention/reuse | Requires executive approval | Do not assume former spike project is permanent; inventory/import decision. |
| Cleanup automation | Recommended | PR close plus TTL reconciliation; manual dual-approved fallback. |
| Cost ceiling | Requires executive approval | CAD 100/month; 50/80/100 alerts; CAD 15/day anomaly. |
| Production fallback | Decided | Prohibited at routing, project, storage, identity, and provider layers. |
| Organization folder | Deferred | Use if already authorized; direct project fallback otherwise. |
| Admin fixture | Recommended | Create only for required admin-only coverage. |
| Vercel trust granularity | Requires technical validation | Validate available claims beyond Team/project/environment subject. |
| Terraform Cloud current state | Requires technical validation | Console evidence and owner attestation required. |
| Storage in B6 | Recommended | Dedicated synthetic-only bucket only when signed-document tests require it. |
| Full per-PR environments | Deferred | Revisit for scale/regulatory/destructive concurrency. |

Statuses describe this planning record, not implementation authority. No item marked decided authorizes a cloud/runtime change.
