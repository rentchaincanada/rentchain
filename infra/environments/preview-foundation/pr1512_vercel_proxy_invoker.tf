# Temporary service-level access for the PR #1512 read-only Notices QA proxy.
# Remove after browser QA is complete and the isolated QA service is retired.
resource "google_cloud_run_v2_service_iam_member" "pr1512_vercel_proxy_invoker" {
  project  = "rentchain-preview"
  location = "northamerica-northeast1"
  name     = "rentchain-pr1512-notices-qa-fff3a2dc"
  role     = "roles/run.invoker"
  member   = google_service_account.vercel_preview_proxy.member
}
