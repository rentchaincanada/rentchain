export const screeningRequestService = {
  createRequest: async (input: any) => {
    // TODO: real legacy screening logic (dev only)
    return { id: "dev-screening-req", ...input, status: "created" };
  },
};
