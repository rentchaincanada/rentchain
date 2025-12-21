import { app } from "./app.build";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`rentchain-api (build-safe) listening on port ${port}`);
});
