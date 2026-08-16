const major = Number(String(process.versions.node || "").split(".")[0] || 0);
if (major !== 24) {
  console.error(
    [
      "Node 24.x is required for this repo.",
      `Detected: ${process.version}`,
      "Install/use Node 24.19.0 (see README for setup instructions).",
    ].join(" ")
  );
  process.exit(1);
}
