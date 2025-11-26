# Enable Firestore / Datastore API
resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

# Firestore database in Native mode
resource "google_firestore_database" "primary" {
  name        = "(default)"
  project     = var.project_id
  location_id = var.region

  type = "FIRESTORE_NATIVE"

  concurrency_mode = "OPTIMISTIC"

  depends_on = [
    google_project_service.firestore
  ]
}
