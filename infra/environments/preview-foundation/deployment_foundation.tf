locals {
  preview_deployment_region = "northamerica-northeast1"
  preview_repository_id     = "rentchain-preview"
  preview_repository_format = "DOCKER"

  preview_repository_cleanup = {
    keep_recent_tagged_count = 15
    delete_untagged_after    = "604800s"
  }
}

resource "google_artifact_registry_repository" "preview_backend" {
  project       = var.project_id
  location      = local.preview_deployment_region
  repository_id = local.preview_repository_id
  description   = "Private exact-head Preview backend images; application image pushes remain separately authorized."
  format        = local.preview_repository_format

  cleanup_policy_dry_run = false

  docker_config {
    immutable_tags = true
  }

  cleanup_policies {
    id     = "delete-untagged-after-seven-days"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = local.preview_repository_cleanup.delete_untagged_after
    }
  }

  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"

    most_recent_versions {
      keep_count = local.preview_repository_cleanup.keep_recent_tagged_count
    }
  }

  labels = {
    environment = "preview"
    managed-by  = "terraform"
    purpose     = "backend-images"
  }

  depends_on = [
    google_project_service.approved_management["artifactregistry.googleapis.com"],
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "preview_backend_runtime" {
  project      = var.project_id
  account_id   = "preview-backend-runtime"
  display_name = "Preview Backend Runtime"
  description  = "Role-less future runtime identity for a separately authorized Preview backend deployment."
  disabled     = false

  lifecycle {
    prevent_destroy = true
  }
}
