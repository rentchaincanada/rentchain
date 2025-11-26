# Enable services needed for Cloud Run and Artifact Registry
resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifact_registry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

# Artifact Registry repository for API Docker images
resource "google_artifact_registry_repository" "api_repo" {
  repository_id = "rentchain-api"
  format        = "DOCKER"
  location      = var.region

  description = "Artifact Registry repository for Rentchain landlord API containers"
}

# --------------------------------------------------------
# Cloud Run service for the landlord API
# --------------------------------------------------------

locals {
  api_image = "northamerica-northeast1-docker.pkg.dev/${var.project_id}/rentchain-api/rentchain-api:v1"
}

resource "google_cloud_run_service" "landlord_api" {
  name     = "rentchain-landlord-api"
  location = var.region

  template {
    spec {
      containers {
        image = local.api_image

        ports {
          name           = "http1"
          container_port = 8080
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.run,
    google_artifact_registry_repository.api_repo
  ]
}

# Public now (we can tighten later)
resource "google_cloud_run_service_iam_member" "landlord_api_public" {
  location = google_cloud_run_service.landlord_api.location
  service  = google_cloud_run_service.landlord_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
