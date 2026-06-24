import {
  DEFAULT_PM_COMPANY_QA_FIXTURE_KEY,
  DEFAULT_PM_COMPANY_QA_LABEL,
  DEFAULT_PM_COMPANY_QA_ROLE,
  buildPropertyManagerCompanyPreviewFixture,
  buildPropertyManagerCompanyPreviewFixtureSafeSummary,
  stablePreviewFixtureId,
  type PropertyManagerCompanyPreviewFixtureMode,
} from "./propertyManagerCompanyPreviewFixturePlan";

type FirestoreDb = (typeof import("../firebase"))["db"];
type FirebaseAdmin = typeof import("firebase-admin");

type Args = {
  write: boolean;
  mode: PropertyManagerCompanyPreviewFixtureMode;
  fixtureKey: string;
  companyLabel: string;
  userEmail: string;
  userId: string;
  role: "company_owner" | "company_admin";
};

function envValue(key: string): string {
  return String(process.env[key] || "").trim();
}

function flagEnabled(key: string): boolean {
  return envValue(key).toLowerCase() === "true";
}

function readArgValue(args: string[], name: string): string {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim();
  const index = args.indexOf(name);
  if (index >= 0) return String(args[index + 1] || "").trim();
  return "";
}

function parseArgs(argv: string[]): Args {
  const write = argv.includes("--write");
  const suspend = argv.includes("--suspend");
  const role = (readArgValue(argv, "--role") || envValue("PM_COMPANY_QA_ROLE") || DEFAULT_PM_COMPANY_QA_ROLE) as
    | "company_owner"
    | "company_admin";
  if (!["company_owner", "company_admin"].includes(role)) {
    throw new Error("PM_COMPANY_QA_ROLE must be company_owner or company_admin");
  }

  return {
    write,
    mode: suspend ? "suspend" : "upsert",
    fixtureKey: readArgValue(argv, "--fixture-key") || envValue("PM_COMPANY_QA_FIXTURE_KEY") || DEFAULT_PM_COMPANY_QA_FIXTURE_KEY,
    companyLabel: readArgValue(argv, "--company-label") || envValue("PM_COMPANY_QA_COMPANY_LABEL") || DEFAULT_PM_COMPANY_QA_LABEL,
    userEmail: (readArgValue(argv, "--qa-user-email") || envValue("PM_COMPANY_QA_USER_EMAIL")).toLowerCase(),
    userId: readArgValue(argv, "--qa-user-id") || envValue("PM_COMPANY_QA_USER_ID"),
    role,
  };
}

async function resolveQaUser(admin: FirebaseAdmin, args: Args): Promise<{ userId: string; userEmail: string }> {
  if (!args.userEmail && !args.userId) {
    throw new Error("Provide PM_COMPANY_QA_USER_EMAIL or PM_COMPANY_QA_USER_ID.");
  }
  if (args.userEmail) {
    const user = await admin.auth().getUserByEmail(args.userEmail);
    return { userId: user.uid, userEmail: user.email || args.userEmail };
  }
  const user = await admin.auth().getUser(args.userId);
  if (!user.email) {
    throw new Error("Resolved QA user has no email.");
  }
  return { userId: user.uid, userEmail: user.email };
}

async function docExists(db: FirestoreDb, collection: string, docId: string): Promise<boolean> {
  const snapshot = await db.collection(collection).doc(docId).get();
  return snapshot.exists;
}

async function run() {
  if (!flagEnabled("PM_COMPANY_QA_FIXTURE_ENABLED")) {
    throw new Error("PM_COMPANY_QA_FIXTURE_ENABLED=true is required.");
  }

  const args = parseArgs(process.argv.slice(2));
  const [admin, firebase] = await Promise.all([import("firebase-admin"), import("../firebase")]);
  const qaUser = await resolveQaUser(admin, args);
  const fixture = buildPropertyManagerCompanyPreviewFixture({
    fixtureKey: args.fixtureKey,
    companyLabel: args.companyLabel,
    userId: qaUser.userId,
    userEmail: qaUser.userEmail,
    role: args.role,
    mode: args.mode,
  });
  const companyId = stablePreviewFixtureId("pm_company_qa", [args.fixtureKey]);
  const membershipId = stablePreviewFixtureId("pm_membership_qa", [args.fixtureKey, qaUser.userId]);
  const [companyExists, membershipExists] = await Promise.all([
    docExists(firebase.db, "propertyManagerCompanies", companyId),
    docExists(firebase.db, "propertyManagerCompanyMemberships", membershipId),
  ]);

  const safeSummary = buildPropertyManagerCompanyPreviewFixtureSafeSummary({
    mode: args.mode,
    write: args.write,
    company: fixture.company,
    membership: fixture.membership,
    companyExists,
    membershipExists,
  });

  if (!args.write) {
    console.log(JSON.stringify({ ...safeSummary, writePerformed: false }, null, 2));
    return;
  }

  await firebase.db.collection("propertyManagerCompanies").doc(companyId).set(fixture.company, { merge: true });
  await firebase.db.collection("propertyManagerCompanyMemberships").doc(membershipId).set(fixture.membership, { merge: true });

  console.log(JSON.stringify({ ...safeSummary, writePerformed: true }, null, 2));
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(JSON.stringify({ ok: false, error: String(err?.message || err), rawIdsPrinted: false }, null, 2));
      process.exit(1);
    });
}
