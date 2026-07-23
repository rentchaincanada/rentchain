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

run "exact_b4_foundation_contract_passes" {
  command = plan

  assert {
    condition     = length(google_project_service.approved_management) == 5
    error_message = "The Preview API allowlist must contain exactly the three B2 services and two B4 services."
  }

  assert {
    condition     = google_artifact_registry_repository.preview_backend.project == "rentchain-preview"
    error_message = "The B4 repository must target only rentchain-preview."
  }

  assert {
    condition     = google_artifact_registry_repository.preview_backend.location == "northamerica-northeast1"
    error_message = "The B4 repository must remain in northamerica-northeast1."
  }

  assert {
    condition     = google_artifact_registry_repository.preview_backend.repository_id == "rentchain-preview"
    error_message = "The B4 repository ID must remain rentchain-preview."
  }

  assert {
    condition     = google_artifact_registry_repository.preview_backend.format == "DOCKER"
    error_message = "The B4 repository must remain Docker format."
  }

  assert {
    condition     = google_artifact_registry_repository.preview_backend.docker_config[0].immutable_tags == true
    error_message = "The B4 repository must prevent tag mutation."
  }

  assert {
    condition     = google_artifact_registry_repository.preview_backend.cleanup_policy_dry_run == false
    error_message = "The bounded cleanup policies must remain enforced."
  }

  assert {
    condition     = length(google_artifact_registry_repository.preview_backend.cleanup_policies) == 2
    error_message = "The B4 repository must retain exactly two bounded cleanup policies."
  }

  assert {
    condition     = google_service_account.preview_backend_runtime.account_id == "preview-backend-runtime"
    error_message = "The future Preview runtime account ID must remain exact."
  }

  assert {
    condition     = google_service_account.preview_backend_runtime.project == "rentchain-preview"
    error_message = "The future Preview runtime account must remain project-local."
  }
}

run "production_project_fails_closed" {
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
