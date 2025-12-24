import type { AuthenticatedUser } from "../middleware/authMiddleware";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthenticatedUser | any;
    }
  }
}

export {};
