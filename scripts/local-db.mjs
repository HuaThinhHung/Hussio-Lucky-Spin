// Local PostgreSQL for development without Docker or a system install.
// Uses the `embedded-postgres` package (real PostgreSQL binaries, dev-only).
//
//   npm run db:local        -> start Postgres on 127.0.0.1:5544 (Ctrl+C to stop)
//
// Matching DATABASE_URL (see .env.example):
//   postgresql://postgres:postgres@127.0.0.1:5544/hussio_lucky_spin
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5544);
const DB_NAME = process.env.LOCAL_DB_NAME ?? "hussio_lucky_spin";
const dataDir = path.resolve(process.cwd(), ".local-db", "data");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {},
});

const firstRun = !existsSync(path.join(dataDir, "PG_VERSION"));
if (firstRun) {
  console.log("[local-db] Initialising data directory", dataDir);
  await pg.initialise();
}

await pg.start();

if (firstRun) {
  await pg.createDatabase(DB_NAME);
  console.log(`[local-db] Created database "${DB_NAME}"`);
}

console.log(
  `[local-db] PostgreSQL ready: postgresql://postgres:postgres@127.0.0.1:${PORT}/${DB_NAME}`,
);
console.log("[local-db] Press Ctrl+C to stop.");

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive while the cluster runs.
setInterval(() => {}, 1 << 30);
