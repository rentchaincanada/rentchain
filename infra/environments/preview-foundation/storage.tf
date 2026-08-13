locals {
  preview_attachment_bucket_name = "rentchain-preview-attachments"
  preview_attachment_object_permissions = toset([
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.get",
  ])
}

resource "google_storage_bucket" "preview_attachments" {
  project                     = var.project_id
  name                        = local.preview_attachment_bucket_name
  location                    = local.preview_deployment_region
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  force_destroy               = false

  labels = {
    environment = "preview"
    managed-by  = "terraform"
    purpose     = "maintenance-attachment-qa"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "preview_attachment_object_runtime" {
  project     = var.project_id
  role_id     = "previewAttachmentObjectRuntime"
  title       = "Preview Attachment Object Runtime"
  description = "Exact object create, get, and delete access for the governed Preview attachment bucket."
  permissions = local.preview_attachment_object_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_storage_bucket_iam_member" "preview_attachment_runtime" {
  bucket = google_storage_bucket.preview_attachments.name
  role   = google_project_iam_custom_role.preview_attachment_object_runtime.name
  member = google_service_account.preview_backend_runtime.member

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account_iam_member" "preview_runtime_self_token_creator" {
  service_account_id = google_service_account.preview_backend_runtime.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = google_service_account.preview_backend_runtime.member

  lifecycle {
    prevent_destroy = true
  }
}
