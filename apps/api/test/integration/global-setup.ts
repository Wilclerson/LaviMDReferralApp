import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Vitest runs with the package directory as its working directory.
const API_ROOT = process.cwd();

interface StartedDatabase {
  url: string;
  stop: () => Promise<void>;
}

interface WithDbModule {
  startDatabase: (options?: { port?: number }) => Promise<StartedDatabase>;
}

let database: StartedDatabase | undefined;

/**
 * Boots a real PostgreSQL for the integration suite and applies the committed
 * migrations from an empty database — so every run also proves the migration
 * history is applicable from scratch.
 */
export async function setup(): Promise<void> {
  const module = (await import(
    join(API_ROOT, "scripts", "with-db.mjs").replace(/\\/g, "/")
  )) as WithDbModule;

  database = await module.startDatabase();
  process.env.DATABASE_URL = database.url;
  process.env.JWT_SECRET = "integration-test-secret-value-at-least-32-chars";
  process.env.NODE_ENV = "test";

  execFileSync(
    "node",
    [join(API_ROOT, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: database.url },
      stdio: "inherit",
    },
  );
}

export async function teardown(): Promise<void> {
  await database?.stop();
}
