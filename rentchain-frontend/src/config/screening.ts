export const SCREENING_ENABLED = import.meta.env.VITE_SCREENING_ENABLED === "true";

export type UiLocale = "en" | "fr";

export function getUiLocale(): UiLocale {
  if (typeof window === "undefined") return "en";
  const stored = String(window.localStorage.getItem("rc_locale") || "").trim().toLowerCase();
  return stored === "fr" ? "fr" : "en";
}

export function screeningComingSoonLabel(locale: UiLocale): string {
  return locale === "fr" ? "Verification de credit — bientot disponible" : "Credit screening — coming soon";
}

export function screeningUnavailableMessage(locale: UiLocale): string {
  return locale === "fr"
    ? "La verification de credit est temporairement indisponible. Veuillez reessayer plus tard."
    : "Screening is temporarily unavailable. Please try again later.";
}

export function screeningComingSoonNotice(locale: UiLocale): string {
  return locale === "fr"
    ? "La verification de credit sera bientot disponible. Nous vous aviserons des son lancement."
    : "Credit screening is coming soon. We'll notify you when it's available.";
}

