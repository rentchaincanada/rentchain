variable "project_id" {
  description = "Immutable Google Cloud project ID for the isolated Preview foundation."
  type        = string
  nullable    = false

  validation {
    condition     = var.project_id == "rentchain-preview"
    error_message = "project_id must be the approved isolated Preview project: rentchain-preview."
  }

  validation {
    condition     = var.project_id != "project-0d9658de-af29-4dc0-a99"
    error_message = "The production project ID is prohibited in the Preview foundation root."
  }
}

variable "project_number" {
  description = "Immutable project number used to cross-check the approved Preview target."
  type        = string
  nullable    = false

  validation {
    condition     = var.project_number == "501298948635"
    error_message = "project_number must match the approved RentChain Preview project."
  }
}

variable "environment" {
  description = "Environment classification for this isolated foundation."
  type        = string
  nullable    = false

  validation {
    condition     = var.environment == "preview"
    error_message = "environment must be preview. Production and unspecified environments are prohibited."
  }
}

variable "baseline_labels" {
  description = "Approved B1 project labels recorded for drift comparison; this root does not mutate project labels."
  type        = map(string)
  nullable    = false

  validation {
    condition = var.baseline_labels == tomap({
      environment = "preview"
      lifecycle   = "permanent"
      managed-by  = "terraform"
      owner       = "founder"
      platform    = "rentchain"
      purpose     = "shared-preview"
    })
    error_message = "baseline_labels must exactly match the approved B1 Preview label set."
  }
}

variable "monthly_planning_ceiling_cad" {
  description = "Approved B1 monthly planning ceiling reference; this root does not manage billing or budgets."
  type        = number
  nullable    = false

  validation {
    condition     = var.monthly_planning_ceiling_cad == 100
    error_message = "monthly_planning_ceiling_cad must remain CAD 100."
  }
}
