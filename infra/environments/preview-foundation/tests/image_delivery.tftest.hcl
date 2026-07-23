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

run "exact_b5_image_delivery_contract_passes" {
  command = plan

  assert {
    condition     = google_project_iam_custom_role.github_preview_image_publisher.role_id == "githubPreviewImagePublisher"
    error_message = "The B5 image-publisher custom role ID must remain exact."
  }

  assert {
    condition     = google_project_iam_custom_role.github_preview_image_publisher.permissions == local.github_preview_image_publisher_permissions
    error_message = "The B5 image-publisher role must contain only the approved six permissions."
  }

  assert {
    condition     = google_artifact_registry_repository_iam_member.github_preview_image_publisher.project == "rentchain-preview"
    error_message = "The B5 repository IAM member must target only rentchain-preview."
  }

  assert {
    condition     = google_artifact_registry_repository_iam_member.github_preview_image_publisher.location == "northamerica-northeast1"
    error_message = "The B5 repository IAM member must remain in northamerica-northeast1."
  }

  assert {
    condition     = google_artifact_registry_repository_iam_member.github_preview_image_publisher.repository == "rentchain-preview"
    error_message = "The B5 repository IAM member must target only the rentchain-preview repository."
  }

  assert {
    condition     = google_artifact_registry_repository_iam_member.github_preview_image_publisher.member == "serviceAccount:github-preview-deploy@rentchain-preview.iam.gserviceaccount.com"
    error_message = "Only the exact GitHub Preview deployment identity may receive the image-publisher role."
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
