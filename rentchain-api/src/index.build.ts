console.log("[BOOT] index.build starting");
process.on("uncaughtException", (e) => console.error("[FATAL] uncaughtException", e));
process.on("unhandledRejection", (e) => console.error("[FATAL] unhandledRejection", e));

import { app } from "./app.build";

const PORT = Number(process.env.PORT || 8080);

console.log("[BOOT] about to listen", { port: PORT });
app.listen(PORT, "0.0.0.0", () => {
  console.log(`rentchain-api build-safe listening on port ${PORT}`);
});
