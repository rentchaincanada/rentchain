import { describe, expect, it, vi } from "vitest";
import {
  PREVIEW_ACCOUNT_EMAIL,
  PREVIEW_PROJECT_ID,
  PREVIEW_RUNTIME_FIRESTORE_PERMISSIONS,
  PREVIEW_SEED_OPERATOR_PERMISSIONS,
  seedPreviewAccountContext,
} from "../previewAccountContextSeed";

function harness(input?: {
  projectId?: string;
  user?: { uid: string; email?: string; emailVerified: boolean } | null;
  documents?: Record<string, Record<string, unknown>>;
  commitFails?: boolean;
}) {
  const documents = new Map(Object.entries(input?.documents || {}));
  const writes: Array<{ collection: string; fields: Record<string, unknown> }> = [];
  const logs: Record<string, unknown>[] = [];
  return {
    writes,
    logs,
    dependencies: {
      projectId: input?.projectId ?? PREVIEW_PROJECT_ID,
      getUserByEmail: vi.fn(async () => {
        if (input && "user" in input && input.user === null) throw new Error("preview_user_not_found");
        return input?.user ?? { uid: "private-preview-uid", email: PREVIEW_ACCOUNT_EMAIL, emailVerified: true };
      }),
      getDocument: vi.fn(async (collection: string) => documents.get(collection) || null),
      commitDocuments: vi.fn(async (pending: Array<{ collection: string; fields: Record<string, unknown> }>) => {
        if (input?.commitFails) throw new Error("atomic_commit_failed");
        for (const { collection, fields } of pending) {
          writes.push({ collection, fields });
          documents.set(collection, { ...(documents.get(collection) || {}), ...fields });
        }
      }),
      now: vi.fn(() => "2026-07-31T00:00:00.000Z"),
      log: vi.fn((summary: Record<string, unknown>) => logs.push(summary)),
    },
  };
}

