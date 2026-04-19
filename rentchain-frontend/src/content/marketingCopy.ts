export type Locale = "en" | "fr";

type TierKey = "free" | "starter" | "pro" | "elite";

type HomeCopy = {
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  bullets: string[];
  pillars: Array<{ title: string; body: string }>;
  workflowTitle: string;
  workflowSteps: string[];
  closingTitle: string;
  closingBody: string;
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
  ctaByTier?: Partial<Record<TierKey, string>>;
  comparisonTitle: string;
  capabilityTitle: string;
  featureGroups: PricingFeatureGroup[];
  timelineSection: {
    title: string;
    description: string;
    bullets: string[];
    proofLine: string;
  };
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
      eyebrow: "Guided landlord operations",
      heroTitle: "Guide your first applicant from setup to screening review",
      heroSubtitle:
        "RentChain helps landlords move from property setup to viewings, screening requests, and decision support without juggling separate tools.",
      bullets: [
        "Set up properties, units, applicants, and viewings with a guided activation flow.",
        "Connect TransUnion, request screening, and review results through a clear status workflow.",
        "Track expenses, archive sold properties, and export cleaner records when your portfolio grows.",
      ],
      pillars: [
        {
          title: "Guided onboarding",
          body: "New landlords get a clear activation path from first login to first applicant review.",
        },
        {
          title: "Screening workflow + decision support",
          body: "Use a guided TransUnion connection flow, request screening, follow status updates, and review clearer risk insights.",
        },
        {
          title: "Property operations",
          body: "Manage properties, units, applicants, viewings, and archived portfolio history in one place.",
        },
        {
          title: "Expenses and accountant-ready reporting",
          body: "Track expenses now on Free, then upgrade for CSV import and cleaner exports for your accountant.",
        },
      ],
      workflowTitle: "How landlords get to a first decision",
      workflowSteps: [
        "Add your first property and unit",
        "Invite or add an applicant",
        "Coordinate a viewing and confirm readiness",
        "Connect TransUnion and request screening",
        "Review a high-trust screening result and make your decision",
      ],
      closingTitle: "Built for real rental operations, not vague promises",
      closingBody:
        "RentChain is strongest when you want a guided workflow, clear records, and honest upgrade paths. Premium automation is positioned carefully, while today’s operational tools stay grounded in what the platform already delivers.",
      primaryCta: "Sign up (Free)",
      secondaryCta: "Sign in",
      pricingCta: "See pricing",
      requestAccessCta: "Request access",
      authedPrimaryCta: "Go to dashboard",
    },
    pricing: {
      headline: "Start using RentChain before you worry about plans",
      subheadline:
        "Start on Free with guided setup, your first property, and the core rental workflow. Upgrade later if you need deeper operational tools, exports, and reporting.",
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
        free: "Best for guided setup, manual workflows, and pay-per-use screening",
        starter: "Best for active landlords coordinating applicants and day-to-day operations",
        pro: "Best for growing portfolios that need exports, reporting, and team workflows",
        elite: "Best for premium visibility, analytics, and audit-ready operations",
      },
      tierBadges: {
        pro: "Most Popular",
      },
      ctaStartFree: "Start your rental workflow",
      ctaUpgrade: "Upgrade",
      ctaByTier: {
        starter: "Upgrade to Starter",
        pro: "Upgrade to Pro",
        elite: "Upgrade to Elite",
      },
      comparisonTitle: "Plan comparison",
      capabilityTitle: "Capability",
      featureGroups: [
        {
          title: "Portfolio setup",
          items: {
            free: "Properties, units, archive support",
            starter: "Portfolio + tenant operations",
            pro: "Full portfolio workflows",
            elite: "Full portfolio workflows",
          },
        },
        {
          title: "Guided onboarding",
          items: {
            free: "Activation flow",
            starter: "Activation flow",
            pro: "Activation flow",
            elite: "Activation flow",
          },
        },
        {
          title: "Applicant workflow",
          items: {
            free: "Manual applicants + viewings",
            starter: "Invites, linked apps, messaging",
            pro: "Invites, linked apps, messaging",
            elite: "Invites, linked apps, messaging",
          },
        },
        {
          title: "Expenses",
          items: {
            free: "Manual tracking",
            starter: "Manual tracking",
            pro: "CSV import + export workflows",
            elite: "Advanced export workflows",
          },
        },
        {
          title: "Reporting and insights",
          items: {
            free: "Basic dashboard",
            starter: "Workflow reporting",
            pro: "Exports, summaries, compliance",
            elite: "Advanced analytics + audit visibility",
          },
        },
      ],
      timelineSection: {
        title: "Operations visibility",
        description:
          "Paid plans expand visibility with stronger workflow reporting, cleaner exports, and a more complete operational record.",
        bullets: [
          "Workflow and screening progress visibility",
          "Cleaner records for reviews and reporting",
          "Property and applicant context in one place",
          "Export paths for stakeholders and accountants",
          "Analytics and audit visibility on Elite",
        ],
        proofLine: "Designed to add clarity without overpromising unsupported automation.",
      },
      screeningRow: {
        label: "Screening workflow",
        subtext: "Pay-per-use on every tier; paid plans add workflow and reporting depth",
        values: {
          free: "Guided setup + history",
          starter: "Request + status workflow",
          pro: "Summaries + reporting",
          elite: "Advanced reporting context",
        },
      },
      faqTitle: "FAQ",
      faqQuestion: "Do I need a subscription to screen tenants?",
      faqAnswer:
        "No. Screening is pay-per-use on every tier, with paid plans adding stronger workflow support, summaries, exports, and reporting around that process.",
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
      eyebrow: "Operations guidees pour proprietaires",
      heroTitle: "Passez de l'installation au premier examen d'un candidat",
      heroSubtitle:
        "RentChain aide les proprietaires a passer de la configuration des proprietes aux visites, aux demandes de verification et a l'aide a la decision sans multiplier les outils.",
      bullets: [
        "Configurez proprietes, unites, candidats et visites avec un parcours guide.",
        "Connectez TransUnion, lancez une demande de verification et suivez le statut jusqu'au resultat.",
        "Suivez les depenses, archivez les proprietes vendues et exportez des dossiers plus propres quand le portefeuille grandit.",
      ],
      pillars: [
        {
          title: "Integration guidee",
          body: "Les nouveaux proprietaires obtiennent un parcours clair du premier acces jusqu'au premier examen de dossier.",
        },
        {
          title: "Verification et aide a la decision",
          body: "Utilisez un parcours guide de connexion TransUnion, suivez les demandes de verification et consultez des signaux de risque plus clairs.",
        },
        {
          title: "Operations immobilieres",
          body: "Gerez proprietes, unites, candidats, visites et historique archive au meme endroit.",
        },
        {
          title: "Depenses et rapports pour comptable",
          body: "Suivez les depenses maintenant sur Gratuit, puis passez a Pro pour l'import CSV et les exports plus propres.",
        },
      ],
      workflowTitle: "Comment un proprietaire arrive a une premiere decision",
      workflowSteps: [
        "Ajoutez votre premiere propriete et unite",
        "Invitez ou ajoutez un candidat",
        "Coordonnez une visite et confirmez l'etat de preparation",
        "Connectez TransUnion et lancez la verification",
        "Consultez un resultat de verification clair et prenez votre decision",
      ],
      closingTitle: "Concu pour de vraies operations locatives",
      closingBody:
        "RentChain est plus fort lorsqu'il offre un flux guide, des dossiers clairs et des mises a niveau honnetes. L'automatisation premium reste presentee avec prudence, tandis que les outils d'aujourd'hui restent fondes sur ce qui existe vraiment.",
      primaryCta: "Inscription (Gratuit)",
      secondaryCta: "Connexion",
      pricingCta: "Voir les tarifs",
      requestAccessCta: "Demander l'acces",
      authedPrimaryCta: "Aller au tableau de bord",
    },
    pricing: {
      headline: "Une tarification alignee sur le produit actuel",
      subheadline:
        "Commencez sur Gratuit avec une configuration guidee et une verification a l'usage, puis passez a un forfait superieur pour plus d'outils, d'exports et de rapports.",
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
        free: "Ideal pour la configuration guidee, les flux manuels et la verification a l'usage",
        starter: "Ideal pour les proprietaires actifs qui coordonnent les candidats",
        pro: "Ideal pour les portefeuilles qui veulent exports, rapports et outils d'equipe",
        elite: "Ideal pour une visibilite premium, l'analytique et les audits",
      },
      tierBadges: {
        pro: "Le plus choisi",
      },
      ctaStartFree: "Commencer gratuitement",
      ctaUpgrade: "Mettre a niveau",
      ctaByTier: {
        starter: "Passer a Starter",
        pro: "Passer a Pro",
        elite: "Passer a Elite",
      },
      comparisonTitle: "Comparaison des forfaits",
      capabilityTitle: "Capacite",
      featureGroups: [
        {
          title: "Configuration du portefeuille",
          items: {
            free: "Proprietes, unites, archivage",
            starter: "Proprietes, unites, archivage",
            pro: "Proprietes, unites, archivage",
            elite: "Proprietes, unites, archivage",
          },
        },
        {
          title: "Integration guidee",
          items: {
            free: "Parcours d'activation",
            starter: "Parcours d'activation",
            pro: "Parcours d'activation",
            elite: "Parcours d'activation",
          },
        },
        {
          title: "Flux candidat",
          items: {
            free: "Candidats manuels + visites",
            starter: "Invitations, candidatures liees, messagerie",
            pro: "Invitations, candidatures liees, messagerie",
            elite: "Invitations, candidatures liees, messagerie",
          },
        },
        {
          title: "Depenses",
          items: {
            free: "Suivi manuel",
            starter: "Suivi manuel",
            pro: "Import CSV + exports",
            elite: "Exports et rapports avances",
          },
        },
        {
          title: "Rapports et insights",
          items: {
            free: "Tableau de bord de base",
            starter: "Rapports operationnels",
            pro: "Exports, resumes, conformite",
            elite: "Analytique avancee + visibilite d'audit",
          },
        },
      ],
      timelineSection: {
        title: "Visibilite operationnelle",
        description:
          "Les forfaits payants ajoutent plus de visibilite, des exports plus propres et un dossier operationnel plus complet.",
        bullets: [
          "Visibilite sur les flux et la verification",
          "Dossiers plus propres pour examens et rapports",
          "Contexte propriete et candidat au meme endroit",
          "Exports pour parties prenantes et comptables",
          "Analytique et visibilite d'audit sur Elite",
        ],
        proofLine: "Concu pour ajouter de la clarte sans promettre une automatisation non prise en charge.",
      },
      screeningRow: {
        label: "Flux de verification",
        subtext: "A l'usage sur tous les forfaits; les forfaits payants ajoutent plus de flux et de rapports",
        values: {
          free: "Parcours guide + historique",
          starter: "Demande + suivi du statut",
          pro: "Resumes + rapports",
          elite: "Contexte avance pour les rapports",
        },
      },
      faqTitle: "FAQ",
      faqQuestion: "Ai-je besoin d'un abonnement pour verifier des locataires?",
      faqAnswer:
        "Non. La verification est facturation a l'usage sur tous les forfaits, et les forfaits payants ajoutent plus de flux, de resumes, d'exports et de rapports.",
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
