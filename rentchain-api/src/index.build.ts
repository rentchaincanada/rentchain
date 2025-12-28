console.log("[BOOT] index.build starting");
import app from "./app";

const PORT = Number(process.env.PORT || 8080);
console.log("[BOOT] about to listen", { port: PORT });
app.listen(PORT, "0.0.0.0", () => {
  console.log(`rentchain-api build-safe listening on ${PORT}`);
});
