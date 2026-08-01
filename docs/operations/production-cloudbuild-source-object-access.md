# Production Cloud Build Source-Object Access

## Evidence

The corrected manual submission for source commit
`28668818191bf9c6ea7c9802295b1c243ec440f1` was made by
`admin@rentchain.ai` for the build-only identity
`rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com`.
Cloud Build rejected the submission before creating a build because that
identity lacked `storage.objects.get` on the uploaded archive under
`gs://project-0d9658de-af29-4dc0-a99_cloudbuild/source/`.

The submitting user uploads the archive through `gcloud builds submit`. The
custom build identity then reads the known archive to start the build. The
builder does not create, update, delete, or list source objects.

## Least-privilege decision

The staging bucket is a Google-created US multi-region bucket with uniform
bucket-level access. Object-level IAM is therefore unavailable. Predefined
`roles/storage.objectViewer` is broader than the observed need because it
includes listing and additional folder/metadata reads.

The selected correction declares a project custom role named
`productionCloudBuildSourceObjectReader` containing only
`storage.objects.get`, bound only on the exact staging bucket to the build-only
service account. It grants no project-level Storage role and no object list,
create, update, delete, bucket administration, Cloud Run, secret, trigger, or
impersonation authority.

## Ownership and governed lifecycle

The Cloud Build staging bucket is external to the repository-root Terraform
state; Terraform manages only the exact bucket IAM member, not the bucket.
The existing HCP execution identity cannot create custom roles or mutate bucket
IAM. Use the established Path B sequence:

1. review and merge the two-resource Terraform declaration without apply;
2. separately authorize exact administrative creation of the custom role and
   exact bucket binding;
3. add and review import blocks through VCS;
4. apply only the approved imports and prove zero drift;
5. separately authorize one corrected build test.

No live permission, build, trigger, or runtime change is made by this design
mission.
