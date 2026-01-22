type AnalyticsProps = Record<string, unknown>;

const hasDoNotTrack = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const dnt =
    nav.doNotTrack === "1" ||
    (window as Window & { doNotTrack?: string }).doNotTrack === "1" ||
    (navigator as Navigator & { msDoNotTrack?: string }).msDoNotTrack === "1";

  return dnt || nav.globalPrivacyControl === true;
};

const isDev = () => {
  try {
    return import.meta.env?.MODE !== "production";
  } catch {
    return false;
  }
};

export function track(eventName: string, props: AnalyticsProps = {}) {
  if (typeof window === "undefined") {
    return;
  }
  if (hasDoNotTrack()) {
    return;
  }

  const anyWindow = window as Window & {
    plausible?: (eventName: string, options?: { props?: AnalyticsProps }) => void;
    gtag?: (...args: unknown[]) => void;
  };

  if (typeof anyWindow.plausible === "function") {
    anyWindow.plausible(eventName, { props });
    return;
  }

  if (typeof anyWindow.gtag === "function") {
    anyWindow.gtag("event", eventName, props);
    return;
  }

  if (isDev()) {
    console.debug("[analytics]", eventName, props);
  }
}
