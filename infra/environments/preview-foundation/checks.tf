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
      "apikeys.googleapis.com",
      "artifactregistry.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "firestore.googleapis.com",
      "iam.googleapis.com",
      "identitytoolkit.googleapis.com",
      "run.googleapis.com",
      "secretmanager.googleapis.com",
      "serviceusage.googleapis.com",
    ])
    error_message = "The B4 Preview foundation API allowlist has changed."
  }
}

check "b7_preview_datastore_boundary" {
  assert {
    condition = var.b7_foundation_phase < 2 ? true : (
      google_firestore_database.preview[0].project == "rentchain-preview" &&
      google_firestore_database.preview[0].name == "(default)" &&
      google_firestore_database.preview[0].location_id == "northamerica-northeast1" &&
      google_firestore_database.preview[0].type == "FIRESTORE_NATIVE" &&
      google_firestore_database.preview[0].delete_protection_state == "DELETE_PROTECTION_ENABLED" &&
      google_firestore_database.preview[0].deletion_policy == "ABANDON"
    )
    error_message = "B7 Firestore must remain the protected Native-mode default database in the isolated Montreal Preview project."
  }

  assert {
    condition = local.preview_runtime_firestore_permissions == toset([
      "datastore.databases.get",
      "datastore.entities.create",
      "datastore.entities.get",
      "datastore.entities.list",
      "datastore.entities.update",
    ])
    error_message = "B7 Preview runtime Firestore permissions changed outside the exact data-plane set."
  }

  assert {
    condition = var.b7_foundation_phase < 3 ? true : (
      google_project_iam_custom_role.preview_runtime_firestore[0].role_id == "previewBackendFirestoreRuntime" &&
      google_project_iam_member.preview_runtime_firestore[0].member == google_service_account.preview_backend_runtime.member &&
      google_project_iam_member.preview_runtime_firestore[0].condition[0].expression == "resource.name == 'projects/rentchain-preview/databases/(default)'"
    )
    error_message = "B7 Firestore access must remain bound only to the Preview runtime identity and default Preview database."
  }
}

check "b7_preview_authentication_boundary" {
  assert {
    condition = var.b7_foundation_phase < 2 || var.b7_phase2_recovery_stage < 2 || !var.b7_identity_platform_initialization ? true : (
      google_identity_platform_config.preview[0].project == "rentchain-preview" &&
      local.preview_identity_authorized_domains == toset(["localhost"]) &&
      google_identity_platform_config.preview[0].sign_in[0].email[0].enabled &&
      google_identity_platform_config.preview[0].sign_in[0].email[0].password_required &&
      !google_identity_platform_config.preview[0].sign_in[0].anonymous[0].enabled &&
      !google_identity_platform_config.preview[0].sign_in[0].phone_number[0].enabled &&
      !google_identity_platform_config.preview[0].client[0].permissions[0].disabled_user_signup &&
      google_identity_platform_config.preview[0].client[0].permissions[0].disabled_user_deletion &&
      !google_identity_platform_config.preview[0].multi_tenant[0].allow_tenants &&
      google_identity_platform_config.preview[0].multi_tenant[0].default_tenant_location == ""
    )
    error_message = "B7 Preview authentication must remain isolated, password-only, single-tenant, open to client signup, and closed to client deletion."
  }

  assert {
    condition = var.b7_foundation_phase < 2 ? true : (
      local.preview_runtime_auth_permissions == toset(["firebaseauth.users.get"]) &&
      google_project_iam_custom_role.preview_runtime_auth_reader[0].role_id == "previewBackendAuthReader" &&
      google_project_iam_member.preview_runtime_auth_reader[0].member == google_service_account.preview_backend_runtime.member
    )
    error_message = "B7 Preview authentication runtime access must remain a single user-read permission for the exact runtime identity."
  }

  assert {
    condition = var.b7_foundation_phase < 2 || var.b7_phase2_recovery_stage < 2 || !var.b7_restricted_api_key_activation ? true : (
      google_apikeys_key.preview_backend_auth[0].project == "rentchain-preview" &&
      google_apikeys_key.preview_backend_auth[0].restrictions[0].api_targets[0].service == "identitytoolkit.googleapis.com"
    )
    error_message = "The Preview backend API key must remain isolated and restricted to Identity Toolkit."
  }
}

