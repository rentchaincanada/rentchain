locals {
  production_cloudbuild_builder_member = google_service_account.production_cloudbuild_builder.member
  production_cloudbuild_repository     = "rentchain-api"
  production_cloudbuild_region         = "us-central1"

  production_cloudbuild_artifact_publisher_permissions = toset([
    "artifactregistry.dockerimages.get",
    "artifactregistry.repositories.downloadArtifacts",
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.uploadArtifacts",
    "artifactregistry.tags.create",
    "artifactregistry.tags.get",
  ])
}

resource "google_service_account" "production_cloudbuild_builder" {
  project      = var.project_id
  account_id   = "rentchain-cloudbuild-builder"
  display_name = "RentChain Production Cloud Build builder"
  description  = "Build-only identity for the Production backend image trigger; no deploy or runtime authority."

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "production_cloudbuild_artifact_publisher" {
  project     = var.project_id
  role_id     = "productionCloudBuildArtifactPublisher"
  title       = "Production Cloud Build Artifact Publisher"
  description = "Repository-scoped immutable image upload and exact-artifact inspection for Production builds."
  permissions = local.production_cloudbuild_artifact_publisher_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_artifact_registry_repository_iam_member" "production_cloudbuild_artifact_publisher" {
  project    = var.project_id
  location   = local.production_cloudbuild_region
  repository = local.production_cloudbuild_repository
  role       = google_project_iam_custom_role.production_cloudbuild_artifact_publisher.name
  member     = local.production_cloudbuild_builder_member

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "production_cloudbuild_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = local.production_cloudbuild_builder_member

  lifecycle {
    prevent_destroy = true
  }
}
