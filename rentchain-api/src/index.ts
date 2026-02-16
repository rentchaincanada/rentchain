import { app } from "./app";
import { assertRequiredEnv } from "./config/requiredEnv";

const PORT = Number(process.env.PORT || 3000);
assertRequiredEnv();
app.listen(PORT, () => {
  console.log(`rentchain-api dev listening on ${PORT}`);
});
