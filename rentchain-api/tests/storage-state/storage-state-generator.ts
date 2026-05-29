import type { BrowserContextOptions } from "@playwright/test";
import type { AdminStorageStateFixture, SmokeRole, SmokeUser } from "../fixtures/admin-storage-state";

export type PlaywrightStorageState = BrowserContextOptions["storageState"];

export interface StorageStateGeneratorOptions {
  baseUrl?: string;
  fixture: AdminStorageStateFixture;
  role: SmokeRole;
}

function findUserByRole(fixture: AdminStorageStateFixture, role: SmokeRole): SmokeUser | undefined {
  return fixture.users.find((u) => u.role === role);
}

function generateAuthToken(userId: string, role: SmokeRole): string {
  // Generate a deterministic test token (in smoke tests, tokens are mocked server-side)
  return `smoke-${role}-${userId}-token`;
}

export function generateStorageState(options: StorageStateGeneratorOptions): PlaywrightStorageState {
  const { fixture, role, baseUrl = "http://localhost:5173" } = options;
  const user = findUserByRole(fixture, role);

  if (!user) {
    throw new Error(`No user found for role: ${role}`);
  }

  const authToken = generateAuthToken(user.id, role);
  const originUrl = new URL(baseUrl);
  const origin = originUrl.origin;

  return {
    cookies: [
      {
        name: "auth-token",
        value: authToken,
        domain: originUrl.hostname,
        path: "/",
        expires: 4102444800,
        httpOnly: true,
        secure: originUrl.protocol === "https:",
        sameSite: "Lax" as const,
      },
    ],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: "smoke:user:id",
            value: user.id,
          },
          {
            name: "smoke:user:role",
            value: role,
          },
          {
            name: "smoke:user:email",
            value: user.email,
          },
          {
            name: "smoke:fixture:version",
            value: fixture.fixtureVersion,
          },
          {
            name: "smoke:generated:at",
            value: fixture.generatedAt,
          },
          // Store role-specific context
          ...(user.landlordId
            ? [
                {
                  name: "smoke:landlord:id",
                  value: user.landlordId,
                },
              ]
            : []),
          ...(user.tenantId
            ? [
                {
                  name: "smoke:tenant:id",
                  value: user.tenantId,
                },
              ]
            : []),
        ],
      },
    ],
  };
}
