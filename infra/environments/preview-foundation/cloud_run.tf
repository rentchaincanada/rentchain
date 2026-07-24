locals {
  preview_backend_service_name = "rentchain-preview-backend"
  preview_backend_image_digest = "northamerica-northeast1-docker.pkg.dev/rentchain-preview/rentchain-preview/backend@sha256:3a7de2792511786d9f984de5f99ee19b5466ad8336d9ec4e307702c9dedd8cfd"
  preview_backend_source_sha   = "d28c61991131e9a76874d5eb92adceac048f9417"
}

resource "google_cloud_run_v2_service" "preview_backend" {
  count    = var.enable_preview_backend_service ? 1 : 0
  project  = var.project_id
  name     = local.preview_backend_service_name
  location = local.preview_deployment_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  labels = {
    environment = "preview"
    managed-by  = "terraform"
    purpose     = "backend"
  }

  template {
    service_account = google_service_account.preview_backend_runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    timeout = "60s"

    max_instance_request_concurrency = 40

    containers {
      image = local.preview_backend_image_digest

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "APP_ENV"
        value = "preview"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "FIRESTORE_ENABLED"
        value = "false"
      }

      env {
        name  = "APP_GIT_SHA"
        value = local.preview_backend_source_sha
      }

      env {
        name  = "APP_IMAGE_DIGEST"
        value = "sha256:3a7de2792511786d9f984de5f99ee19b5466ad8336d9ec4e307702c9dedd8cfd"
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [
    google_project_service.approved_management["run.googleapis.com"],
  ]
}
