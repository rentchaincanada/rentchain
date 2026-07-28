locals {
  preview_firestore_database_id = "(default)"
  preview_firestore_location    = "northamerica-northeast1"

  preview_runtime_member = google_service_account.preview_backend_runtime.member

  preview_runtime_firestore_permissions = toset([
    "datastore.databases.get",
    "datastore.entities.create",
    "datastore.entities.delete",
    "datastore.entities.get",
    "datastore.entities.list",
    "datastore.entities.update",
  ])

  preview_runtime_auth_permissions = toset([
    "firebaseauth.users.get",
  ])

  preview_identity_authorized_domains = toset([
    "localhost",
  ])
}

resource "google_firestore_database" "preview" {
  count = var.b7_foundation_phase >= 2 ? 1 : 0

  project     = var.project_id
  name        = local.preview_firestore_database_id
  location_id = local.preview_firestore_location
  type        = "FIRESTORE_NATIVE"

  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [
    google_project_service.approved_management["firestore.googleapis.com"],
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_identity_platform_config" "preview" {
  count = var.b7_foundation_phase >= 2 && var.b7_phase2_recovery_stage >= 2 && var.b7_identity_platform_activation ? 1 : 0

  project = var.project_id

  authorized_domains = sort(tolist(local.preview_identity_authorized_domains))

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }

    anonymous {
      enabled = false
    }

    phone_number {
      enabled = false
    }
  }

  client {
    permissions {
      disabled_user_signup   = true
      disabled_user_deletion = true
    }
  }

  mfa {
    state = "DISABLED"
  }

  depends_on = [
    google_project_service.approved_management["identitytoolkit.googleapis.com"],
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_apikeys_key" "preview_backend_auth" {
  count = var.b7_foundation_phase >= 2 && var.b7_phase2_recovery_stage >= 2 && var.b7_identity_platform_activation ? 1 : 0

  project      = var.project_id
  name         = "preview-backend-auth"
  display_name = "Preview Backend Identity Toolkit"

  restrictions {
    api_targets {
      service = "identitytoolkit.googleapis.com"
    }
  }

  depends_on = [
    google_project_service.approved_management["apikeys.googleapis.com"],
    google_project_service.approved_management["identitytoolkit.googleapis.com"],
    google_identity_platform_config.preview[0],
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "preview_runtime_firestore" {
  count = var.b7_foundation_phase >= 3 ? 1 : 0

  project     = var.project_id
  role_id     = "previewBackendFirestoreRuntime"
  title       = "Preview Backend Firestore Runtime"
  description = "Data-plane access to the isolated Preview Firestore database."
  permissions = local.preview_runtime_firestore_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "preview_runtime_firestore" {
  count = var.b7_foundation_phase >= 3 ? 1 : 0

  project = var.project_id
  role    = google_project_iam_custom_role.preview_runtime_firestore[0].name
  member  = local.preview_runtime_member

  condition {
    title       = "preview_default_firestore_only"
    description = "Restrict Preview runtime data access to the isolated default database."
    expression  = "resource.name == 'projects/${var.project_id}/databases/${local.preview_firestore_database_id}'"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_custom_role" "preview_runtime_auth_reader" {
  count = var.b7_foundation_phase >= 3 ? 1 : 0

  project     = var.project_id
  role_id     = "previewBackendAuthReader"
  title       = "Preview Backend Authentication Reader"
  description = "Read one Preview authentication user during verified password login."
  permissions = local.preview_runtime_auth_permissions
  stage       = "GA"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "preview_runtime_auth_reader" {
  count = var.b7_foundation_phase >= 3 ? 1 : 0

  project = var.project_id
  role    = google_project_iam_custom_role.preview_runtime_auth_reader[0].name
  member  = local.preview_runtime_member

  lifecycle {
    prevent_destroy = true
  }
}
