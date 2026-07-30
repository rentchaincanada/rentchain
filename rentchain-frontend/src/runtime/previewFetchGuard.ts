import { assertPreviewBrowserRequestAvailable } from "../api/baseUrl";

const INSTALL_MARKER = Symbol.for("rentchain.previewFetchGuard.installed");

type FetchWindow = {
  fetch: typeof fetch;
  [INSTALL_MARKER]?: boolean;
};

type GovernedFetchDependencies = {
  getAuthToken: () => string | null;
  apiBaseUrl: string;
  browserOrigin: string;
  deployEnv: string;
  isDevelopment: boolean;
  reportDirectApiFetch?: (url: string) => void;
};

function isSameOriginPreviewProxyUrl(url: string, browserOrigin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, browserOrigin);
  } catch {
    return false;
  }
  return (
    parsed.origin === browserOrigin &&
    parsed.pathname.startsWith("/api/preview-backend/")
  );
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" || input instanceof URL ? input.toString() : input.url;
}

function effectiveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
}

export function createGovernedFetch(
  originalFetch: typeof fetch,
  dependencies: GovernedFetchDependencies
): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    assertPreviewBrowserRequestAvailable(url, effectiveMethod(input, init));

    const initHeaders = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined) || undefined
    );
    const marked = initHeaders.get("x-api-client") === "web";
    if (dependencies.isDevelopment && !marked && url.includes("/api/")) {
      dependencies.reportDirectApiFetch?.(url);
    }

    const isPreview = dependencies.deployEnv.trim().toLowerCase() === "preview";
    const isPreviewApi = isSameOriginPreviewProxyUrl(
      url,
      dependencies.browserOrigin
    );
    if (isPreview && !isPreviewApi) {
      return originalFetch(input, init);
    }

    const token = dependencies.getAuthToken();
    const shouldAttachAuth =
      Boolean(token) &&
      (isPreview ||
        (url.startsWith("http")
          ? Boolean(dependencies.apiBaseUrl) && url.startsWith(dependencies.apiBaseUrl)
          : true));
    if (!shouldAttachAuth || initHeaders.has("Authorization")) {
      return originalFetch(input, init);
    }

    initHeaders.set("Authorization", `Bearer ${token}`);
    return originalFetch(input, { ...init, headers: initHeaders });
  }) as typeof fetch;
}

export function installPreviewFetchGuard(
  windowLike: FetchWindow,
  dependencies: GovernedFetchDependencies
): typeof fetch {
  if (windowLike[INSTALL_MARKER]) return windowLike.fetch;
  const originalFetch = windowLike.fetch.bind(windowLike);
  windowLike.fetch = createGovernedFetch(originalFetch, dependencies);
  windowLike[INSTALL_MARKER] = true;
  return windowLike.fetch;
}
