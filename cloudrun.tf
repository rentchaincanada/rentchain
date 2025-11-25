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
