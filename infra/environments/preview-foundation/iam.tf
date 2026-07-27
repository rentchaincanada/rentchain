locals {
  hcp_terraform_plan_member  = "serviceAccount:hcp-terraform-preview@rentchain-preview.iam.gserviceaccount.com"
  hcp_terraform_apply_member = "serviceAccount:hcp-terraform-preview-apply@rentchain-preview.iam.gserviceaccount.com"

  terraform_preview_cloud_run_viewer_permissions = toset([
    "run.services.get",
  ])

  terraform_preview_cloud_run_deployer_permissions = toset([
    "run.locations.get",
    "run.operations.get",
    "run.services.create",
    "run.services.delete",
    "run.services.get",
    "run.services.update",
  ])

  hcp_terraform_preview_b7_reader_permissions = toset([
    "apikeys.keys.get",
    "apikeys.keys.getKeyString",
    "datastore.databases.getMetadata",
    "firebaseauth.configs.get",
  ])

  terraform_preview_b7_manager_permissions = toset([
    "apikeys.keys.create",
    "apikeys.keys.get",
    "apikeys.keys.getKeyString",
    "datastore.databases.create",
    "datastore.databases.getMetadata",
    "firebase.projects.update",
    "firebaseauth.configs.create",
    "firebaseauth.configs.get",
    "firebaseauth.configs.update",
  ])
}

resource "google_project_iam_custom_role" "hcp_terraform_preview_b7_reader" {
  project     = var.project_id
  role_id     = "hcpTerraformPreviewB7Reader"
  title       = "HCP Terraform Preview B7 Reader"
  description = "Plan-phase read access for the governed Preview datastore and authentication foundation."
  permissions = local.hcp_terraform_preview_b7_reader_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "hcp_terraform_preview_b7_reader" {
  project = var.project_id
  role    = google_project_iam_custom_role.hcp_terraform_preview_b7_reader.name
  member  = local.hcp_terraform_plan_member

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "terraform_preview_b7_manager" {
  project     = var.project_id
  role_id     = "terraformPreviewB7Manager"
  title       = "Terraform Preview B7 Manager"
  description = "Apply-phase lifecycle access for the governed Preview datastore and authentication foundation."
  permissions = local.terraform_preview_b7_manager_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "terraform_preview_b7_manager" {
  project = var.project_id
  role    = google_project_iam_custom_role.terraform_preview_b7_manager.name
  member  = local.hcp_terraform_apply_member

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "terraform_preview_cloud_run_viewer" {
  project     = var.project_id
  role_id     = "hcpTerraformPreviewCloudRunViewer"
  title       = "HCP Terraform Preview Cloud Run Viewer"
  description = "Plan-phase read access for the managed Preview backend service."
  permissions = local.terraform_preview_cloud_run_viewer_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "terraform_preview_cloud_run_viewer" {
  project = var.project_id
  role    = google_project_iam_custom_role.terraform_preview_cloud_run_viewer.name
  member  = local.hcp_terraform_plan_member

  lifecycle {
    prevent_destroy = true
  }
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