check "b7_firebase_project_ownership_boundary" {
  assert {
    condition = (
      google_firebase_project.preview.project == "rentchain-preview" &&
      var.b7_identity_platform_initialization
    )
    error_message = "B7 Firebase ownership must remain limited to the existing Preview project."
  }
}

check "b7_backend_auth_secret_boundary" {
  assert {
    condition = var.b7_foundation_phase < 2 || var.b7_phase2_recovery_stage < 2 || !var.b7_restricted_api_key_activation ? true : (
      google_secret_manager_secret.preview_backend_identity_toolkit[0].project == "rentchain-preview" &&
      google_secret_manager_secret.preview_backend_identity_toolkit[0].secret_id == "preview-backend-identity-toolkit-api-key" &&
      google_secret_manager_secret.preview_backend_identity_toolkit[0].deletion_protection &&
      google_secret_manager_secret_version.preview_backend_identity_toolkit[0].secret_data_wo_version == 1 &&
      google_secret_manager_secret_version.preview_backend_identity_toolkit[0].deletion_policy == "DISABLE" &&
      google_secret_manager_secret_iam_member.preview_backend_identity_toolkit_accessor[0].secret_id == google_secret_manager_secret.preview_backend_identity_toolkit[0].id &&
      google_secret_manager_secret_iam_member.preview_backend_identity_toolkit_accessor[0].role == "roles/secretmanager.secretAccessor" &&
      google_secret_manager_secret_iam_member.preview_backend_identity_toolkit_accessor[0].member == google_service_account.preview_backend_runtime.member
    )
    error_message = "The Preview backend Identity Toolkit key and runtime accessor must remain in the exact protected secret-level boundary."
  }
}

check "b7_preview_backend_auth_secret_injection_boundary" {
  assert {
    condition = var.enable_preview_backend_service ? (
      length([
        for env in google_cloud_run_v2_service.preview_backend[0].template[0].containers[0].env : env
        if env.name == "FIREBASE_API_KEY"
      ]) == 1 &&
      one([
        for env in google_cloud_run_v2_service.preview_backend[0].template[0].containers[0].env : env
        if env.name == "FIREBASE_API_KEY"
      ]).value_source[0].secret_key_ref[0].secret == google_secret_manager_secret.preview_backend_identity_toolkit[0].secret_id &&
      one([
        for env in google_cloud_run_v2_service.preview_backend[0].template[0].containers[0].env : env
        if env.name == "FIREBASE_API_KEY"
      ]).value_source[0].secret_key_ref[0].version == "1" &&
      one([
        for env in google_cloud_run_v2_service.preview_backend[0].template[0].containers[0].env : env
        if env.name == "FIRESTORE_ENABLED"
      ]).value == "false"
    ) : true
    error_message = "The Preview backend must receive only explicit version 1 of the governed Identity Toolkit secret while Firestore remains disabled."
  }
}

