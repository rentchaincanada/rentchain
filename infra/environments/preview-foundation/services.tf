locals {
  approved_management_services = toset([
    "apikeys.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "identitytoolkit.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
  ])
}

resource "google_project_service" "approved_management" {
  for_each = local.approved_management_services

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false

  lifecycle {
    prevent_destroy = true
  }
}
