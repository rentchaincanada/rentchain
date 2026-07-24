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
      "artifactregistry.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "iam.googleapis.com",
      "run.googleapis.com",
      "serviceusage.googleapis.com",
    ])
    error_message = "The B4 Preview foundation API allowlist has changed."
  }
}

check "b4_deployment_foundation_boundary" {
  assert {
    condition = (
      local.preview_deployment_region == "northamerica-northeast1" &&
      local.preview_repository_id == "rentchain-preview" &&
      local.preview_repository_format == "DOCKER" &&
      google_artifact_registry_repository.preview_backend.docker_config[0].immutable_tags
    )
    error_message = "The B4 repository project boundary, region, ID, format, or tag immutability has changed."
  }

  assert {
    condition = (
      local.preview_repository_cleanup.keep_recent_tagged_count == 15 &&
      local.preview_repository_cleanup.delete_untagged_after == "604800s"
    )
    error_message = "The B4 repository cleanup policy is no longer bounded to 15 recent versions and seven-day untagged cleanup."
  }

  assert {
    condition = (
      google_service_account.preview_backend_runtime.account_id == "preview-backend-runtime" &&
      google_service_account.preview_backend_runtime.project == "rentchain-preview"
    )
    error_message = "The B4 future runtime identity has changed."
  }
}

check "github_preview_deployment_identity_boundary" {
  assert {
    condition = (
      local.github_repository == "rentchaincanada/rentchain" &&
      local.github_repository_id == "1103977082" &&
      local.github_repository_owner == "rentchaincanada" &&
      local.github_repository_owner_id == "246115482" &&
      local.github_trusted_ref == "refs/heads/main" &&
      local.github_trusted_event == "workflow_dispatch" &&
      local.github_trusted_workflow == "rentchaincanada/rentchain/.github/workflows/preview-deployment-identity-validation.yml@refs/heads/main" &&
      local.github_expected_subject == "repo:rentchaincanada/rentchain:ref:refs/heads/main"
    )
    error_message = "The B3 GitHub repository, owner, ref, event, workflow, or subject boundary has changed."
  }

  assert {
    condition = local.github_deployment_inspection_permissions == toset([
      "resourcemanager.projects.get",
      "serviceusage.services.get",
      "serviceusage.services.list",
    ])
    error_message = "The B3 deployment identity permission set has changed."
  }
}

check "b6_preview_backend_boundary" {
  assert {
    condition = (
      local.preview_backend_service_name == "rentchain-preview-backend" &&
      local.preview_backend_image_digest == "northamerica-northeast1-docker.pkg.dev/rentchain-preview/rentchain-preview/backend@sha256:3a7de2792511786d9f984de5f99ee19b5466ad8336d9ec4e307702c9dedd8cfd" &&
      local.preview_backend_source_sha == "d28c61991131e9a76874d5eb92adceac048f9417" &&
      !var.enable_preview_backend_service || (
        google_cloud_run_v2_service.preview_backend[0].project == "rentchain-preview" &&
        google_cloud_run_v2_service.preview_backend[0].location == "northamerica-northeast1" &&
        google_cloud_run_v2_service.preview_backend[0].ingress == "INGRESS_TRAFFIC_ALL" &&
        google_cloud_run_v2_service.preview_backend[0].template[0].service_account == google_service_account.preview_backend_runtime.email &&
        google_cloud_run_v2_service.preview_backend[0].template[0].containers[0].image == local.preview_backend_image_digest
      )
    )
    error_message = "B6 Preview backend Cloud Run foundation changed outside the approved private digest-pinned design."
  }
}

check "b6_cloud_run_deployer_iam_boundary" {
  assert {
    condition = (
      google_project_iam_custom_role.terraform_preview_cloud_run_deployer.project == "rentchain-preview" &&
      google_project_iam_custom_role.terraform_preview_cloud_run_deployer.role_id == "terraformPreviewCloudRunDeployer" &&
      local.terraform_preview_cloud_run_deployer_permissions == toset([
        "run.locations.get",
        "run.operations.get",
        "run.services.create",
        "run.services.delete",
        "run.services.get",
        "run.services.update",
      ])
    )
    error_message = "The B6 Cloud Run deployer role must remain Preview-scoped and lifecycle-only."
  }

  assert {
    condition = (
      google_project_iam_member.terraform_preview_cloud_run_deployer.member == local.hcp_terraform_apply_member &&
      google_service_account_iam_member.terraform_preview_runtime_act_as.service_account_id == google_service_account.preview_backend_runtime.name &&
      google_service_account_iam_member.terraform_preview_runtime_act_as.member == local.hcp_terraform_apply_member &&
      google_service_account_iam_member.terraform_preview_runtime_act_as.role == "roles/iam.serviceAccountUser"
    )
    error_message = "B6 deployer access must use the exact HCP apply principal and runtime-account actAs binding."
  }
}

check "b5_image_delivery_boundary" {
  assert {
    condition = local.github_preview_image_publisher_permissions == toset([
      "artifactregistry.dockerimages.get",
      "artifactregistry.repositories.downloadArtifacts",
      "artifactregistry.repositories.get",
      "artifactregistry.repositories.uploadArtifacts",
      "artifactregistry.tags.create",
      "artifactregistry.tags.get",
    ])
    error_message = "The B5 GitHub image-publisher permission set has changed."
  }

  assert {
    condition = (
      google_artifact_registry_repository_iam_member.github_preview_image_publisher.project == "rentchain-preview" &&
      google_artifact_registry_repository_iam_member.github_preview_image_publisher.location == "northamerica-northeast1" &&
      contains(
        toset([
          "rentchain-preview",
          "projects/rentchain-preview/locations/northamerica-northeast1/repositories/rentchain-preview",
        ]),
        google_artifact_registry_repository_iam_member.github_preview_image_publisher.repository
      ) &&
      local.github_preview_image_publisher_member == "serviceAccount:github-preview-deploy@rentchain-preview.iam.gserviceaccount.com"
    )
    error_message = "The B5 repository-scoped image-publisher binding has changed."
  }
}
