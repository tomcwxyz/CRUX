/** An explicit, isolated fallback; never use browser-only mode in production. */
export const allowBrowserOnlyDemo = (databaseConfigured: boolean, deploymentEnvironment: string | undefined) =>
  !databaseConfigured && (deploymentEnvironment === "preview" || deploymentEnvironment === "development");
