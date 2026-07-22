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

run "exact_approved_labels_pass" {
  command = plan

  assert {
    condition     = length(google_project_service.approved_management) == 3
    error_message = "The approved baseline must retain exactly three proposed management services."
  }
}

run "additional_label_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "founder"
      platform    = "rentchain"
      purpose     = "shared-preview"
      extra       = "not-approved"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "missing_environment_label_fails" {
  command = plan

  variables {
    baseline_labels = {
      lifecycle  = "permanent"
      managed-by = "terraform"
      owner      = "founder"
      platform   = "rentchain"
      purpose    = "shared-preview"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "production_environment_label_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "production"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "founder"
      platform    = "rentchain"
      purpose     = "shared-preview"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "wrong_purpose_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "founder"
      platform    = "rentchain"
      purpose     = "production"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "wrong_owner_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "unknown"
      platform    = "rentchain"
      purpose     = "shared-preview"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "missing_managed_by_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      lifecycle   = "permanent"
      owner       = "founder"
      platform    = "rentchain"
      purpose     = "shared-preview"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "missing_lifecycle_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      managed-by  = "terraform"
      owner       = "founder"
      platform    = "rentchain"
      purpose     = "shared-preview"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "missing_platform_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "founder"
      purpose     = "shared-preview"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "missing_purpose_fails" {
  command = plan

  variables {
    baseline_labels = {
      environment = "preview"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "founder"
      platform    = "rentchain"
    }
  }

  expect_failures = [var.baseline_labels]
}

run "production_project_fails" {
  command = plan

  variables {
    project_id = "project-0d9658de-af29-4dc0-a99"
  }

  expect_failures = [var.project_id]
}

run "wrong_project_number_fails" {
  command = plan

  variables {
    project_number = "000000000000"
  }

  expect_failures = [var.project_number]
}
