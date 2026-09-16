import postgres from "postgres";
import {
  PostgresDurableIngestStore,
  type PostgresQuery,
} from "@crux/adapter-postgres";

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

const wrapQuery = (client: ReturnType<typeof postgres>): PostgresQuery =>
  async (text, params = []) => {
    const rows = await client.unsafe(text, [...params]);
    return {
      rows: rows as unknown as Record<string, unknown>[],
      rowCount: rows.count ?? rows.length,
    };
  };

export const createPilotPostgresStore = () => {
  const client = getClient();
  return new PostgresDurableIngestStore({
    query: wrapQuery(client),
    transaction: async (callback) =>
      client.begin(async (transaction) => callback(wrapQuery(transaction))),
  });
};
