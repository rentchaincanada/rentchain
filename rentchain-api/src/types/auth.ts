export type UserRole = "landlord" | "admin" | "tenant";

export type AuthUser = {
  id: string;
  email?: string;
  role?: UserRole;
  landlordId?: string;
  plan?: string;
  capabilities?: string[];
  [key: string]: any;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
