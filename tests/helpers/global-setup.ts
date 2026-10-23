// Starts a throw-away PostgreSQL for integration tests and applies migrations.
// Set TEST_DATABASE_URL to use an existing (empty!) database instead (e.g. CI).
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export default async function setup(project: TestProject) {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let teardown: (() => Promise<void>) | undefined;

  if (!databaseUrl) {
    const port = await freePort();
    const dir = mkdtempSync(path.join(tmpdir(), "hussio-test-pg-"));
    const pg = new EmbeddedPostgres({
      databaseDir: path.join(dir, "data"),
      user: "postgres",
      password: "postgres",
      port,
      persistent: false,
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("hussio_test");
    databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/hussio_test`;
    teardown = async () => {
      await pg.stop();
      rmSync(dir, { recursive: true, force: true });
    };
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  process.env.DATABASE_URL = databaseUrl;
  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await teardown?.();
  };
}
