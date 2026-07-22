locals {
  github_repository          = "rentchaincanada/rentchain"
  github_repository_id       = "1103977082"
  github_repository_owner    = "rentchaincanada"
  github_repository_owner_id = "246115482"
  github_trusted_ref         = "refs/heads/main"
  github_trusted_event       = "workflow_dispatch"
  github_trusted_workflow    = "rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main"
  github_expected_subject    = "repo:rentchaincanada/rentchain:ref:refs/heads/main"

  github_deployment_inspection_permissions = toset([
    "resourcemanager.projects.get",
    "serviceusage.services.get",
    "serviceusage.services.list",
  ])

  github_provider_condition = join(" && ", [
    "assertion.repository == '${local.github_repository}'",
    "assertion.repository_id == '${local.github_repository_id}'",
    "assertion.repository_owner == '${local.github_repository_owner}'",
    "assertion.repository_owner_id == '${local.github_repository_owner_id}'",
    "assertion.ref == '${local.github_trusted_ref}'",
    "assertion.event_name == '${local.github_trusted_event}'",
    "assertion.job_workflow_ref == '${local.github_trusted_workflow}'",
    "assertion.sub == '${local.github_expected_subject}'",
  ])

  github_federated_member = "principal://iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/github-preview-deploy/subject/${local.github_expected_subject}"
}

resource "google_iam_workload_identity_pool" "github_preview_deploy" {
  project                   = var.project_id
  workload_identity_pool_id = "github-preview-deploy"
  display_name              = "GitHub Preview Deploy"
  description               = "Keyless identity pool for the exact trusted RentChain Preview deployment workflow."
  disabled                  = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_preview_deploy.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"
  description                        = "Exact-repository and exact-workflow GitHub Actions trust for Preview deployment validation."
  disabled                           = false

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository"          = "assertion.repository"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner"    = "assertion.repository_owner"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
    "attribute.event_name"          = "assertion.event_name"
    "attribute.job_workflow_ref"    = "assertion.job_workflow_ref"
  }

  attribute_condition = local.github_provider_condition

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "github_preview_deploy" {
  project      = var.project_id
  account_id   = "github-preview-deploy"
  display_name = "GitHub Preview Deploy"
  description  = "Keyless inspection-only identity for the trusted Preview deployment workflow."
  disabled     = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "github_preview_deployment_inspector" {
  project     = var.project_id
  role_id     = "githubPreviewDeploymentInspector"
  title       = "GitHub Preview Deployment Inspector"
  description = "Non-mutating project and service inspection for B3 identity validation."
  permissions = local.github_deployment_inspection_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account_iam_member" "github_preview_deploy_federation" {
  service_account_id = google_service_account.github_preview_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_federated_member

  depends_on = [google_iam_workload_identity_pool_provider.github]
}

resource "google_project_iam_member" "github_preview_deployment_inspector" {
  project = var.project_id
  role    = google_project_iam_custom_role.github_preview_deployment_inspector.name
  member  = google_service_account.github_preview_deploy.member
}
