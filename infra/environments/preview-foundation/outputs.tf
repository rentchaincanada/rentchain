output "foundation_target" {
  description = "Non-sensitive identity of the isolated Preview foundation."
  value = {
    environment    = var.environment
    project_id     = var.project_id
    project_number = var.project_number
    workspace      = "rentchain-preview-foundation"
  }
  sensitive = false
}

output "proposed_management_services" {
  description = "Management APIs proposed for a separately authorized B2 apply."
  value       = sort(tolist(local.approved_management_services))
  sensitive   = false
}

output "github_preview_deployment_identity" {
  description = "Non-sensitive identifiers for the B3 keyless Preview deployment identity."
  value = {
    workload_identity_provider = google_iam_workload_identity_pool_provider.github.name
    service_account_email      = google_service_account.github_preview_deploy.email
    trusted_repository         = local.github_repository
    trusted_workflow           = local.github_trusted_workflow
  }
  sensitive = false
}

output "preview_deployment_foundation" {
  description = "Non-sensitive identifiers for the un-deployed B4 Preview foundation."
  value = {
    region                        = google_artifact_registry_repository.preview_backend.location
    repository_id                 = google_artifact_registry_repository.preview_backend.repository_id
    repository_format             = google_artifact_registry_repository.preview_backend.format
    runtime_service_account_email = google_service_account.preview_backend_runtime.email
    workload_deployed             = false
  }
  sensitive = false
}

output "preview_backend_service" {
  description = "Non-sensitive identifiers for the private Preview backend service foundation."
  value = {
    name         = google_cloud_run_v2_service.preview_backend.name
    region       = google_cloud_run_v2_service.preview_backend.location
    uri          = google_cloud_run_v2_service.preview_backend.uri
    image_digest = local.preview_backend_image_digest
    source_sha   = local.preview_backend_source_sha
    ingress      = google_cloud_run_v2_service.preview_backend.ingress
  }
}