check "b7_hcp_bootstrap_iam_boundary" {
  assert {
    condition = (
      google_project_iam_custom_role.hcp_terraform_preview_b7_reader.project == "rentchain-preview" &&
      google_project_iam_custom_role.hcp_terraform_preview_b7_reader.role_id == "hcpTerraformPreviewB7Reader" &&
      local.hcp_terraform_preview_b7_reader_permissions == toset([
        "apikeys.keys.get",
        "apikeys.keys.getKeyString",
        "datastore.databases.getMetadata",
        "firebase.projects.get",
        "firebaseauth.configs.get",
        "iam.serviceAccounts.get",
        "iam.serviceAccounts.getIamPolicy",
        "iam.workloadIdentityPoolProviders.get",
        "iam.workloadIdentityPools.get",
        "secretmanager.secrets.get",
        "secretmanager.secrets.getIamPolicy",
        "secretmanager.versions.get",
        "serviceusage.services.use",
      ]) &&
      google_project_iam_member.hcp_terraform_preview_b7_reader.member == local.hcp_terraform_plan_member
    )
    error_message = "The B7 plan reader must remain the exact thirteen-permission role bound only to the HCP plan identity."
  }

  assert {
    condition = (
      google_project_iam_custom_role.terraform_preview_b7_manager.project == "rentchain-preview" &&
      google_project_iam_custom_role.terraform_preview_b7_manager.role_id == "terraformPreviewB7Manager" &&
      local.terraform_preview_b7_manager_base_permissions == toset([
        "apikeys.keys.create",
        "apikeys.keys.get",
        "apikeys.keys.getKeyString",
        "datastore.databases.create",
        "datastore.databases.getMetadata",
        "firebase.projects.get",
        "firebaseauth.configs.create",
        "firebaseauth.configs.get",
        "firebaseauth.configs.update",
        "secretmanager.secrets.create",
        "secretmanager.secrets.get",
        "secretmanager.secrets.getIamPolicy",
        "secretmanager.secrets.setIamPolicy",
        "secretmanager.versions.add",
        "secretmanager.versions.get",
        "serviceusage.services.use",
      ]) &&
      local.terraform_preview_b7_manager_permissions == setunion(
        local.terraform_preview_b7_manager_base_permissions,
        var.b7_phase2_recovery_stage >= 2 ? toset(["firebase.projects.update"]) : toset([]),
      ) &&
      google_project_iam_member.terraform_preview_b7_manager.member == local.hcp_terraform_apply_member
    )
    error_message = "The B7 apply manager must remain at sixteen permissions in recovery stage 1 and add only firebase.projects.update in stage 2."
  }

  assert {
    condition = (
      google_project_iam_custom_role.terraform_preview_custom_role_updater.project == "rentchain-preview" &&
      google_project_iam_custom_role.terraform_preview_custom_role_updater.role_id == "terraformPreviewCustomRoleUpdater" &&
      local.terraform_preview_custom_role_updater_permissions == toset(["iam.roles.update"]) &&
      google_project_iam_member.terraform_preview_custom_role_updater.member == local.hcp_terraform_apply_member
    )
    error_message = "The B7 recovery updater must remain the exact one-permission project role bound only to the HCP apply identity."
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
        "run.services.getIamPolicy",
        "run.services.setIamPolicy",
        "run.services.update",
      ])
    )
    error_message = "The Cloud Run deployer role must remain Preview-scoped with only the governed service lifecycle and IAM-policy permissions."
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

check "b6_cloud_run_plan_viewer_iam_boundary" {
  assert {
    condition = (
      google_project_iam_custom_role.terraform_preview_cloud_run_viewer.project == "rentchain-preview" &&
      google_project_iam_custom_role.terraform_preview_cloud_run_viewer.role_id == "hcpTerraformPreviewCloudRunViewer" &&
      local.terraform_preview_cloud_run_viewer_permissions == toset([
        "run.services.get",
        "run.services.getIamPolicy",
      ]) &&
      google_project_iam_member.terraform_preview_cloud_run_viewer.project == "rentchain-preview" &&
      google_project_iam_member.terraform_preview_cloud_run_viewer.member == local.hcp_terraform_plan_member &&
      local.hcp_terraform_plan_member == "serviceAccount:hcp-terraform-preview@rentchain-preview.iam.gserviceaccount.com"
    )
    error_message = "The Cloud Run plan viewer must remain an exact two-permission Preview-only binding for the HCP plan identity."
  }
}

