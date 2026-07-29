locals {
  vercel_preview_team_slug  = "rent-chain"
  vercel_preview_owner_id   = "team_NMg7i76JKz4ZwSJ07GYmZZYx"
  vercel_preview_project    = "rentchain"
  vercel_preview_project_id = "prj_YN5ecHjXdwE3cp76pivyAf2BKX5I"
  vercel_preview_subject    = "owner:rent-chain:project:rentchain:environment:preview"
  vercel_preview_issuer     = "https://oidc.vercel.com/rent-chain"

  vercel_preview_provider_condition = join(" && ", [
    "assertion.owner_id == '${local.vercel_preview_owner_id}'",
    "assertion.project_id == '${local.vercel_preview_project_id}'",
    "assertion.environment == 'preview'",
    "assertion.sub == '${local.vercel_preview_subject}'",
  ])

  vercel_preview_federated_member  = "principal://iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/vercel-preview-proxy/subject/${local.vercel_preview_subject}"
  vercel_preview_provider_path     = "projects/${var.project_number}/locations/global/workloadIdentityPools/vercel-preview-proxy/providers/vercel-preview"
  vercel_preview_provider_audience = "https://iam.googleapis.com/${local.vercel_preview_provider_path}"
  vercel_preview_sts_audience      = "//iam.googleapis.com/${local.vercel_preview_provider_path}"
}

resource "google_iam_workload_identity_pool" "vercel_preview_proxy" {
  project                   = var.project_id
  workload_identity_pool_id = "vercel-preview-proxy"
  display_name              = "Vercel Preview Proxy"
  description               = "Non-production identity pool for the server-side Vercel Preview proxy to the private Preview backend."
  disabled                  = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_iam_workload_identity_pool_provider" "vercel_preview" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.vercel_preview_proxy.workload_identity_pool_id
  workload_identity_pool_provider_id = "vercel-preview"
  display_name                       = "Vercel Preview"
  description                        = "Exact RentChain Vercel Preview project trust for the private Preview backend proxy."
  disabled                           = false

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.owner_id"    = "assertion.owner_id"
    "attribute.project_id"  = "assertion.project_id"
    "attribute.environment" = "assertion.environment"
  }

  attribute_condition = local.vercel_preview_provider_condition

  oidc {
    issuer_uri = local.vercel_preview_issuer
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "vercel_preview_proxy" {
  project      = var.project_id
  account_id   = "vercel-preview-proxy"
  display_name = "Vercel Preview Proxy"
  description  = "Server-side Vercel Preview proxy identity for private Preview Cloud Run invocation only; no production use or user-managed keys."
  disabled     = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account_iam_member" "vercel_preview_proxy_workload_identity_user" {
  service_account_id = google_service_account.vercel_preview_proxy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.vercel_preview_federated_member

  depends_on = [google_iam_workload_identity_pool_provider.vercel_preview]
}

resource "google_service_account_iam_member" "vercel_preview_proxy_openid_token_creator" {
  service_account_id = google_service_account.vercel_preview_proxy.name
  role               = "roles/iam.serviceAccountOpenIdTokenCreator"
  member             = local.vercel_preview_federated_member

  depends_on = [google_iam_workload_identity_pool_provider.vercel_preview]
}

resource "google_cloud_run_v2_service_iam_member" "vercel_preview_proxy_invoker" {
  project  = var.project_id
  location = local.preview_deployment_region
  name     = google_cloud_run_v2_service.preview_backend[0].name
  role     = "roles/run.invoker"
  member   = google_service_account.vercel_preview_proxy.member
}
