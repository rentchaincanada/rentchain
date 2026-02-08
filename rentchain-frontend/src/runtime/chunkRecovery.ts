// src/runtime/chunkRecovery.ts
// Side-effect-only module to recover from chunk load failures without app imports.

function showReloadBanner(message: string, onClick?: () => void) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("rc-reload-banner");
  if (existing) return;
  const banner = document.createElement("div");
  banner.id = "rc-reload-banner";
  banner.textContent = message;
  banner.style.position = "fixed";
  banner.style.top = "16px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.background = "rgba(15,23,42,0.95)";
  banner.style.color = "#f8fafc";
  banner.style.padding = "10px 14px";
  banner.style.borderRadius = "999px";
  banner.style.fontSize = "13px";
  banner.style.fontWeight = "600";
  banner.style.zIndex = "9999";
  banner.style.boxShadow = "0 10px 30px rgba(15,23,42,0.4)";
  banner.style.cursor = onClick ? "pointer" : "default";
  if (onClick) {
    banner.addEventListener("click", onClick);
  }
  document.body.appendChild(banner);
}

if (typeof window !== "undefined") {
  const shouldReloadForChunkError = (msg: string) =>
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("ChunkLoadError");

  const reloadOnce = () => {
    const key = "chunkReloaded";
    const tsKey = "chunkReloadedAt";
    const lastAt = Number(sessionStorage.getItem(tsKey) || "0");
    const now = Date.now();
    if (!sessionStorage.getItem(key) || !lastAt || now - lastAt > 60_000) {
      sessionStorage.setItem(key, "1");
      sessionStorage.setItem(tsKey, String(now));
      const sep = window.location.search ? "&" : "?";
      window.location.replace(`${window.location.pathname}${window.location.search}${sep}v=${now}`);
      return;
    }
    showReloadBanner("Update available — tap to reload", () => window.location.reload());
  };

  window.addEventListener("unhandledrejection", (event) => {
    const msg = String((event as any)?.reason?.message || (event as any)?.reason || "");
    if (shouldReloadForChunkError(msg)) {
      showReloadBanner("Update available — reloading…");
      window.setTimeout(reloadOnce, 500);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = String((event as any)?.message || "");
    if (shouldReloadForChunkError(msg)) {
      showReloadBanner("Update available — reloading…");
      window.setTimeout(reloadOnce, 500);
    }
  });
}
