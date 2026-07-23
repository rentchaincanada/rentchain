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
      "artifactregistry.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "iam.googleapis.com",
      "run.googleapis.com",
      "serviceusage.googleapis.com",
    ])
    error_message = "The B4 Preview foundation API allowlist has changed."
  }
}

check "b4_deployment_foundation_boundary" {
  assert {
    condition = (
      local.preview_deployment_region == "northamerica-northeast1" &&
      local.preview_repository_id == "rentchain-preview" &&
      local.preview_repository_format == "DOCKER" &&
      google_artifact_registry_repository.preview_backend.docker_config[0].immutable_tags
    )
    error_message = "The B4 repository project boundary, region, ID, format, or tag immutability has changed."
  }

  assert {
    condition = (
      local.preview_repository_cleanup.keep_recent_tagged_count == 15 &&
      local.preview_repository_cleanup.delete_untagged_after == "604800s"
    )
    error_message = "The B4 repository cleanup policy is no longer bounded to 15 recent versions and seven-day untagged cleanup."
  }

  assert {
    condition = (
      google_service_account.preview_backend_runtime.account_id == "preview-backend-runtime" &&
      google_service_account.preview_backend_runtime.project == "rentchain-preview"
    )
    error_message = "The B4 future runtime identity has changed."
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
