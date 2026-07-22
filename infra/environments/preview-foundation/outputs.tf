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
