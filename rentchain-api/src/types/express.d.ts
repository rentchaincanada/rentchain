import "express";

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
    }
    interface Request {
      user?: User;
      requestId?: string;
      integrity?: any;
    }
  }
}

export {};
