const major = Number(String(process.versions.node || "").split(".")[0] || 0);
if (major !== 20) {
  console.error(
    [
      "Node 20.x is required for this repo.",
      `Detected: ${process.version}`,
      "Install/use Node 20.11.1 (see README for setup instructions).",
    ].join(" ")
  );
  process.exit(1);
}
