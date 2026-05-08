import { useEffect, useState } from "react";

export function isMobilePdfPreviewUnsafe(input: {
  userAgent?: string | null;
  width?: number | null;
  coarsePointer?: boolean | null;
}) {
  const userAgent = String(input.userAgent || "").toLowerCase();
  const width = typeof input.width === "number" ? input.width : Number.POSITIVE_INFINITY;
  const mobileUserAgent = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const narrowViewport = width <= 768;
  return mobileUserAgent || (narrowViewport && input.coarsePointer === true);
}

export function useMobilePdfPreviewGuard() {
  const [unsafe, setUnsafe] = useState(() => {
    if (typeof window === "undefined") return false;
    return isMobilePdfPreviewUnsafe({
      userAgent: window.navigator.userAgent,
      width: window.innerWidth,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    });
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const narrowQuery = window.matchMedia("(max-width: 768px)");
    const update = () => {
      setUnsafe(
        isMobilePdfPreviewUnsafe({
          userAgent: window.navigator.userAgent,
          width: window.innerWidth,
          coarsePointer: coarsePointerQuery.matches,
        })
      );
    };

    update();
    const queries = [coarsePointerQuery, narrowQuery];
    queries.forEach((query) => query.addEventListener?.("change", update));
    return () => queries.forEach((query) => query.removeEventListener?.("change", update));
  }, []);

  return unsafe;
}
