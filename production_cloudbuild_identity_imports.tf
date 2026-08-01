import {
  to = google_project_iam_custom_role.production_cloudbuild_artifact_publisher
  id = "projects/project-0d9658de-af29-4dc0-a99/roles/productionCloudBuildArtifactPublisher"
}

import {
  to = google_artifact_registry_repository_iam_member.production_cloudbuild_artifact_publisher
  id = "projects/project-0d9658de-af29-4dc0-a99/locations/us-central1/repositories/rentchain-api projects/project-0d9658de-af29-4dc0-a99/roles/productionCloudBuildArtifactPublisher serviceAccount:rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com"
}

import {
  to = google_project_iam_member.production_cloudbuild_log_writer
  id = "project-0d9658de-af29-4dc0-a99 roles/logging.logWriter serviceAccount:rentchain-cloudbuild-builder@project-0d9658de-af29-4dc0-a99.iam.gserviceaccount.com"
}
