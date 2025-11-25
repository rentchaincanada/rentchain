// Simple first resource: a storage bucket for future reports / exports.

resource "google_storage_bucket" "reports" {
  name          = "${var.project_id}-reports-bucket"
  location      = "NORTHAMERICA-NORTHEAST1"  // Montréal region (Canada)
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
}

output "reports_bucket_name" {
  value = google_storage_bucket.reports.name
}

