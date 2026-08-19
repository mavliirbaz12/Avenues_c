/**
 * E2E orchestrator.
 *
 *   node scripts/e2e.mjs [...playwright args]
 *
 * Prepares an isolated `avenues_test` database, builds the app, then hands off
 * to Playwright. Every step passes its connection variables explicitly rather
 * than relying on env-file resolution, so neither the dev nor the production
 * database can be reached even if a `.env` is sitting right there — and the
 * preflight below aborts the run if one of them somehow still is.
 *
 * Skip the rebuild with --no-build when iterating on specs.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const noBuild = argv.includes("--no-build");
const pwArgs = argv.filter((a) => a !== "--no-build");

// Mirrors e2e/utils/env.ts. Duplicated because this is a plain .mjs script and
// that file is TypeScript consumed by Playwright — keep the two in sync.
const TEST_DB_NAME = "avenues_test";
const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://avenues:avenues@localhost:5433/${TEST_DB_NAME}?schema=public`;

const env = {
  ...process.env,
  DATABASE_URL: TEST_DATABASE_URL,
  // DIRECT_DATABASE_URL is not optional here, and forgetting it was a live
  // near-miss. `prisma migrate` resolves `directUrl` from the schema, NOT
  // `url` — so with only DATABASE_URL overridden, `migrate deploy` connected
  // to whatever DIRECT_DATABASE_URL happened to be in `.env`, which on this
  // machine is the production Railway database. It reported "No pending
  // migrations to apply" and did no harm, but a single unapplied migration
  // would have been pushed to the live store by `npm run test:e2e`.
  DIRECT_DATABASE_URL: TEST_DATABASE_URL,
  SEED_ADMIN_EMAIL: "admin@test.dev",
  SEED_ADMIN_PASSWORD: "AdminTest!2026",
  SEED_ADMIN_NAME: "Test Admin",
};

/**
 * Refuse to run against anything that is not the local test database.
 *
 * The override above is the fix; this is the seatbelt. Prisma grows new
 * connection env vars over time (`directUrl` arrived with the Railway pooler
 * work), and each one is another chance for a production URL to leak into a
 * destructive step. Asserting on the values — rather than trusting that we
 * remembered to set them — is what makes the guarantee in this file's header
 * actually true.
 */
{
  const offenders = ["DATABASE_URL", "DIRECT_DATABASE_URL", "SHADOW_DATABASE_URL"]
    .map((key) => [key, env[key]])
    .filter(([, value]) => value)
    .filter(([, value]) => !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):5433\//.test(value))
    .concat(
      // Belt and braces: the database name itself must be unmistakable.
      TEST_DATABASE_URL.includes(`/${TEST_DB_NAME}`)
        ? []
        : [["E2E_DATABASE_URL", TEST_DATABASE_URL]],
    );

  if (offenders.length > 0) {
    console.error(
      `\n\x1b[31m✗ Refusing to run: a database URL does not point at localhost:5433/${TEST_DB_NAME}.\x1b[0m\n`,
    );
    for (const [key, value] of offenders) {
      // Host only — never print credentials.
      const host = String(value).replace(/^([a-z+]+:\/\/)[^@]*@/i, "$1<redacted>@");
      console.error(`    ${key} = ${host}`);
    }
    console.error(
      "\n  The E2E suite truncates and reseeds whatever it connects to.\n" +
        "  Fix the variable above, or unset it so the local default applies.\n",
    );
    process.exit(1);
  }
}

function run(cmd, args, opts = {}) {
  const useShell = process.platform === "win32";
  // With shell:true Windows re-splits argv on whitespace, so anything with a
  // space (`--grep some name`) arrives as several arguments. Quote them back.
  const safe = useShell
    ? args.map((a) => (/\s/.test(a) && !/^".*"$/.test(a) ? `"${a}"` : a))
    : args;

  const r = spawnSync(cmd, safe, {
    stdio: "inherit",
    shell: useShell,
    env,
    ...opts,
  });
  if (r.status !== 0) {
    console.error(`\n✗ ${cmd} ${args.join(" ")} exited ${r.status}`);
    process.exit(r.status ?? 1);
  }
  return r;
}

function step(msg) {
  console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
}

// --- 1. Create the test database if it isn't there -------------------------
step(`Ensuring database "${TEST_DB_NAME}" exists`);
{
  // `CREATE DATABASE` cannot run inside a transaction or with IF NOT EXISTS,
  // so check first. Runs inside the compose container to avoid needing psql on
  // the host.
  // SQL goes in on stdin, not as a -c argument. Windows `shell: true`
  // re-splits argv on spaces, which turns `CREATE DATABASE x OWNER y` into
  // five arguments and a syntax error.
  const psql = (sql, extraArgs = []) =>
    spawnSync(
      "docker",
      ["exec", "-i", "avenues-postgres", "psql", "-U", "avenues", "-d", "postgres", ...extraArgs],
      { encoding: "utf8", input: sql, shell: process.platform === "win32" },
    );

  const exists = psql(
    `SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}';`,
    ["-tA"],
  );

  if (exists.status !== 0) {
    console.error(
      "Could not reach the Postgres container. Is Docker running?\n" +
        "  docker compose up -d\n" +
        (exists.stderr ?? ""),
    );
    process.exit(1);
  }

  if (exists.stdout.trim() !== "1") {
    const created = psql(`CREATE DATABASE ${TEST_DB_NAME} OWNER avenues;`);
    if (created.status !== 0) {
      console.error(created.stderr);
      process.exit(1);
    }
    console.log(`  created ${TEST_DB_NAME}`);
  } else {
    console.log(`  ${TEST_DB_NAME} already present`);
  }
}

// --- 2. Schema + seed ------------------------------------------------------
step("Applying migrations");
run("npx", ["prisma", "migrate", "deploy"]);

step("Seeding catalogue");
run("npx", ["tsx", "prisma/seed.ts"]);

step("Seeding test users and fixtures");
run("npx", ["tsx", "e2e/utils/seed-test-data.ts"]);

// --- 3. Build --------------------------------------------------------------
if (!noBuild) {
  step("Building production bundle");
  run("npm", ["run", "build"]);
} else if (!existsSync(".next/BUILD_ID")) {
  console.error("\n--no-build passed but .next/BUILD_ID is missing. Build once first.");
  process.exit(1);
} else {
  step("Skipping build (--no-build)");
}

// --- 4. Playwright ---------------------------------------------------------
step("Running Playwright");
run("npx", ["playwright", "test", ...pwArgs]);
