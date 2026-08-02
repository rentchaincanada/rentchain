# Production Cloud Build legacy deployer reduction

## Audited boundary

The legacy account is external to the Production Terraform state:

```text
rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com
```

The enabled automatic trigger `07c21dce-42db-4d5f-89d4-616534f27e4f` uses the separately managed build-only account. Its controlled build `9eca674c-6164-44f1-b519-7bdbff3fd1f6` succeeded from source `0757e284c32341df4bb9b464a32c4e13815bca83` without a Cloud Run deployment or traffic change. The legacy account has no user-managed key, service-account IAM binding, Workload Identity Federation binding, repository-level IAM binding, bucket-level IAM binding, or Cloud Run service-level IAM binding.

The bounded regional history returned 100 legacy-account builds: 93 successful and 7 failed, all from the primary trigger and none manual. The last was successful build `9fe1a9c8-9ae7-4e45-8a32-249c5626874d` at `2026-08-01T02:03:42.560994Z`, before the builder switch. The 90-day audit query returned 918 historical records: 306 Cloud Run service replacements, 306 Cloud Run IAM-policy calls, and 306 service-account act-as checks. Its latest record was `2026-07-31T22:36:05.058414Z`. No observed legacy use followed the successful builder-path validation.

A disabled external trigger, `6fb97ddb-6f1b-4c62-9532-6852b9e9975c` (`rentchain-deploy`), still names the legacy account. It must remain disabled. Removing the legacy account's roles makes any accidental re-enablement fail closed; deletion or mutation of that trigger is a separate operational-ownership decision.

The candidate and promotion workflows refer only to the unconfigured names `PRODUCTION_DEPLOY_SERVICE_ACCOUNT`, `PRODUCTION_PROMOTION_SERVICE_ACCOUNT`, and `PRODUCTION_WORKLOAD_IDENTITY_PROVIDER`. The required `production-candidate` and `production-promotion` environments do not exist. Neither workflow names the legacy account, and this reduction does not assume or create their future identities.

## Dependency classification

All current bindings are unconditional project-level grants and are external to Terraform.

| Role | Classification | Evidence | Prepared action |
| --- | --- | --- | --- |
| `roles/artifactregistry.writer` | A - proven obsolete | Enabled trigger uses the repository-scoped builder; no resource-level legacy binding | Remove project binding |
| `roles/cloudbuild.builds.editor` | A - proven obsolete | No enabled trigger or workflow uses the legacy account | Remove project binding |
| `roles/iam.serviceAccountUser` | A - proven obsolete | No governed current deploy path; no account-level impersonation binding | Remove project binding |
| `roles/logging.logWriter` | A - proven obsolete | Enabled trigger logs as the builder | Remove project binding |
| `roles/run.admin` | A - proven obsolete | Last observed operations were historical deploys before the builder switch; candidate/promotion identities are not configured | Remove project binding |
| `roles/serviceusage.serviceUsageConsumer` | A - proven obsolete | No enabled trigger, workflow, or Terraform resource requires legacy execution | Remove project binding |
| `roles/storage.admin` | A - proven obsolete | No bucket-level dependency; builder has a one-permission source-object reader | Remove project binding |

No role is retained. The service account remains enabled and undeleted for audit continuity. Disabling or deleting it is a later, separately authorized retirement action.

## Separately authorized external removal

Before removal, reverify that the enabled trigger still uses the builder and that the legacy trigger is disabled:

```bash
gcloud builds triggers describe 07c21dce-42db-4d5f-89d4-616534f27e4f \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --format='value(serviceAccount,filename,disabled)'

gcloud builds triggers describe 6fb97ddb-6f1b-4c62-9532-6852b9e9975c \
  --project=project-0d9658de-af29-4dc0-a99 \
  --region=us-central1 \
  --format='value(serviceAccount,filename,disabled)'
```

Only after separate approval, remove exactly these seven project bindings:

```bash
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/artifactregistry.writer'
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/cloudbuild.builds.editor'
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/iam.serviceAccountUser'
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/logging.logWriter'
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/run.admin'
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/serviceusage.serviceUsageConsumer'
gcloud projects remove-iam-policy-binding project-0d9658de-af29-4dc0-a99 \
  --member='serviceAccount:rentchain-cloudbuild-deployer@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com' \
  --role='roles/storage.admin'
```

Do not disable or delete the account, change either trigger, run a build, deploy Cloud Run, or change traffic as part of that removal.

## Post-removal verification

Read back project and service-account IAM, confirm zero legacy bindings and zero user-managed keys, then confirm the enabled trigger still uses the builder. Verify the Production revision, traffic, and health baseline remain unchanged. Any newly discovered legacy principal use or trigger movement stops the removal for Founder review.

This preparation does not remove IAM, mutate a trigger, submit a build, apply Terraform, deploy Cloud Run, change traffic, or configure GitHub environments.
