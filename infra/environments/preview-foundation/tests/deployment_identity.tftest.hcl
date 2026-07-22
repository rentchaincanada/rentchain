mock_provider "google" {}

variables {
  project_id     = "rentchain-preview"
  project_number = "501298948635"
  environment    = "preview"
  baseline_labels = {
    environment = "preview"
    lifecycle   = "permanent"
    managed-by  = "terraform"
    owner       = "founder"
    platform    = "rentchain"
    purpose     = "shared-preview"
  }
  monthly_planning_ceiling_cad = 100
}

run "exact_b3_identity_contract_passes" {
  command = plan

  assert {
    condition     = google_iam_workload_identity_pool.github_preview_deploy.workload_identity_pool_id == "github-preview-deploy"
    error_message = "The B3 workload identity pool ID must remain exact."
  }

  assert {
    condition     = google_iam_workload_identity_pool_provider.github.workload_identity_pool_provider_id == "github"
    error_message = "The B3 provider ID must remain exact."
  }

  assert {
    condition     = google_iam_workload_identity_pool_provider.github.oidc[0].issuer_uri == "https://token.actions.githubusercontent.com"
    error_message = "The B3 provider must trust only the GitHub Actions issuer."
  }

  assert {
    condition     = google_service_account.github_preview_deploy.account_id == "github-preview-deploy"
    error_message = "The B3 deployment service account ID must remain exact."
  }

  assert {
    condition     = google_project_iam_custom_role.github_preview_deployment_inspector.permissions == local.github_deployment_inspection_permissions
    error_message = "The B3 custom role must remain inspection-only."
  }

  assert {
    condition     = google_service_account_iam_member.github_preview_deploy_federation.member == "principal://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/github-preview-deploy/subject/repo:rentchaincanada/rentchain:ref:refs/heads/main"
    error_message = "Federation must bind only the exact trusted GitHub subject."
  }

  assert {
    condition     = google_service_account_iam_member.github_preview_deploy_federation.role == "roles/iam.workloadIdentityUser"
    error_message = "Federation must grant only Workload Identity User on the deployment service account."
  }
}

run "wrong_project_fails_closed" {
  command = plan

  variables {
    project_id = "project-0d9658de-af29-4dc0-a99"
  }

  expect_failures = [var.project_id]
}

run "wrong_project_number_fails_closed" {
  command = plan

  variables {
    project_number = "000000000000"
  }

  expect_failures = [var.project_number]
}

run "wrong_environment_fails_closed" {
  command = plan

  variables {
    environment = "production"
  }

  expect_failures = [var.environment]
}
