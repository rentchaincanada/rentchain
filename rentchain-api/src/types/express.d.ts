import "express";
import type { UserEntitlements } from "../services/entitlementsService";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      role?: string;
      landlordId?: string;
      tenantId?: string;
      leaseId?: string;
      actorRole?: string;
      actorLandlordId?: string;
      plan?: string;
      capabilities?: string[];
      entitlements?: UserEntitlements;
    }
    interface Request {
      user?: User;
      requestId?: string;
      integrity?: any;
      entitlements?: UserEntitlements;
    }
  }
}

export {};
