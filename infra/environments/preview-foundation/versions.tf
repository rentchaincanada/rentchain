terraform {
  required_version = "= 1.15.8"

  cloud {
    organization = "Rentchain"

    workspaces {
      name = "rentchain-preview-foundation"
    }
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
