check "preview_project_identity" {
  assert {
    condition = (
      var.project_id == "rentchain-preview" &&
      var.project_number == "501298948635" &&
      var.environment == "preview"
    )
    error_message = "Preview project identity is inconsistent with the approved B1 evidence."
  }
}

check "management_api_boundary" {
  assert {
    condition = local.approved_management_services == toset([
      "cloudresourcemanager.googleapis.com",
      "iam.googleapis.com",
      "serviceusage.googleapis.com",
    ])
    error_message = "The B2 management API allowlist has changed."
  }
}

check "github_preview_deployment_identity_boundary" {
  assert {
    condition = (
      local.github_repository == "rentchaincanada/rentchain" &&
      local.github_repository_id == "1103977082" &&
      local.github_repository_owner == "rentchaincanada" &&
      local.github_repository_owner_id == "246115482" &&
      local.github_trusted_ref == "refs/heads/main" &&
      local.github_trusted_event == "workflow_dispatch" &&
      local.github_trusted_workflow == "rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main" &&
      local.github_expected_subject == "repo:rentchaincanada/rentchain:ref:refs/heads/main"
    )
    error_message = "The B3 GitHub repository, owner, ref, event, workflow, or subject boundary has changed."
  }

  assert {
    condition = local.github_deployment_inspection_permissions == toset([
      "resourcemanager.projects.get",
      "serviceusage.services.get",
      "serviceusage.services.list",
    ])
    error_message = "The B3 deployment identity permission set has changed."
  }
}
