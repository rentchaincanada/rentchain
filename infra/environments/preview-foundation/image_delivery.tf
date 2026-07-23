locals {
  github_preview_image_publisher_member = "serviceAccount:github-preview-deploy@rentchain-preview.iam.gserviceaccount.com"

  github_preview_image_publisher_permissions = toset([
    "artifactregistry.dockerimages.get",
    "artifactregistry.repositories.downloadArtifacts",
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.uploadArtifacts",
    "artifactregistry.tags.create",
    "artifactregistry.tags.get",
  ])
}

resource "google_project_iam_custom_role" "github_preview_image_publisher" {
  project     = var.project_id
  role_id     = "githubPreviewImagePublisher"
  title       = "GitHub Preview Image Publisher"
  description = "Repository-scoped upload and exact-artifact inspection for the trusted Preview image workflow."
  permissions = local.github_preview_image_publisher_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_artifact_registry_repository_iam_member" "github_preview_image_publisher" {
  project    = var.project_id
  location   = google_artifact_registry_repository.preview_backend.location
  repository = google_artifact_registry_repository.preview_backend.repository_id
  role       = google_project_iam_custom_role.github_preview_image_publisher.name
  member     = local.github_preview_image_publisher_member

  lifecycle {
    prevent_destroy = true
  }
}
