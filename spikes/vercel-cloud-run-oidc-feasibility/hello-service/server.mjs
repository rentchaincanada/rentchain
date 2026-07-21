import http from "node:http";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const commitSha = process.env.COMMIT_SHA ?? "unknown";
const revision = process.env.K_REVISION ?? "unknown";

const server = http.createServer((_request, response) => {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(
    JSON.stringify({
      ok: true,
      service: "bounded-oidc-hello",
      commitSha,
      revision,
      timestamp: new Date().toISOString(),
    }),
  );
});

server.listen(port, "0.0.0.0");
