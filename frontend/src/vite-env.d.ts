/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Databricks workspace host, e.g. https://dbc-xxxx.cloud.databricks.com */
  readonly VITE_WORKSPACE_URL?: string;
  /** Workspace org id (the `o=` query param used by embed URLs). */
  readonly VITE_WORKSPACE_ORG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "@brand" {
  const value: import("./theme/brand").Brand;
  export default value;
}

declare module "@dashboards-seed" {
  const value: import("./registry/types").Registry;
  export default value;
}
