/**
 * Runs a command against a real, throwaway PostgreSQL instance.
 *
 * Uses `embedded-postgres`, which runs official PostgreSQL binaries as an
 * ordinary user process — no Docker daemon, no admin rights, no system changes.
 * That keeps schema validation and integration tests runnable anywhere,
 * including CI. `docker compose up` remains available for running the whole
 * stack; this is purely for tooling and tests.
 *
 * Usage: node scripts/with-db.mjs <command> [...args]
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(HERE, "..");

export const DB_NAME = "lavimd_test";
export const DB_USER = "postgres";
export const DB_PASSWORD = "postgres";
export const DB_PORT = Number(process.env.TEST_DB_PORT ?? 55432);

export function databaseUrl(port = DB_PORT, database = DB_NAME) {
  return `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${port}/${database}?schema=public`;
}

/**
 * Starts a clean PostgreSQL instance. The data directory is recreated every
 * time, so every run starts from an empty database — exactly what we want when
 * validating that migrations apply from scratch.
 */
export async function startDatabase({ port = DB_PORT, dataDir } = {}) {
  const directory = dataDir ?? join(API_ROOT, ".pgdata");

  if (existsSync(directory)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  mkdirSync(directory, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: directory,
    user: DB_USER,
    password: DB_PASSWORD,
    port,
    persistent: true,
    onLog: () => {
      /* PostgreSQL's own startup chatter is noise for our output */
    },
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);

  return {
    url: databaseUrl(port),
    async stop() {
      try {
        await pg.stop();
      } catch {
        // Server already gone; nothing to clean up.
      }
    },
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === undefined) {
    console.error("usage: node scripts/with-db.mjs <command> [...args]");
    process.exit(2);
  }

  const db = await startDatabase();
  console.log(`[with-db] PostgreSQL ready at ${db.url}`);

  const child = spawn(command, args, {
    cwd: API_ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: db.url },
  });

  const code = await new Promise((resolve) => {
    child.on("exit", (exitCode) => resolve(exitCode ?? 1));
    child.on("error", () => resolve(1));
  });

  await db.stop();
  process.exit(code);
}

// Only run the CLI when invoked directly, so tests can import the helpers.
if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith("with-db.mjs") &&
  process.argv[1].endsWith("with-db.mjs")
) {
  await main();
}