check "b6_preview_artifact_reader_boundary" {
  assert {
    condition = (
      google_project_iam_custom_role.terraform_preview_artifact_reader.project == "rentchain-preview" &&
      google_project_iam_custom_role.terraform_preview_artifact_reader.role_id == "terraformPreviewArtifactReader" &&
      local.terraform_preview_artifact_reader_permissions == toset([
        "artifactregistry.repositories.downloadArtifacts",
      ]) &&
      google_artifact_registry_repository_iam_member.terraform_preview_artifact_reader.repository == "projects/${var.project_id}/locations/${google_artifact_registry_repository.preview_backend.location}/repositories/${google_artifact_registry_repository.preview_backend.repository_id}" &&
      google_artifact_registry_repository_iam_member.terraform_preview_artifact_reader.member == local.terraform_preview_artifact_reader_member
    )
    error_message = "Preview Terraform image access must remain a single-permission repository-scoped binding for the exact HCP apply identity."
  }
}

check "f1_hcp_storage_control_plane_boundary" {
  assert {
    condition = (
      google_project_iam_custom_role.hcp_terraform_preview_storage_reader.project == "rentchain-preview" &&
      google_project_iam_custom_role.hcp_terraform_preview_storage_reader.role_id == "hcpTerraformPreviewStorageReader" &&
      local.hcp_terraform_preview_storage_reader_permissions == toset([
        "storage.buckets.get",
        "storage.buckets.getIamPolicy",
      ]) &&
      google_project_iam_member.hcp_terraform_preview_storage_reader.member == local.hcp_terraform_plan_member
    )
    error_message = "The HCP plan identity must retain exactly the two approved Preview bucket read permissions."
  }

  assert {
    condition = (
      google_project_iam_custom_role.terraform_preview_storage_manager.project == "rentchain-preview" &&
      google_project_iam_custom_role.terraform_preview_storage_manager.role_id == "terraformPreviewStorageManager" &&
      local.terraform_preview_storage_manager_permissions == toset([
        "storage.buckets.create",
        "storage.buckets.get",
        "storage.buckets.getIamPolicy",
        "storage.buckets.setIamPolicy",
        "storage.buckets.update",
      ]) &&
      google_project_iam_member.terraform_preview_storage_manager.member == local.hcp_terraform_apply_member
    )
    error_message = "The HCP apply identity must retain exactly the five approved Preview bucket control-plane permissions."
  }

  assert {
    condition = (
      !contains(local.hcp_terraform_preview_storage_reader_permissions, "storage.buckets.delete") &&
      !contains(local.terraform_preview_storage_manager_permissions, "storage.buckets.delete") &&
      length([for permission in local.hcp_terraform_preview_storage_reader_permissions : permission if startswith(permission, "storage.objects.")]) == 0 &&
      length([for permission in local.terraform_preview_storage_manager_permissions : permission if startswith(permission, "storage.objects.")]) == 0
    )
    error_message = "The HCP Storage bootstrap must exclude bucket delete and all object-data permissions."
  }
}

