# Pipeline Deep Dive

## Purpose
Reference for build/test/deploy workflows across GitHub Actions, Google Cloud Build, Cloud Run, and Vercel.

## Main Delivery Path
- Git branch created from `origin/main`
- local build/test passes
- GitHub Actions validates build/test
- Google Cloud Build handles container build/deploy path where configured
- Cloud Run hosts backend
- Vercel hosts frontend

## Git Workflow
```bash
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
git checkout -b <feature-branch>
```

## Frontend Commands

```bash
cd rentchain-frontend
npm ci
npm run build
npm run test
```

## Backend Commands

```bash
cd rentchain-api
npm ci
npm run build
npm run test
```

## Terraform Commands

```bash
terraform init
terraform validate
terraform plan
```

## Cloud / Deploy Commands

```bash
gcloud builds submit
gcloud run deploy
firebase emulators:start
```

## Pipeline Constraints

* do not change CI/CD unless mission explicitly requires it
* do not change deploy targets casually
* do not widen environment variable usage without validation
* keep build/test green before proposing merge
* isolate infra changes from feature changes unless mission requires both

## Common Targets

* backend: Cloud Run
* frontend: Vercel
* infra: Terraform
* auth/data: Firebase/Firestore

## Change Checklist

When changing pipeline:

1. identify affected workflow files
2. identify env vars used
3. identify deployment target
4. run local validation
5. summarize operational risk
