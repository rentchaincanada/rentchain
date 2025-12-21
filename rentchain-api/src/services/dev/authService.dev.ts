export const authService = {
  verifyToken: async (_token: string) => {
    // TODO: plug real legacy auth logic here in dev only.
    return { sub: "dev-user", email: "dev@rentchain.test", role: "landlord" };
  },
};
