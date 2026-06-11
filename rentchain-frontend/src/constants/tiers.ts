export const TIER_GUIDANCE_LINKS = {
  upgradeDocsUrl: "/pricing",
} as const;

export const FREE_TIER_UPGRADE_GUIDANCE = {
  freeLabel: "Free tier",
  starterLabel: "Starter",
  propertyCreate: {
    title: "Free tier keeps setup manual",
    body:
      "Free tier includes manual applicant intake and basic property management. Upgrade to Starter to send batch application invitations and enable tenant portals.",
    ctaLabel: "Learn more",
  },
  applications: {
    title: "Manual applicant intake stays available on Free",
    body:
      "Starter adds batch application invitations, screening workflow tools, and tenant portals when you are ready to move beyond manual intake.",
    ctaLabel: "Learn about Starter",
  },
  propertyOverview: {
    title: "Free tier property workflow",
    body:
      "Free tier supports manual applicant intake and basic property management. Starter adds batch application invitations, screening workflow tools, and tenant portals.",
    ctaLabel: "Upgrade to Starter",
  },
} as const;
