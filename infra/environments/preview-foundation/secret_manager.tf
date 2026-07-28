resource "google_secret_manager_secret" "preview_backend_identity_toolkit" {
  count = var.b7_foundation_phase >= 2 && var.b7_phase2_recovery_stage >= 2 && var.b7_restricted_api_key_activation ? 1 : 0

  project   = var.project_id
  secret_id = "preview-backend-identity-toolkit-api-key"

  replication {
    auto {}
  }

  deletion_protection = true

  depends_on = [
    google_project_service.approved_management["secretmanager.googleapis.com"],
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret_version" "preview_backend_identity_toolkit" {
  count = var.b7_foundation_phase >= 2 && var.b7_phase2_recovery_stage >= 2 && var.b7_restricted_api_key_activation ? 1 : 0

  secret                 = google_secret_manager_secret.preview_backend_identity_toolkit[0].id
  secret_data_wo         = google_apikeys_key.preview_backend_auth[0].key_string
  secret_data_wo_version = 1
  deletion_policy        = "DISABLE"

  lifecycle {
    create_before_destroy = true
  }
}
