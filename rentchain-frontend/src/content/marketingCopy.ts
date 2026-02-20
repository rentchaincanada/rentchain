export type Locale = "en" | "fr";

type TierKey = "free" | "starter" | "pro" | "elite";

type HomeCopy = {
  heroTitle: string;
  heroSubtitle: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  pricingCta: string;
  requestAccessCta: string;
  authedPrimaryCta: string;
};

type PricingFeatureGroup = {
  title: string;
  items: Record<TierKey, string>;
  note?: string;
};

type PricingCopy = {
  headline: string;
  subheadline: string;
  intervalLabels: {
    monthly: string;
    yearly: string;
  };
  tierLabels: Record<TierKey, string>;
  tierTaglines: Record<TierKey, string>;
  tierBadges: Partial<Record<TierKey, string>>;
  ctaStartFree: string;
  ctaUpgrade: string;
  comparisonTitle: string;
  capabilityTitle: string;
  featureGroups: PricingFeatureGroup[];
  screeningRow: {
    label: string;
    subtext: string;
    values: Record<TierKey, string>;
  };
  faqTitle: string;
  faqQuestion: string;
  faqAnswer: string;
};

type AboutCopy = {
  headline: string;
  story: string;
  bulletsTitle: string;
  bullets: string[];
};

type LegalCopy = {
  headline: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
  policyTitle: string;
  policyTerms: string;
  policyPrivacy: string;
  policyAcceptableUse: string;
  assistanceTitle: string;
};

type Testimonial = {
  quote: string;
  author: string;
  role: string;
};

type TrustCopy = {
  testimonialsTitle: string;
  testimonialsSubtitle: string;
  testimonials: Testimonial[];
  credibilityLine: string;
};

export type MarketingCopy = {
  home: HomeCopy;
  pricing: PricingCopy;
  about: AboutCopy;
  legal: LegalCopy;
  trust: TrustCopy;
};

