# Production build/deploy separation and reconciliation plan

## Governed release sequence

An ordinary `main` change under `rentchain-api/**` may build and push a traceable candidate image. It must stop before Cloud Run deployment. Production candidate deployment and traffic promotion are separate protected manual workflows.

1. Cloud Build validates, builds, and pushes `sha-<40-character-source-sha>`.
2. An operator supplies the exact source SHA and immutable image URI to the protected `production-candidate` workflow.
3. The workflow verifies source ancestry, artifact provenance, and the current service contract before deploying with `--no-traffic`.
4. Cloud Run's internal `/health/ready` startup probe and `/health` liveness probe must make the candidate Ready while it remains at zero traffic.
5. A separate `production-promotion` approval verifies the successful candidate workflow evidence and promotes the exact revision.

No changed path authorizes Production deployment by itself.

## Required external configuration

Trigger `07c21dce-42db-4d5f-89d4-616534f27e4f` is externally managed. Keep its `^main$` branch and `rentchain-api/**` build scope, but retain `rentchain-api/cloudbuild.yaml` as build-only. Do not narrow away files that can affect the image.

Before either manual workflow can be used, separately authorize and configure:

- protected GitHub environments `production-candidate` and `production-promotion` with required reviewers;
- `PRODUCTION_WORKLOAD_IDENTITY_PROVIDER`;
- least-privilege `PRODUCTION_DEPLOY_SERVICE_ACCOUNT` and `PRODUCTION_PROMOTION_SERVICE_ACCOUNT` environment variables;
- distinct deployment and traffic-promotion IAM boundaries.
- a build-only Cloud Build service account for trigger `07c21dce-42db-4d5f-89d4-616534f27e4f`, replacing its currently over-privileged deployer identity after separate authorization.

Repository preparation does not change the trigger, GitHub settings, workload identity, or IAM.

## Service-template reconciliation

The current service template points to failed digest `sha256:0e6edd50ed6477ee3abd74e87f3ec8c77505f3df2290a2a5e3395e5ff6d237eb`, while 100% traffic remains on healthy revision `rentchain-landlord-api-01967-djh` at digest `sha256:e57b58376f46dda31f4c7459283b2e4525a7ec8f37c42539cb14eb08ddc6eaee`.

Production is represented by HCP resource `google_cloud_run_service.landlord_api`. The preferred reconciliation is a separately authorized Terraform review and apply that restores the governed known-good image/template and adds the required configuration before any new candidate deployment:

- `GOOGLE_CLOUD_PROJECT=project-0d9658de-af29-4dc0-a99`;
- existing service account unchanged;
- existing environment names and secret-reference names/versions preserved;
- `/health/ready` internal HTTP startup probe;
- `/health` internal HTTP liveness probe;
- existing CPU, memory, timeout, concurrency, scaling, ingress, port, and required annotations preserved.

Reconciliation is expected to create a new revision. It must not shift traffic without separate promotion authorization. A fresh speculative HCP plan is required after the repository correction is reviewed; the pre-incident zero-change plan cannot assess current drift.

If Terraform cannot preserve zero traffic for the reconciliation revision, use the protected candidate workflow with the known-good digest after the required template fields are reconciled. Do not use a bare `gcloud run deploy` as a substitute.

## Rollback and evidence preservation

Traffic rollback, template reconciliation, and artifact cleanup are distinct actions. If a future promotion must be rolled back, use a separately authorized traffic-only command:

```bash
gcloud run services update-traffic rentchain-landlord-api \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --to-revisions=rentchain-landlord-api-01967-djh=100
```

Do not delete failed revision `rentchain-landlord-api-01972-blq` or the incident image until the correction and reconciliation are complete and the evidence-retention decision is reviewed.
