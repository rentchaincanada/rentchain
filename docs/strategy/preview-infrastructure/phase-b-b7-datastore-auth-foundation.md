# B7 Preview Datastore and Authentication Foundation

## Decision

B7 uses the Firestore Native-mode `(default)` database and Identity Platform in
the isolated `rentchain-preview` project. The database location is
`northamerica-northeast1`.

This is a foundation-only change. It creates no user, document, fixture,
production resource, frontend route, public Cloud Run binding, static
credential, or Secret Manager secret.

## Datastore boundary

The backend already uses the Firebase Admin default Firestore instance. B7 makes
that assumption explicit with:

- `GOOGLE_CLOUD_PROJECT=rentchain-preview`
- `FIREBASE_PROJECT_ID=rentchain-preview`
- `FIRESTORE_DATABASE_ID=(default)`
- `FIRESTORE_ENABLED=true`

These values describe the later activation contract; B7 phase 1 does not change
the deployed Cloud Run environment. The environment guard in the prepared
runtime rejects a named database, production project, emulator endpoint, or
static credential in deployed Preview.

The runtime custom role is `previewBackendFirestoreRuntime` and contains exactly:

- `datastore.databases.get`
- `datastore.entities.create`
- `datastore.entities.delete`
- `datastore.entities.get`
- `datastore.entities.list`
- `datastore.entities.update`

Its binding is conditional on the exact database resource
`projects/rentchain-preview/databases/(default)` and applies only to
`preview-backend-runtime@rentchain-preview.iam.gserviceaccount.com`.

The database has API-level deletion protection and Terraform `prevent_destroy`.
Its Firestore-specific Terraform deletion policy is `ABANDON`.
It contains synthetic Preview data only. There is no startup migration, seed, or
destructive cleanup routine.

Existing composite-index definitions remain in
`rentchain-api/firestore.indexes.json`. B7 does not deploy them because this
mission authorizes no fixture or functional route. Required indexes must be
selected from observed later QA paths and reviewed in that phase.

## Authentication boundary

Identity Platform is configured in `rentchain-preview` with:

- email/password enabled and password required;
- anonymous and phone providers disabled;
- duplicate emails disabled;
- public user signup disabled;
- self-service user deletion disabled;
- MFA disabled;
- only `localhost` authorized until a separately reviewed frontend phase.

The backend password-login path uses a Preview API key restricted to
`identitytoolkit.googleapis.com`. A Firebase web API key identifies a client and
is not a privileged server credential, but Terraform and HCP still treat its
value as sensitive. Phase 2 creates the key in Terraform state without exposing
it through outputs or attaching it to Cloud Run. Delivery to Cloud Run requires
a separately reviewed activation phase; Secret Manager remains absent.

The runtime role `previewBackendAuthReader` contains only
`firebaseauth.users.get`. The existing login path needs this permission to read
the authenticated user and enforce verified email. User creation, deletion,
update, email delivery, token minting, and IAM administration are excluded.

No Preview user is created by B7. A later fixture phase must separately
authorize the synthetic landlord account and its deterministic cleanup.

Under the locked Google provider, the Identity Platform configuration has no
provider-level `ABANDON` deletion policy. Any removal or destruction requires a
separately reviewed Terraform plan. B7 authorizes no teardown, and every
authorized plan must contain zero destroy operations.

## Readiness

`/health` remains a liveness endpoint and returns HTTP 200 without exposing
secrets.

Before activation, `/health/ready` returns HTTP 503 with datastore and
authentication deferred.

After the later activation, readiness:

1. confirms the exact Preview project and `(default)` database configuration;
2. performs an ADC-backed Firestore `listCollections` probe;
3. reports the isolated authentication boundary as `configured`;
4. remains HTTP 503 until a later non-mutating token-boundary QA phase proves
   issuer, audience, expiry, and production-token rejection.

API-key presence is never reported as operational authentication readiness.

The response exposes only safe capability labels, environment, mode, database
ID, and redacted build-presence metadata.

## Required APIs

- `firestore.googleapis.com`
- `identitytoolkit.googleapis.com`
- `apikeys.googleapis.com`

No Firebase Management, Secret Manager, Firestore Rules, Cloud Run Jobs, or
production API is added.

## Apply sequencing and bootstrap gate

The B7 speculative plan is not apply authorization.

Phase 1 creates two dedicated B7 custom roles rather than broadening the
existing Cloud Run roles:

- `hcpTerraformPreviewB7Reader` contains exactly the four permissions in
  `tests/hcp_b7_plan_permission_delta.txt` and is bound only to
  `hcp-terraform-preview@rentchain-preview.iam.gserviceaccount.com`;
- `terraformPreviewB7Manager` contains exactly the nine permissions in
  `tests/hcp_b7_apply_permission_delta.txt` and is bound only to
  `hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com`.

The first Phase 2 apply partially succeeded: the protected Firestore database is
recorded in Terraform state, while Identity Platform and the restricted API key
remain absent. During Identity Platform initialization, the Google provider
invokes Firebase `AddFirebase` before creating the Identity Platform
configuration. Audit logs proved that `firebase.projects.update` was the sole
denied prerequisite permission; `firebaseauth.configs.create` was already
granted. The apply manager therefore includes that one additional permission.
No manual Firebase project association or Terraform import was performed.

The HCP apply identity already has the governed IAM role-management and project
policy permissions needed to create these roles and bindings. Do not substitute
the apply identity for the plan identity and do not widen Workload Identity
Federation.

The repository variable `b7_foundation_phase` is a governed phase gate. Its
default is advanced only through separately reviewed phase-transition PRs:

1. phase 1 enables the three APIs and creates the two B7 HCP roles and their
   exact bindings;
2. the current default, phase 2, adds Firestore, Identity Platform, and the
   restricted API key;
3. phase 3 adds the two exact runtime roles and bindings.

The Phase 1 apply installs the plan and apply permissions before Phase 2 is
selected. A later Phase 2 plan can therefore refresh the governed resource
types, and its apply identity can create them, without manual IAM mutation or
import. Existing IAM-management permissions cover Phase 3.

Cloud Run activation is deliberately absent from these phases. It requires a
separately reviewed image built from the B7 runtime code, followed by the exact
environment activation and operational authentication QA. Applying the current
environment changes to the older pinned image would be incompatible.

Use separate Founder-authorized phases:

1. API enablement plus exact B7 HCP read/apply roles and bindings;
2. datastore/auth resources;
3. runtime IAM;
4. separately published runtime image and Cloud Run environment activation;
5. normal plan-identity zero-drift verification.

Do not use targeted apply. If a phase cannot produce the reviewed scope, stop.

## Cost and teardown

At synthetic QA volume, the first Firestore database can remain within the
project free quota. Email/password Identity Platform usage is consumption-based;
phone/SMS is disabled. IAM and API enablement have no direct charge.

Teardown is separately authorized and ordered:

1. remove synthetic users and documents;
2. return Cloud Run to deferred mode;
3. remove runtime bindings and custom roles;
4. remove the API key and Identity Platform configuration;
5. disable APIs only after dependency checks;
6. explicitly disable database deletion protection, then delete the database.

Never copy data or identities to production during setup or teardown.