check "f1_preview_attachment_storage_boundary" {
  assert {
    condition = (
      google_storage_bucket.preview_attachments.project == "rentchain-preview" &&
      google_storage_bucket.preview_attachments.name == "rentchain-preview-attachments" &&
      lower(google_storage_bucket.preview_attachments.location) == "northamerica-northeast1" &&
      google_storage_bucket.preview_attachments.public_access_prevention == "enforced" &&
      google_storage_bucket.preview_attachments.uniform_bucket_level_access &&
      !google_storage_bucket.preview_attachments.force_destroy
    )
    error_message = "The F1 attachment bucket must remain private, non-destructive, and isolated in the Montreal Preview project."
  }

  assert {
    condition = (
      google_project_iam_custom_role.preview_attachment_object_runtime.project == "rentchain-preview" &&
      google_project_iam_custom_role.preview_attachment_object_runtime.role_id == "previewAttachmentObjectRuntime" &&
      local.preview_attachment_object_permissions == toset([
        "storage.objects.create",
        "storage.objects.delete",
        "storage.objects.get",
      ]) &&
      google_storage_bucket_iam_member.preview_attachment_runtime.bucket == google_storage_bucket.preview_attachments.name &&
      google_storage_bucket_iam_member.preview_attachment_runtime.member == google_service_account.preview_backend_runtime.member
    )
    error_message = "Preview attachment object access must remain exact, bucket-scoped, and limited to the Preview runtime identity."
  }

  assert {
    condition = (
      google_service_account_iam_member.preview_runtime_self_token_creator.service_account_id == google_service_account.preview_backend_runtime.name &&
      google_service_account_iam_member.preview_runtime_self_token_creator.role == "roles/iam.serviceAccountTokenCreator" &&
      google_service_account_iam_member.preview_runtime_self_token_creator.member == google_service_account.preview_backend_runtime.member
    )
    error_message = "Preview keyless signing must remain a self-member-only binding on the exact runtime service account."
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

check "b7_vercel_preview_proxy_identity_boundary" {
  assert {
    condition = (
      google_iam_workload_identity_pool.vercel_preview_proxy.project == "rentchain-preview" &&
      google_iam_workload_identity_pool.vercel_preview_proxy.workload_identity_pool_id == "vercel-preview-proxy" &&
      google_iam_workload_identity_pool_provider.vercel_preview.workload_identity_pool_provider_id == "vercel-preview" &&
      google_iam_workload_identity_pool_provider.vercel_preview.oidc[0].issuer_uri == "https://oidc.vercel.com/rent-chain" &&
      length(google_iam_workload_identity_pool_provider.vercel_preview.attribute_mapping) == 4 &&
      google_iam_workload_identity_pool_provider.vercel_preview.attribute_mapping["google.subject"] == "assertion.sub" &&
      google_iam_workload_identity_pool_provider.vercel_preview.attribute_mapping["attribute.owner_id"] == "assertion.owner_id" &&
      google_iam_workload_identity_pool_provider.vercel_preview.attribute_mapping["attribute.project_id"] == "assertion.project_id" &&
      google_iam_workload_identity_pool_provider.vercel_preview.attribute_mapping["attribute.environment"] == "assertion.environment" &&
      local.vercel_preview_provider_condition == "assertion.owner_id == 'team_NMg7i76JKz4ZwSJ07GYmZZYx' && assertion.project_id == 'prj_YN5ecHjXdwE3cp76pivyAf2BKX5I' && assertion.environment == 'preview' && assertion.sub == 'owner:rent-chain:project:rentchain:environment:preview'"
    )
    error_message = "The Vercel Preview pool, provider, issuer, mappings, or exact trust condition changed."
  }

  assert {
    condition = (
      local.vercel_preview_federated_member == "principal://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/vercel-preview-proxy/subject/owner:rent-chain:project:rentchain:environment:preview" &&
      google_service_account.vercel_preview_proxy.project == "rentchain-preview" &&
      google_service_account.vercel_preview_proxy.account_id == "vercel-preview-proxy" &&
      google_service_account_iam_member.vercel_preview_proxy_workload_identity_user.role == "roles/iam.workloadIdentityUser" &&
      google_service_account_iam_member.vercel_preview_proxy_workload_identity_user.member == local.vercel_preview_federated_member &&
      google_service_account_iam_member.vercel_preview_proxy_openid_token_creator.role == "roles/iam.serviceAccountOpenIdTokenCreator" &&
      google_service_account_iam_member.vercel_preview_proxy_openid_token_creator.member == local.vercel_preview_federated_member
    )
    error_message = "The Vercel Preview proxy service account or its exact-subject federation bindings changed."
  }

  assert {
    condition = (
      google_cloud_run_v2_service_iam_member.vercel_preview_proxy_invoker.project == "rentchain-preview" &&
      google_cloud_run_v2_service_iam_member.vercel_preview_proxy_invoker.location == "northamerica-northeast1" &&
      basename(
        google_cloud_run_v2_service_iam_member.vercel_preview_proxy_invoker.name
      ) == "rentchain-preview-backend" &&
      google_cloud_run_v2_service_iam_member.vercel_preview_proxy_invoker.role == "roles/run.invoker" &&
      google_cloud_run_v2_service_iam_member.vercel_preview_proxy_invoker.member == "serviceAccount:vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com"
    )
    error_message = "Run Invoker must remain service-scoped to the private Preview backend and dedicated Vercel proxy identity."
  }
}
