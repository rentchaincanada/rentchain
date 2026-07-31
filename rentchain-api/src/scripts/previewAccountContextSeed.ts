import admin from "firebase-admin";

export const PREVIEW_PROJECT_ID = "rentchain-preview";
export const PREVIEW_ACCOUNT_EMAIL = "admin+previewtest@rentchain.ai";

export const PREVIEW_RUNTIME_FIRESTORE_PERMISSIONS = [
  "datastore.databases.get",
  "datastore.entities.get",
  "datastore.entities.list",
] as const;

export const PREVIEW_SEED_OPERATOR_PERMISSIONS = [
  "datastore.databases.get",
  "datastore.entities.create",
  "datastore.entities.get",
  "datastore.entities.update",
  "firebaseauth.users.get",
] as const;

type SeedDocument = {
  collection: "users" | "accounts" | "landlords";
  fields: Record<string, unknown>;
  guardedFields: readonly string[];
};

type AuthUser = { uid: string; email?: string; emailVerified: boolean };

type SeedDependencies = {
  projectId: string;
  getUserByEmail(email: string): Promise<AuthUser>;
  getDocument(collection: string, id: string): Promise<Record<string, unknown> | null>;
  commitDocuments(
    documents: Array<{ collection: SeedDocument["collection"]; id: string; fields: Record<string, unknown> }>
  ): Promise<void>;
  now(): string;
  log(summary: Record<string, unknown>): void;
};

export type SeedOptions = { apply: boolean };

function assertPreviewProject(projectId: string): void {
  if (projectId !== PREVIEW_PROJECT_ID) throw new Error("preview_project_guard_failed");
}

function buildDocuments(uid: string): SeedDocument[] {
  return [
    {
      collection: "users",
      fields: {
        id: uid,
        email: PREVIEW_ACCOUNT_EMAIL,
        role: "landlord",
        actorRole: "landlord",
        landlordId: uid,
        approved: true,
        disabled: false,
      },
      guardedFields: ["id", "email", "role", "actorRole", "landlordId", "approved", "disabled"],
    },
    {
      collection: "accounts",
      fields: {
        id: uid,
        ownerUserId: uid,
        role: "landlord",
        actorRole: "landlord",
        landlordId: uid,
        plan: "screening",
        planStatus: "active",
        approved: true,
        disabled: false,
      },
      guardedFields: [
        "id",
        "ownerUserId",
        "role",
        "actorRole",
        "landlordId",
        "plan",
        "planStatus",
        "approved",
        "disabled",
      ],
    },
    {
      collection: "landlords",
      fields: {
        id: uid,
        landlordId: uid,
        email: PREVIEW_ACCOUNT_EMAIL,
        role: "landlord",
        plan: "screening",
        approved: true,
      },
      guardedFields: ["id", "landlordId", "email", "role", "plan", "approved"],
    },
  ];
}

function fieldsToMerge(
  document: SeedDocument,
  existing: Record<string, unknown> | null,
  now: string
): Record<string, unknown> {
  if (existing) {
    for (const field of document.guardedFields) {
      if (field in existing && existing[field] !== document.fields[field]) {
        throw new Error(`unexpected_existing_${document.collection}_${field}_mismatch`);
      }
    }
  }

  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(document.fields)) {
    if (!existing || !(field in existing)) patch[field] = value;
  }
  if (!existing || !("createdAt" in existing)) patch.createdAt = now;
  if (Object.keys(patch).length) patch.updatedAt = now;
  return patch;
}

export async function seedPreviewAccountContext(
  dependencies: SeedDependencies,
  options: SeedOptions
): Promise<{ documents: number; writes: number; fields: Record<string, string[]> }> {
  assertPreviewProject(dependencies.projectId);
  const user = await dependencies.getUserByEmail(PREVIEW_ACCOUNT_EMAIL);
  if (!user?.uid) throw new Error("preview_user_not_found");
  if (!user.emailVerified) throw new Error("preview_user_email_unverified");
  if (String(user.email || "").trim().toLowerCase() !== PREVIEW_ACCOUNT_EMAIL) {
    throw new Error("preview_user_email_mismatch");
  }

  const fields: Record<string, string[]> = {};
  const plannedWrites: Array<{ document: SeedDocument; patch: Record<string, unknown> }> = [];
  for (const document of buildDocuments(user.uid)) {
    const existing = await dependencies.getDocument(document.collection, user.uid);
    const patch = fieldsToMerge(document, existing, dependencies.now());
    fields[document.collection] = Object.keys(patch).sort();
    if (Object.keys(patch).length) plannedWrites.push({ document, patch });
  }

  let writes = 0;
  if (options.apply && plannedWrites.length) {
    await dependencies.commitDocuments(
      plannedWrites.map(({ document, patch }) => ({
        collection: document.collection,
        id: user.uid,
        fields: patch,
      }))
    );
    writes = plannedWrites.length;
  }

  const summary = { mode: options.apply ? "apply" : "dry-run", documents: 3, writes, fields };
  dependencies.log(summary);
  return { documents: 3, writes, fields };
}

function parseApply(argv: string[]): boolean {
  const unknown = argv.filter((arg) => arg !== "--apply");
  if (unknown.length) throw new Error("unsupported_seed_argument");
  return argv.includes("--apply");
}

async function main(): Promise<void> {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "").trim();
  assertPreviewProject(projectId);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  }
  const firestore = admin.firestore();
  await seedPreviewAccountContext(
    {
      projectId,
      getUserByEmail: async (email) => {
        try {
          const user = await admin.auth().getUserByEmail(email);
          return { uid: user.uid, email: user.email, emailVerified: user.emailVerified };
        } catch (error: any) {
          if (String(error?.code || "") === "auth/user-not-found") throw new Error("preview_user_not_found");
          throw error;
        }
      },
      getDocument: async (collection, id) => {
        const snap = await firestore.collection(collection).doc(id).get();
        return snap.exists ? ((snap.data() as Record<string, unknown>) || {}) : null;
      },
      commitDocuments: async (documents) => {
        const batch = firestore.batch();
        for (const document of documents) {
          batch.set(firestore.collection(document.collection).doc(document.id), document.fields, { merge: true });
        }
        await batch.commit();
      },
      now: () => new Date().toISOString(),
      log: (summary) => console.info("[preview-account-context-seed]", summary),
    },
    { apply: parseApply(process.argv.slice(2)) }
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[preview-account-context-seed] failed", {
      code: String(error?.message || "seed_failed").replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 96),
    });
    process.exitCode = 1;
  });
}
