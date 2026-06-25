/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENCATCH_API_KEY?: string;
  readonly VITE_ENCATCH_API_BASE_URL?: string;
  readonly VITE_ENCATCH_WEB_HOST?: string;
  readonly VITE_ENCATCH_RAISE_ISSUE_FORM_SLUG?: string;
  readonly VITE_ENCATCH_SUGGEST_EDIT_FORM_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
