locals {
  production_cloudbuild_source_bucket = "project-0d9658de-af29-4dc0-a99_cloudbuild"

  production_cloudbuild_source_object_reader_permissions = toset([
    "storage.objects.get",
  ])
}

resource "google_project_iam_custom_role" "production_cloudbuild_source_object_reader" {
  project     = var.project_id
  role_id     = "productionCloudBuildSourceObjectReader"
  title       = "Production Cloud Build Source Object Reader"
  description = "Reads Cloud Build source archives from the approved Production staging bucket."
  permissions = local.production_cloudbuild_source_object_reader_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_storage_bucket_iam_member" "production_cloudbuild_source_object_reader" {
  bucket = local.production_cloudbuild_source_bucket
  role   = google_project_iam_custom_role.production_cloudbuild_source_object_reader.name
  member = local.production_cloudbuild_builder_member

  lifecycle {
    prevent_destroy = true
  }
}
