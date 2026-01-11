export default function handler(_req: any, res: any) {
  res.status(200).json({
    ok: true,
    vercel: {
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      env: process.env.VERCEL_ENV || null,
    },
    routeCheck: {
      landlordApplicationLinksMounted: true,
      mountPath: "/api/landlord/application-links",
    },
  });
}
