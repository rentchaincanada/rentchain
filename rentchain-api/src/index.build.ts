console.log("[BOOT] index.build starting");
import { installFatalStartupHandlers } from "./process/fatalStartup";

installFatalStartupHandlers();

import { app } from "./app.build";
import { assertRequiredEnv } from "./config/requiredEnv";

const PORT = Number(process.env.PORT || 8080);

assertRequiredEnv();
console.log("[BOOT] about to listen", { port: PORT });
app.listen(PORT, "0.0.0.0", () => {
  console.log(`rentchain-api build-safe listening on port ${PORT}`);
});
