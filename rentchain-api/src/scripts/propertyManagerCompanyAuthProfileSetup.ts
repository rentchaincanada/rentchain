import {
  buildPropertyManagerCompanyAuthProfile,
  buildPropertyManagerCompanyAuthProfileSafeSummary,
} from "./propertyManagerCompanyAuthProfilePlan";

type FirestoreDb = (typeof import("../firebase"))["db"];
type FirebaseAdmin = typeof import("firebase-admin");

type Args = {
  write: boolean;
  userEmail: string;
  userId: string;
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
  return {
    write: argv.includes("--write"),
    userEmail: (readArgValue(argv, "--qa-user-email") || envValue("PM_COMPANY_QA_USER_EMAIL")).toLowerCase(),
    userId: readArgValue(argv, "--qa-user-id") || envValue("PM_COMPANY_QA_USER_ID"),
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
  if (!flagEnabled("PM_COMPANY_AUTH_PROFILE_SETUP_ENABLED")) {
    throw new Error("PM_COMPANY_AUTH_PROFILE_SETUP_ENABLED=true is required.");
  }

  const args = parseArgs(process.argv.slice(2));
  const [admin, firebase] = await Promise.all([import("firebase-admin"), import("../firebase")]);
  const qaUser = await resolveQaUser(admin, args);
  const profile = buildPropertyManagerCompanyAuthProfile({
    userId: qaUser.userId,
    userEmail: qaUser.userEmail,
  });
  const [userProfileExists, accountProfileExists] = await Promise.all([
    docExists(firebase.db, "users", qaUser.userId),
    docExists(firebase.db, "accounts", qaUser.userId),
  ]);
  const safeSummary = buildPropertyManagerCompanyAuthProfileSafeSummary({
    write: args.write,
    userProfileExists,
    accountProfileExists,
    userProfile: profile.userProfile,
    accountProfile: profile.accountProfile,
  });

  if (!args.write) {
    console.log(JSON.stringify({ ...safeSummary, writePerformed: false }, null, 2));
    return;
  }

  await firebase.db.collection("users").doc(qaUser.userId).set(profile.userProfile, { merge: true });
  await firebase.db.collection("accounts").doc(qaUser.userId).set(profile.accountProfile, { merge: true });

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
