export const BUILD_ID =
  import.meta.env.VITE_BUILD_ID ||
  import.meta.env.VITE_GIT_SHA ||
  "";
