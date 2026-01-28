export type SubscriptionPlan = "screening" | "starter" | "core" | "pro" | "elite";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  plan: SubscriptionPlan;
  createdAt: string;

  /**
   * Two-factor auth (2FA) flags and data
   */
  twoFactorEnabled?: boolean;
  twoFactorMethods?: string[];
  totpSecret?: string | null;
  backupCodes?: string[];
}