describe("Preview account-context seed", () => {
  it("is dry-run by default at the core boundary and performs no writes", async () => {
    const h = harness();
    const result = await seedPreviewAccountContext(h.dependencies, { apply: false });
    expect(result).toMatchObject({ documents: 3, writes: 0 });
    expect(h.dependencies.commitDocuments).not.toHaveBeenCalled();
  });

  it("accepts only the exact Preview project and rejects a missing project", async () => {
    const accepted = harness({ projectId: PREVIEW_PROJECT_ID });
    await expect(seedPreviewAccountContext(accepted.dependencies, { apply: false })).resolves.toMatchObject({
      documents: 3,
    });
    const missing = harness({ projectId: "" });
    await expect(seedPreviewAccountContext(missing.dependencies, { apply: false })).rejects.toThrow(
      "preview_project_guard_failed"
    );
    expect(missing.dependencies.getUserByEmail).not.toHaveBeenCalled();
  });

  it("fails closed outside the exact Preview project", async () => {
    const h = harness({ projectId: "not-preview-project" });
    await expect(seedPreviewAccountContext(h.dependencies, { apply: false })).rejects.toThrow(
      "preview_project_guard_failed"
    );
    expect(h.dependencies.getUserByEmail).not.toHaveBeenCalled();
  });

  it("fails closed for a missing or unverified Preview user", async () => {
    const missing = harness({ user: null });
    await expect(seedPreviewAccountContext(missing.dependencies, { apply: false })).rejects.toThrow(
      "preview_user_not_found"
    );
    const unverified = harness({
      user: { uid: "private-preview-uid", email: PREVIEW_ACCOUNT_EMAIL, emailVerified: false },
    });
    await expect(seedPreviewAccountContext(unverified.dependencies, { apply: false })).rejects.toThrow(
      "preview_user_email_unverified"
    );
  });

  it("creates only users, accounts, and landlords documents", async () => {
    const h = harness();
    const result = await seedPreviewAccountContext(h.dependencies, { apply: true });
    expect(result).toMatchObject({ documents: 3, writes: 3 });
    expect(h.writes.map((write) => write.collection)).toEqual(["users", "accounts", "landlords"]);
    expect(h.writes[0].fields).toMatchObject({ role: "landlord", approved: true, disabled: false });
    expect(h.writes[1].fields).toMatchObject({ plan: "screening", planStatus: "active" });
    expect(h.writes[2].fields).toMatchObject({ role: "landlord", plan: "screening" });
  });

  it("does not fabricate optional product, entitlement, or usage fields", async () => {
    const h = harness();
    await seedPreviewAccountContext(h.dependencies, { apply: true });
    const serialized = JSON.stringify(h.writes);
    expect(serialized).not.toMatch(
      /capabilit|entitlement|permission|feature|usage|limit|quota|subscription|billing/i
    );
  });

  it("is idempotent after the first apply", async () => {
    const h = harness();
    expect((await seedPreviewAccountContext(h.dependencies, { apply: true })).writes).toBe(3);
    expect((await seedPreviewAccountContext(h.dependencies, { apply: true })).writes).toBe(0);
  });

  it("commits all three documents atomically", async () => {
    const h = harness();
    await seedPreviewAccountContext(h.dependencies, { apply: true });
    expect(h.dependencies.commitDocuments).toHaveBeenCalledTimes(1);
    expect(h.dependencies.commitDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ collection: "users" }),
        expect.objectContaining({ collection: "accounts" }),
        expect.objectContaining({ collection: "landlords" }),
      ])
    );
  });

  it("leaves no partial state when the atomic commit fails", async () => {
    const h = harness({ commitFails: true });
    await expect(seedPreviewAccountContext(h.dependencies, { apply: true })).rejects.toThrow(
      "atomic_commit_failed"
    );
    expect(h.writes).toHaveLength(0);
  });

  it("fails closed on existing ownership, role, or status mismatch", async () => {
    for (const documents of [
      { users: { email: "other@example.com" } },
      { users: { role: "admin" } },
      { accounts: { ownerUserId: "unexpected-owner" } },
      { accounts: { disabled: true } },
      { landlords: { approved: false } },
    ]) {
      const h = harness({ documents });
      await expect(seedPreviewAccountContext(h.dependencies, { apply: true })).rejects.toThrow(
        /unexpected_existing_/
      );
      expect(h.writes).toHaveLength(0);
    }
  });

  it("writes only the approved account-context field names", async () => {
    const h = harness();
    await seedPreviewAccountContext(h.dependencies, { apply: true });
    expect(h.writes.map(({ collection, fields }) => [collection, Object.keys(fields).sort()])).toEqual([
      ["users", ["actorRole", "approved", "createdAt", "disabled", "email", "id", "landlordId", "role", "updatedAt"]],
      ["accounts", ["actorRole", "approved", "createdAt", "disabled", "id", "landlordId", "ownerUserId", "plan", "planStatus", "role", "updatedAt"]],
      ["landlords", ["approved", "createdAt", "email", "id", "landlordId", "plan", "role", "updatedAt"]],
    ]);
  });

  it("exposes no delete or collection-scan dependency", () => {
    const h = harness();
    expect(Object.keys(h.dependencies).sort()).toEqual([
      "commitDocuments",
      "getDocument",
      "getUserByEmail",
      "log",
      "now",
      "projectId",
    ]);
  });

  it("keeps runtime read-only and seed permissions separate without delete access", () => {
    expect(PREVIEW_RUNTIME_FIRESTORE_PERMISSIONS).toEqual([
      "datastore.databases.get",
      "datastore.entities.get",
      "datastore.entities.list",
    ]);
    expect(PREVIEW_SEED_OPERATOR_PERMISSIONS).toEqual([
      "datastore.databases.get",
      "datastore.entities.create",
      "datastore.entities.get",
      "datastore.entities.update",
      "firebaseauth.users.get",
    ]);
    expect([...PREVIEW_RUNTIME_FIRESTORE_PERMISSIONS, ...PREVIEW_SEED_OPERATOR_PERMISSIONS].join(" ")).not.toMatch(
      /delete/
    );
  });

  it("logs only collection field names and never the raw UID", async () => {
    const h = harness();
    await seedPreviewAccountContext(h.dependencies, { apply: false });
    const serialized = JSON.stringify(h.logs);
    expect(serialized).not.toContain("private-preview-uid");
    expect(serialized).not.toMatch(/password|token|cookie|api.?key|authorization/i);
    expect(serialized).toContain("users");
    expect(serialized).toContain("accounts");
    expect(serialized).toContain("landlords");
  });
});
