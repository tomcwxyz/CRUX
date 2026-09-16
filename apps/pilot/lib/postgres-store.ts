import postgres from "postgres";
import {
  PostgresDurableIngestStore,
  type PostgresQuery,
} from "@crux/adapter-postgres";

type QueryClient = {
  unsafe: (text: string, params?: unknown[]) => Promise<{
    [key: string]: unknown;
    length: number;
    count?: number;
  } & Array<Record<string, unknown>>>;
  begin?: <T>(callback: (transaction: QueryClient) => Promise<T>) => Promise<T>;
};

let sqlClient: ReturnType<typeof postgres> | null = null;

const getClient = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("CRUX durable ingress is not configured: DATABASE_URL is missing.");
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

const normaliseJsonbParams = (text: string, params: readonly unknown[]) =>
  params.map((param, index) => {
    const placeholder = `$${index + 1}::jsonb`;
    if (!text.includes(placeholder) || typeof param !== "string") return param;

    try {
      return JSON.parse(param) as unknown;
    } catch {
      return param;
    }
  });

const wrapQuery = (client: QueryClient): PostgresQuery => {
  const query: PostgresQuery = async <
    Row extends Record<string, unknown> = Record<string, unknown>,
  >(
    text: string,
    params: readonly unknown[] = [],
  ) => {
    // postgres.js serialises a string bound directly to a json/jsonb parameter as
    // a JSON scalar string. The driver-neutral CRUX adapter deliberately passes
    // canonical JSON text, so convert only parameters explicitly cast to jsonb
    // back to structured values at this driver boundary.
    const rows = await client.unsafe(text, normaliseJsonbParams(text, params));
    return {
      rows: rows as unknown as Row[],
      rowCount: rows.count ?? rows.length,
    };
  };

  return query;
};

export const createPilotPostgresStore = () => {
  const client = getClient() as unknown as QueryClient;
  if (!client.begin) {
    throw new Error("Configured PostgreSQL client does not support transactions.");
  }

  return new PostgresDurableIngestStore({
    query: wrapQuery(client),
    transaction: async <T>(callback: (query: PostgresQuery) => Promise<T>) =>
      client.begin!((transaction) => callback(wrapQuery(transaction))),
  });
};
