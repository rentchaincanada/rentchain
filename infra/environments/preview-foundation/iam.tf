locals {
  hcp_terraform_apply_member = "serviceAccount:hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com"

  terraform_preview_cloud_run_deployer_permissions = toset([
    "run.locations.get",
    "run.operations.get",
    "run.services.create",
    "run.services.delete",
    "run.services.get",
    "run.services.update",
  ])
}

resource "google_project_iam_custom_role" "terraform_preview_cloud_run_deployer" {
  project     = var.project_id
  role_id     = "terraformPreviewCloudRunDeployer"
  title       = "Terraform Preview Cloud Run Deployer"
  description = "Least-privilege lifecycle access for the single approved Preview backend service."
  permissions = local.terraform_preview_cloud_run_deployer_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "terraform_preview_cloud_run_deployer" {
  project = var.project_id
  role    = google_project_iam_custom_role.terraform_preview_cloud_run_deployer.name
  member  = local.hcp_terraform_apply_member

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account_iam_member" "terraform_preview_runtime_act_as" {
  service_account_id = google_service_account.preview_backend_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = local.hcp_terraform_apply_member

  lifecycle {
    prevent_destroy = true
  }
}
