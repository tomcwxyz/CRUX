import postgres from "postgres";
import { parsePortableBundle, type CruxPortableBundle } from "@crux/formats";

let sqlClient: ReturnType<typeof postgres> | null = null;

const getClient = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("CRUX pilot scope storage is not configured: DATABASE_URL is missing.");
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return sqlClient;
};

/**
 * Applies a reviewed/editorial change to one pilot scope with optimistic
 * revision checking. Runtime records still enter through the durable ingest
 * contract; this helper exists for human-reviewed meaning such as a reviewed
 * receipt, which is deliberately not runtime telemetry.
 */
export const replacePilotScopeBundle = async (input: {
  scopeRef: string;
  expectedRevision: number;
  bundle: CruxPortableBundle;
}) => {
  const bundle = parsePortableBundle(input.bundle);
  const sql = getClient();
  const rows = await sql.unsafe(
    `update crux_scopes
        set bundle = $2::jsonb,
            revision = revision + 1,
            updated_at = now()
      where scope_ref = $1 and revision = $3
      returning revision`,
    [input.scopeRef, bundle, input.expectedRevision],
  );

  const row = rows[0] as { revision?: unknown } | undefined;
  if (!row) {
    throw new Error(
      `CRUX pilot scope ${input.scopeRef} changed before this reviewed update could be saved. Reload and try again.`,
    );
  }

  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("CRUX pilot scope returned an invalid revision after update.");
  }

  return revision;
};
