export default async function handler(_req: any, res: any) {
  return res.status(200).json({
    ok: true,
    runtime: "vercel-serverless",
    checks: {
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      SENDGRID_FROM_EMAIL: !!process.env.SENDGRID_FROM_EMAIL,
    },
  });
}
