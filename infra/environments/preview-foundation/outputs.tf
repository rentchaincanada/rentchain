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
