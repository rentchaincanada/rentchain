import { useEffect, useState } from "react";

export function useIsMobile(query: string = "(max-width: 768px)") {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile("matches" in e ? e.matches : (e as MediaQueryList).matches);
    };
    // Support older Safari by checking addEventListener
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
    } else {
      // @ts-expect-error legacy API
      mql.addListener(handler);
    }
    handler(mql);
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handler);
      } else {
        // @ts-expect-error legacy API
        mql.removeListener(handler);
      }
    };
  }, [query]);

  return isMobile;
}
