import "dotenv/config";  // loads .env variables
import app from "./app";
import app from "./app";

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`rentchain-api build-safe listening on port ${PORT}`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`rentchain-api listening on port ${PORT}`);
});
