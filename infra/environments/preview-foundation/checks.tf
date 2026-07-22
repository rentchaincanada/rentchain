check "preview_project_identity" {
  assert {
    condition = (
      var.project_id == "rentchain-preview" &&
      var.project_number == "501298948635" &&
      var.environment == "preview"
    )
    error_message = "Preview project identity is inconsistent with the approved B1 evidence."
  }
}

check "management_api_boundary" {
  assert {
    condition = local.approved_management_services == toset([
      "cloudresourcemanager.googleapis.com",
      "iam.googleapis.com",
      "serviceusage.googleapis.com",
    ])
    error_message = "The B2 management API allowlist has changed."
  }
}