export const marketingCopy: Record<Locale, MarketingCopy> = {
  en: {
    home: {
      heroTitle: "Modern landlord command center",
      heroSubtitle: "Built for Canadian rental operations with clear records and faster decisions.",
      bullets: [
        "Track properties, units, tenants, and notices in one place.",
        "Keep an organized ledger and export-ready records.",
        "Run a consistent workflow from first contact to renewal.",
      ],
      primaryCta: "Sign up (Free)",
      secondaryCta: "Sign in",
      pricingCta: "See pricing",
      requestAccessCta: "Request access",
      authedPrimaryCta: "Go to dashboard",
    },
    pricing: {
      headline: "Straightforward plans for Canadian landlords",
      subheadline: "Start free, upgrade when your portfolio needs deeper workflow and reporting.",
      intervalLabels: {
        monthly: "Monthly",
        yearly: "Annual",
      },
      tierLabels: {
        free: "Free",
        starter: "Starter",
        pro: "Pro",
        elite: "Elite",
      },
      tierTaglines: {
        free: "Best for trying the core workflow",
        starter: "Best for active landlords managing day-to-day operations",
        pro: "Best for growing portfolios that need stronger controls",
        elite: "Best for teams that need audit-ready visibility",
      },
      tierBadges: {
        pro: "Most Popular",
      },
      ctaStartFree: "Start Free",
      ctaUpgrade: "Upgrade",
      comparisonTitle: "Plan comparison",
      capabilityTitle: "Capability",
      featureGroups: [
        {
          title: "Core",
          items: {
            free: "Properties and units",
            starter: "Properties and units",
            pro: "Properties and units",
            elite: "Properties and units",
          },
        },
        {
          title: "Tenant workflow",
          items: {
            free: "Manual entry",
            starter: "Invites and messaging",
            pro: "Invites and messaging",
            elite: "Invites and messaging",
          },
        },
        {
          title: "Ledger and exports",
          items: {
            free: "Basic records",
            starter: "Basic ledger",
            pro: "Verified ledger and exports",
            elite: "Advanced exports and audit logs",
          },
        },
        {
          title: "Insights",
          items: {
            free: "Basic view",
            starter: "Basic view",
            pro: "Portfolio dashboard",
            elite: "Portfolio analytics",
          },
        },
      ],
      screeningRow: {
        label: "Credit Screening",
        subtext: "Coming soon",
        values: {
          free: "Coming soon",
          starter: "Coming soon",
          pro: "Coming soon",
          elite: "Coming soon",
        },
      },
      faqTitle: "FAQ",
      faqQuestion: "Do I need a subscription to screen tenants?",
      faqAnswer: "No. Screening will be available as pay-per-use when released.",
    },
    about: {
      headline: "Built for clarity in Canadian renting",
      story:
        "RentChain gives landlords and tenants a shared operating record for the full rental lifecycle. Applications, notices, payments, and lease events stay structured, timestamped, and easy to review.",
      bulletsTitle: "What this means in practice",
      bullets: [
        "Designed for independent landlords and growing portfolios across Canada.",
        "Focused on documentation quality, consistency, and accountability.",
        "Built to reduce friction by keeping everyone aligned on the same facts.",
      ],
    },
    legal: {
      headline: "Legal",
      intro:
        "RentChain provides software workflows and records support; users remain responsible for legal compliance in their province or territory.",
      sections: [
        {
          title: "Privacy and data handling",
          body:
            "Personal information is collected and processed for defined rental operations, with access controls and documented use.",
        },
        {
          title: "Consent and transparency",
          body:
            "Sensitive actions require clear notice, and consent is collected where required by applicable law.",
        },
        {
          title: "Platform responsibility",
          body:
            "RentChain provides infrastructure and workflows. Users remain responsible for their decisions and compliance duties.",
        },
      ],
      policyTitle: "Policies",
      policyTerms: "Terms of Service",
      policyPrivacy: "Privacy Policy",
      policyAcceptableUse: "Acceptable Use Policy",
      assistanceTitle: "Need assistance",
    },
    trust: {
      testimonialsTitle: "Trusted by landlords across Canada",
      testimonialsSubtitle: "Operators use RentChain to keep portfolios organized, responsive, and accountable.",
      testimonials: [
        {
          quote: "Before RentChain, we tracked everything in separate tools. Now our tenant workflow is finally in one place.",
          author: "Sarah M.",
          role: "Independent landlord, Ontario",
        },
        {
          quote: "The ledger and exports save our team hours every month and keep records ready when we need them.",
          author: "Daniel R.",
          role: "Portfolio manager, Alberta",
        },
        {
          quote: "We reduced back-and-forth with tenants because messages, notices, and documents are easier to follow.",
          author: "Amira L.",
          role: "Property operator, Quebec",
        },
      ],
      credibilityLine: "Built by a 20+ year property manager.",
    },
  },
  fr: {
    home: {
      heroTitle: "Centre de commande moderne pour proprietaires",
      heroSubtitle:
        "Concu pour les operations locatives canadiennes avec des dossiers clairs et des decisions plus rapides.",
      bullets: [
        "Suivez proprietes, unites, locataires et avis au meme endroit.",
        "Conservez un registre organise et des exports prets a l'usage.",
        "Appliquez un flux constant du premier contact au renouvellement.",
      ],
      primaryCta: "Inscription (Gratuit)",
      secondaryCta: "Connexion",
      pricingCta: "Voir les tarifs",
      requestAccessCta: "Demander l'acces",
      authedPrimaryCta: "Aller au tableau de bord",
    },
    pricing: {
      headline: "Forfaits clairs pour proprietaires canadiens",
      subheadline:
        "Commencez gratuitement, puis passez a un forfait superieur lorsque votre portefeuille demande plus d'outils.",
      intervalLabels: {
        monthly: "Mensuel",
        yearly: "Annuel",
      },
      tierLabels: {
        free: "Gratuit",
        starter: "Starter",
        pro: "Pro",
        elite: "Elite",
      },
      tierTaglines: {
        free: "Ideal pour essayer le flux principal",
        starter: "Ideal pour les proprietaires actifs au quotidien",
        pro: "Ideal pour les portefeuilles en croissance",
        elite: "Ideal pour les equipes qui veulent une vue complete",
      },
      tierBadges: {
        pro: "Le plus choisi",
      },
      ctaStartFree: "Commencer gratuitement",
      ctaUpgrade: "Mettre a niveau",
      comparisonTitle: "Comparaison des forfaits",
      capabilityTitle: "Capacite",
      featureGroups: [
        {
          title: "Base",
          items: {
            free: "Proprietes et unites",
            starter: "Proprietes et unites",
            pro: "Proprietes et unites",
            elite: "Proprietes et unites",
          },
        },
        {
          title: "Flux locataire",
          items: {
            free: "Saisie manuelle",
            starter: "Invitations et messagerie",
            pro: "Invitations et messagerie",
            elite: "Invitations et messagerie",
          },
        },
        {
          title: "Registre et exports",
          items: {
            free: "Dossiers de base",
            starter: "Registre de base",
            pro: "Registre verifie et exports",
            elite: "Exports avances et journaux d'audit",
          },
        },
        {
          title: "Analytique",
          items: {
            free: "Vue de base",
            starter: "Vue de base",
            pro: "Tableau de bord portefeuille",
            elite: "Analytique portefeuille",
          },
        },
      ],
      screeningRow: {
        label: "Verification de credit",
        subtext: "Bientot disponible",
        values: {
          free: "Bientot disponible",
          starter: "Bientot disponible",
          pro: "Bientot disponible",
          elite: "Bientot disponible",
        },
      },
      faqTitle: "FAQ",
      faqQuestion: "Ai-je besoin d'un abonnement pour verifier des locataires?",
      faqAnswer: "Non. La verification sera offerte a l'usage lors du lancement.",
    },
    about: {
      headline: "Concu pour la clarte dans la location au Canada",
      story:
        "RentChain donne aux proprietaires et aux locataires un dossier operationnel partage pour tout le cycle locatif. Candidatures, avis, paiements et evenements de bail restent structures, horodates et faciles a verifier.",
      bulletsTitle: "Ce que cela change au quotidien",
      bullets: [
        "Pense pour les proprietaires independants et les portefeuilles en croissance au Canada.",
        "Centre sur la qualite documentaire, la constance et la responsabilite.",
        "Concu pour reduire les frictions avec les memes faits pour tous.",
      ],
    },
    legal: {
      headline: "Juridique",
      intro:
        "RentChain fournit des flux logiciels et un soutien documentaire; les utilisateurs demeurent responsables de la conformite legale dans leur province ou territoire.",
      sections: [
        {
          title: "Confidentialite et traitement des donnees",
          body:
            "Les renseignements personnels sont collectes et traites pour des operations locatives definies, avec controles d'acces et usage documente.",
        },
        {
          title: "Consentement et transparence",
          body:
            "Les actions sensibles exigent un avis clair, et le consentement est recueilli lorsque la loi l'exige.",
        },
        {
          title: "Responsabilite de la plateforme",
          body:
            "RentChain fournit l'infrastructure et les flux. Les utilisateurs demeurent responsables de leurs decisions et obligations de conformite.",
        },
      ],
      policyTitle: "Politiques",
      policyTerms: "Conditions d'utilisation",
      policyPrivacy: "Politique de confidentialite",
      policyAcceptableUse: "Politique d'utilisation acceptable",
      assistanceTitle: "Besoin d'aide",
    },
    trust: {
      testimonialsTitle: "Des proprietaires partout au Canada nous font confiance",
      testimonialsSubtitle:
        "Les exploitants utilisent RentChain pour garder leurs portefeuilles organises, reactifs et responsables.",
      testimonials: [
        {
          quote:
            "Avant RentChain, nous suivions tout dans des outils separes. Maintenant, notre flux locataire est enfin centralise.",
          author: "Sarah M.",
          role: "Proprietaire independante, Ontario",
        },
        {
          quote:
            "Le registre et les exports nous font gagner des heures chaque mois et gardent les dossiers prets en tout temps.",
          author: "Daniel R.",
          role: "Gestionnaire de portefeuille, Alberta",
        },
        {
          quote:
            "Nous avons reduit les allers-retours avec les locataires car messages, avis et documents sont plus faciles a suivre.",
          author: "Amira L.",
          role: "Operatrice immobiliere, Quebec",
        },
      ],
      credibilityLine: "Cree par un gestionnaire immobilier avec plus de 20 ans d'experience.",
    },
  },
};
