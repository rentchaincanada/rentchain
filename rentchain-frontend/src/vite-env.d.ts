/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEPLOY_ENV?: "development" | "preview" | "production";
  readonly VITE_PR1516_NOTICES_QA?: string;
  readonly VITE_PR1516_QA_BRANCH?: string;
  readonly VITE_PR1516_QA_COMMIT_SHA?: string;
  readonly VITE_PR1516_QA_SCOPE?: string;
  readonly VITE_PR1516_QA_SELECTOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
