import { useEffect, useMemo, useState } from "react";

export type Locale = "en" | "fr";

const STORAGE_KEY = "rc_locale";

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.about": "About",
    "nav.pricing": "Pricing",
    "nav.legal": "Legal & Help",
    "nav.login": "Log in",
    "nav.request_access": "Request access",
    "nav.dashboard": "Dashboard",
    "nav.menu": "Menu",
    "nav.open_menu": "Open menu",
    "nav.close_menu": "Close menu",
    "footer.help_center": "Help Center",
    "footer.templates": "Templates",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "home.tagline": "Verified screening. Clear records. Trusted rental relationships.",
    "home.intro":
      "RentChain is a rental screening and management platform built to create transparency and accountability between landlords and tenants — through verified information and structured records.",
    "home.cta.dashboard": "Go to dashboard",
    "home.cta.request": "Request access",
    "home.cta.signin": "Sign in",
    "home.cta.pricing": "See pricing",
    "home.landlords.title": "For Landlords",
    "home.landlords.subtitle": "Make rental decisions with verified information — not guesswork.",
    "home.landlords.body":
      "RentChain helps landlords screen applicants, manage tenants, and maintain clear, defensible records throughout the rental lifecycle. From screening to lease events, everything is documented in a structured, time-stamped system designed to support better decisions and fewer disputes.",
    "home.landlords.footer":
      "Whether you manage one unit or a growing portfolio, RentChain gives you a system you can rely on.",
    "home.tenants.title": "For Tenants",
    "home.tenants.subtitle": "A rental process built on clarity and consent.",
    "home.tenants.body":
      "RentChain gives tenants a transparent way to participate in the rental process. Screening, lease events, and recorded interactions are handled clearly — without hidden scoring, informal judgments, or unclear records.",
    "home.tenants.footer": "Your information is handled with consent, accuracy, and respect for privacy.",
    "home.what.title": "What RentChain Does",
    "home.what.item1": "Tenant screening and verification",
    "home.what.item2": "Property, unit, and lease management",
    "home.what.item3": "Secure tenant invitations and onboarding",
    "home.what.item4": "Structured rental event records",
    "home.what.item5": "Clear documentation for payments, notices, and disputes",
    "home.what.footer":
      "RentChain is designed to support fairness, accountability, and long-term clarity for everyone involved.",
    "about.title": "About RentChain",
    "about.p1":
      "RentChain was created to address a simple but persistent problem in the rental market: important decisions are often made without reliable, standardized records.",
    "about.p2":
      "Rental relationships generate critical information — screening results, payments, notices, disputes — yet this information is often scattered across emails, PDFs, and informal systems. When clarity matters most, records are incomplete or difficult to verify.",
    "about.p3": "RentChain exists to change that.",
    "about.p4":
      "We are building a neutral platform that helps landlords and tenants interact through verified data, transparent processes, and clearly documented events. Our focus is not on scoring people or replacing human judgment, but on ensuring that rental decisions are grounded in accurate, time-stamped records.",
    "about.p5":
      "RentChain is designed to serve independent landlords and tenants today, while laying the foundation for future compliance-driven and public-sector housing programs where transparency, auditability, and trust are essential.",
    "about.principles": "Our guiding principles are simple:",
    "about.principle1": "Verification over assumptions",
    "about.principle2": "Records over memory",
    "about.principle3": "Transparency over opacity",
    "pricing.headline":
      "RentChain offers simple, transparent pricing designed to support landlords at every stage — from individual property owners to multi-unit portfolios.",
    "pricing.title": "Pricing",
    "pricing.subline": "There are no long-term contracts, and you can change plans as your needs evolve.",
    "pricing.go_dashboard": "Go to dashboard",
    "pricing.request_access": "Request access",
    "pricing.sign_in": "Sign in",
    "pricing.choose_plan": "Choose plan",
    "pricing.get_started": "Get started",
    "pricing.starter.title": "Starter",
    "pricing.starter.item1": "Property and unit management",
    "pricing.starter.item2": "Send application links",
    "pricing.starter.item3": "Tenant invitations and onboarding",
    "pricing.starter.item4": "Lease and tenant lifecycle tracking",
    "pricing.starter.item5": "Core rental event records",
    "pricing.pro.title": "Professional",
    "pricing.pro.plus": "Everything in Starter, plus:",
    "pricing.pro.item2": "Ledger tools for audit-ready events",
    "pricing.pro.item3": "Exports for reporting and audits",
    "pricing.pro.item4": "Compliance-ready notices and timelines",
    "pricing.pro.screening_note": "Screening: Pay-per-applicant",
    "pricing.business.title": "Business",
    "pricing.business.item1": "Advanced exports and audit logs",
    "pricing.business.item2": "Compliance reporting",
    "pricing.business.item3": "Portfolio analytics",
    "pricing.business.item4": "Priority support",
    "pricing.screening_fees": "Screening Fees",
    "pricing.banner.unavailable": "Pricing unavailable",
    "pricing.starter.subtitle": "Simple starter plan for growing portfolios.",
    "pricing.pro.subtitle": "For landlords who require screening and verified records.",
    "pricing.pro.item1": "Tenant screening access",
    "pricing.pro.item2": "Verified record-keeping",
    "pricing.pro.item3": "Priority support",
    "pricing.business.subtitle": "For larger portfolios with compliance needs.",
    "pricing.business.item1": "Advanced exports and reporting",
    "pricing.business.item2": "Audit-ready documentation",
    "pricing.business.item3": "Dedicated success support",
    "pricing.notice":
      "Tenant screening services are charged per applicant and clearly disclosed before purchase.",
    "pricing.notice2": "RentChain does not bundle or obscure third-party screening costs.",
    "legal.headline": "Legal & Help",
    "legal.ask_title": "Need help? Ask RentChain",
    "legal.section_legal": "Legal",
    "legal.privacy_title": "Privacy & Data Protection",
    "legal.privacy_body":
      "RentChain is built with privacy, security, and consent at its core. Personal data is collected, stored, and processed in accordance with applicable laws and is only used for clearly defined purposes. Tenant information is never shared without proper authorization or legal basis.",
    "legal.consent_title": "Consent & Transparency",
    "legal.consent_body":
      "Tenants are informed when screening or records are created and must provide consent where required. RentChain does not create hidden profiles or undisclosed records.",
    "legal.noblackbox_title": "No Black-Box Scoring",
    "legal.noblackbox_body":
      "RentChain does not generate informal tenant ratings or opaque risk scores. All recorded information is factual, time-stamped, and attributable.",
    "legal.platform_title": "Platform Role",
    "legal.platform_body":
      "RentChain provides tools and record-keeping infrastructure. Landlords remain responsible for decisions, compliance, and outcomes.",
    "legal.section_terms": "Terms & Policies",
    "legal.terms_service": "Terms of Service",
    "legal.terms_privacy": "Privacy Policy",
    "legal.terms_acceptable": "Acceptable Use Policy",
    "legal.section_help": "Help Center",
    "legal.help_library": "Looking for the full library?",
    "legal.help_library_link": "View all templates \u2192",
    "legal.help_landlords": "Help for Landlords",
    "legal.help_tenants": "Help for Tenants",
    "legal.help_getting_started": "Getting Started",
    "legal.help_guides": "Guides",
    "legal.help_understanding": "Understanding RentChain",
    "legal.template_late_rent": "Late Rent Notice",
    "legal.template_notice_entry": "Notice of Entry",
    "legal.template_lease_event": "Lease Event Log",
    "legal.template_move_in_out": "Move-In / Move-Out Inspection Checklist",
    "legal.template_rent_ledger": "Rent Ledger Summary Sheet",
    "legal.template_rental_checklist": "Rental Application Checklist (Tenant)",
    "legal.template_dispute_guide": "Dispute Documentation Guide",
    "legal.templates_disclaimer":
      "Templates are general-purpose and not legal advice. Customize for your jurisdiction and consult counsel as needed.",
    "legal.help_contact":
      "If you need help or have questions, visit the Help Center or contact our support team.",
    "legal.body1":
      "RentChain provides transparent rental records and screening workflows. Always consult your local regulations for the latest requirements.",
    "legal.body2":
      "Tenants are informed when screening or records are created and must provide consent where required.",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.about": "À propos",
    "nav.pricing": "Tarifs",
    "nav.legal": "Légal & aide",
    "nav.login": "Connexion",
    "nav.request_access": "Demander l’accès",
    "nav.dashboard": "Tableau de bord",
    "nav.menu": "Menu",
    "nav.open_menu": "Ouvrir le menu",
    "nav.close_menu": "Fermer le menu",
    "footer.help_center": "Centre d’aide",
    "footer.templates": "Modèles",
    "footer.privacy": "Confidentialité",
    "footer.terms": "Conditions",
    "home.tagline": "Vérification fiable. Dossiers clairs. Relations locatives de confiance.",
    "home.intro":
      "RentChain est une plateforme de vérification et de gestion locative conçue pour apporter transparence et responsabilité entre propriétaires et locataires — grâce à des informations vérifiées et des dossiers structurés.",
    "home.cta.dashboard": "Aller au tableau de bord",
    "home.cta.request": "Demander l’accès",
    "home.cta.signin": "Connexion",
    "home.cta.pricing": "Voir les tarifs",
    "home.landlords.title": "Pour les propriétaires",
    "home.landlords.subtitle": "Prenez des décisions locatives avec des informations vérifiées — pas au hasard.",
    "home.landlords.body":
      "RentChain aide les propriétaires à vérifier les candidats, gérer les locataires et maintenir des dossiers clairs et défendables tout au long du cycle locatif. De la vérification aux événements de bail, tout est documenté dans un système structuré et horodaté pour de meilleures décisions et moins de litiges.",
    "home.landlords.footer":
      "Que vous gériez un seul logement ou un portefeuille en croissance, RentChain vous donne un système fiable.",
    "home.tenants.title": "Pour les locataires",
    "home.tenants.subtitle": "Un processus locatif basé sur la clarté et le consentement.",
    "home.tenants.body":
      "RentChain offre aux locataires une manière transparente de participer au processus locatif. Vérification, événements de bail et interactions consignées sont gérés clairement — sans scores cachés ni jugements informels.",
    "home.tenants.footer":
      "Vos informations sont traitées avec consentement, exactitude et respect de la vie privée.",
    "home.what.title": "Ce que fait RentChain",
    "home.what.item1": "Vérification et validation des locataires",
    "home.what.item2": "Gestion des propriétés, unités et baux",
    "home.what.item3": "Invitations et intégration sécurisées des locataires",
    "home.what.item4": "Dossiers structurés des événements locatifs",
    "home.what.item5": "Documentation claire pour paiements, avis et litiges",
    "home.what.footer":
      "RentChain favorise l’équité, la responsabilité et la clarté à long terme pour tous.",
    "about.title": "À propos de RentChain",
    "about.p1":
      "RentChain a été créé pour résoudre un problème simple mais persistant du marché locatif : des décisions importantes sont souvent prises sans dossiers fiables et normalisés.",
    "about.p2":
      "Les relations locatives génèrent des informations critiques — résultats de vérification, paiements, avis, litiges — mais ces informations sont souvent dispersées entre courriels, PDF et systèmes informels. Quand la clarté est essentielle, les dossiers sont incomplets ou difficiles à vérifier.",
    "about.p3": "RentChain existe pour changer cela.",
    "about.p4":
      "Nous construisons une plateforme neutre qui aide propriétaires et locataires à interagir via des données vérifiées, des processus transparents et des événements clairement documentés. Notre objectif n’est pas de noter les personnes ni de remplacer le jugement humain, mais d’ancrer les décisions locatives dans des dossiers précis et horodatés.",
    "about.p5":
      "RentChain est conçu pour servir les propriétaires indépendants et les locataires aujourd’hui, tout en posant les bases de futurs programmes conformes et publics où transparence, auditabilité et confiance sont essentielles.",
    "about.principles": "Nos principes directeurs sont simples :",
    "about.principle1": "Vérification plutôt qu’hypothèses",
    "about.principle2": "Dossiers plutôt que mémoire",
    "about.principle3": "Transparence plutôt qu’opacité",
    "pricing.headline":
      "RentChain propose une tarification simple et transparente, adaptée aux propriétaires à chaque étape — du propriétaire individuel aux portefeuilles multi‑unités.",
    "pricing.title": "Tarifs",
    "pricing.subline": "Il n’y a pas de contrat à long terme et vous pouvez changer de plan selon vos besoins.",
    "pricing.go_dashboard": "Aller au tableau de bord",
    "pricing.request_access": "Demander l’accès",
    "pricing.sign_in": "Connexion",
    "pricing.choose_plan": "Choisir un plan",
    "pricing.get_started": "Commencer",
    "pricing.starter.title": "Starter",
    "pricing.starter.item1": "Gestion des propriétés et des unités",
    "pricing.starter.item2": "Envoi de liens de candidature",
    "pricing.starter.item3": "Invitations et intégration des locataires",
    "pricing.starter.item4": "Suivi du cycle de vie des baux et locataires",
    "pricing.starter.item5": "Dossiers d’événements locatifs de base",
    "pricing.pro.title": "Professionnel",
    "pricing.pro.plus": "Tout ce qui est dans Starter, plus :",
    "pricing.pro.item2": "Outils de registre pour événements auditables",
    "pricing.pro.item3": "Exports pour rapports et audits",
    "pricing.pro.item4": "Avis et chronologies prêts pour conformité",
    "pricing.pro.screening_note": "Vérification : facturée par demandeur",
    "pricing.business.title": "Business",
    "pricing.business.item1": "Exports avancés et journaux d’audit",
    "pricing.business.item2": "Rapports de conformité",
    "pricing.business.item3": "Analyses de portefeuille",
    "pricing.business.item4": "Support prioritaire",
    "pricing.screening_fees": "Frais de vérification",
    "pricing.banner.unavailable": "Tarifs indisponibles",
    "pricing.starter.subtitle": "Plan de démarrage simple pour portefeuilles en croissance.",
    "pricing.pro.subtitle": "Pour les propriétaires qui exigent des dossiers vérifiés.",
    "pricing.pro.item1": "Accès à la vérification des locataires",
    "pricing.pro.item2": "Tenue de dossiers vérifiés",
    "pricing.pro.item3": "Support prioritaire",
    "pricing.business.subtitle": "Pour les grands portefeuilles avec exigences de conformité.",
    "pricing.business.item1": "Exports et rapports avancés",
    "pricing.business.item2": "Documentation prête pour audit",
    "pricing.business.item3": "Accompagnement dédié",
    "pricing.notice":
      "Les services de vérification des locataires sont facturés par demandeur et clairement indiqués avant l’achat.",
    "pricing.notice2": "RentChain n’inclut pas ni ne masque les coûts tiers.",
    "legal.headline": "Légal & aide",
    "legal.ask_title": "Besoin d’aide? Demandez à RentChain",
    "legal.section_legal": "Légal",
    "legal.privacy_title": "Confidentialité et protection des données",
    "legal.privacy_body":
      "RentChain est conçu avec la confidentialité, la sécurité et le consentement au cœur. Les données personnelles sont collectées, stockées et traitées conformément aux lois applicables et utilisées uniquement à des fins clairement définies. Les informations des locataires ne sont jamais partagées sans autorisation adéquate ou base légale.",
    "legal.consent_title": "Consentement et transparence",
    "legal.consent_body":
      "Les locataires sont informés lorsque des vérifications ou des dossiers sont créés et doivent donner leur consentement lorsque requis. RentChain ne crée pas de profils cachés ni de dossiers non divulgués.",
    "legal.noblackbox_title": "Aucune notation opaque",
    "legal.noblackbox_body":
      "RentChain ne génère pas de notations informelles ni de scores de risque opaques. Toutes les informations enregistrées sont factuelles, horodatées et attribuables.",
    "legal.platform_title": "Rôle de la plateforme",
    "legal.platform_body":
      "RentChain fournit des outils et une infrastructure de tenue de dossiers. Les propriétaires restent responsables des décisions, de la conformité et des résultats.",
    "legal.section_terms": "Conditions et politiques",
    "legal.terms_service": "Conditions d’utilisation",
    "legal.terms_privacy": "Politique de confidentialité",
    "legal.terms_acceptable": "Politique d’utilisation acceptable",
    "legal.section_help": "Centre d’aide",
    "legal.help_library": "Vous cherchez toute la bibliothèque?",
    "legal.help_library_link": "Voir tous les modèles \u2192",
    "legal.help_landlords": "Aide pour les propriétaires",
    "legal.help_tenants": "Aide pour les locataires",
    "legal.help_getting_started": "Bien démarrer",
    "legal.help_guides": "Guides",
    "legal.help_understanding": "Comprendre RentChain",
    "legal.template_late_rent": "Avis de retard de loyer",
    "legal.template_notice_entry": "Avis d’entrée",
    "legal.template_lease_event": "Journal des événements de bail",
    "legal.template_move_in_out": "Liste d’inspection d’entrée/sortie",
    "legal.template_rent_ledger": "Résumé du registre des loyers",
    "legal.template_rental_checklist": "Liste de vérification de la demande (locataire)",
    "legal.template_dispute_guide": "Guide de documentation des litiges",
    "legal.templates_disclaimer":
      "Les modèles sont généraux et ne constituent pas un avis juridique. Adaptez-les à votre juridiction et consultez un conseiller si nécessaire.",
    "legal.help_contact":
      "Si vous avez besoin d’aide ou des questions, consultez le Centre d’aide ou contactez notre équipe de support.",
    "legal.body1":
      "RentChain fournit des dossiers locatifs transparents et des flux de vérification. Consultez toujours vos règlements locaux pour les exigences à jour.",
    "legal.body2":
      "Les locataires sont informés lorsque des vérifications ou des dossiers sont créés et doivent donner leur consentement lorsque requis.",
  },
};

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  const stored = String(window.localStorage.getItem(STORAGE_KEY) || "").trim().toLowerCase();
  if (stored === "en" || stored === "fr") return stored;
  const lang = String(window.navigator.language || "").toLowerCase();
  if (lang.startsWith("fr")) return "fr";
  return "en";
};

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = String(event.newValue || "").toLowerCase();
      if (next === "en" || next === "fr") {
        setLocaleState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const t = useMemo(() => {
    return (key: string) => dictionaries[locale]?.[key] || dictionaries.en[key] || key;
  }, [locale]);

  return { locale, setLocale, t };
}
