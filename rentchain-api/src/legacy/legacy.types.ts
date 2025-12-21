export type LegacyEnv = "prod" | "dev";

export interface AuthService {
  verifyToken?: (token: string) => Promise<{ sub: string; email?: string; role?: string }>;
}

export interface ScreeningRequestService {
  createRequest?: (input: any) => Promise<any>;
}

export interface TotpService {
  verifyTotp?: (input: any) => Promise<boolean>;
}

export interface LegacyServices {
  authService: AuthService;
  screeningRequestService: ScreeningRequestService;
  totpService: TotpService;
}
