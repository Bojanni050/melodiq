/**
 * Compares the two schema sources this repo maintains by hand:
 *
 *   1. src/db/init.ts + ensureWorkspaceSchema()  - runs on every startup via
 *      instrumentation.ts, and is what actually maintains a deployed database.
 *   2. drizzle/*.sql in _journal.json order       - applied manually via
 *      `npm run db:migrate`.
 *
 * They drifted badly once (three tables and a column that lib/releases.ts
 * selects existed in only one of them), so this rebuilds both into throwaway
 * databases and diffs the result out of information_schema. Anything it prints
 * is a real difference that will bite whichever deployment path is used.
 *
 * Usage:  npm run db:check-drift
 * Needs:  a reachable postgres superuser; DATABASE_URL is used only for
 *         credentials, never touched itself.
 *
 * Exits 1 when the two sources disagree.
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";

const DB_INIT = "melodiq_drift_check_init";
const DB_MIG = "melodiq_drift_check_mig";

function adminUrl() {
  const configured = process.env.DATABASE_URL;
  if (!configured) return "postgres://postgres:postgres@localhost:5432/postgres";
  const url = new URL(configured);
  url.pathname = "/postgres";
  return url.toString();
}

function baseUrl(dbName) {
  const url = new URL(adminUrl());
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** Extract a `const NAME = ` ... ` ;` template literal without regex escaping games. */
function templateLiteral(src, name) {
  const marker = `const ${name} = `;
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`could not find ${name} in source`);
  const open = src.indexOf("`", at + marker.length);
  const close = src.indexOf("`", open + 1);
  if (open < 0 || close < 0) throw new Error(`could not read the ${name} literal`);
  return src.slice(open + 1, close);
}

const initSrc = fs.readFileSync("src/db/init.ts", "utf8");
const wsSrc = fs.readFileSync("src/lib/workspaces.ts", "utf8");

// initializeDatabase() splits most blobs on ";" but runs the DO $$ ... $$ block
// whole, because splitting it would cut the dollar-quoted body in half. Mirror
// that exactly, or this script reports failures the real startup never hits.
const splitBlobs = [
  "createTablesSql",
  "alterUsersSql",
  "alterTracksSql",
  "alterPlaylistsSql",
  "alterReleasesSql",
  "dropSongsSql",
];
const wholeBlobs = ["tracksWorkspaceFkSql", "completedAtTriggerSql"];

const initStatements = [];
for (const name of splitBlobs) initStatements.push(...templateLiteral(initSrc, name).split(";"));
for (const name of wholeBlobs) initStatements.push(templateLiteral(initSrc, name));

// ensureWorkspaceSchema issues each statement as db.execute(sql`...`)
{
  const re = /db\.execute\(sql`/g;
  let m;
  while ((m = re.exec(wsSrc)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = wsSrc.indexOf("`", open + 1);
    initStatements.push(wsSrc.slice(open + 1, close));
  }
}

const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
const migStatements = [];
for (const entry of journal.entries) {
  const file = path.join("drizzle", `${entry.tag}.sql`);
  migStatements.push(...fs.readFileSync(file, "utf8").split("--> statement-breakpoint"));
}

async function withAdmin(fn) {
  const client = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function apply(dbName, statements, label) {
  const client = postgres(baseUrl(dbName), { max: 1, onnotice: () => {} });
  const failures = [];
  try {
    for (const statement of statements) {
      // Strip leading comment lines rather than skipping the whole chunk — a
      // migration statement is often preceded by a comment explaining it.
      const trimmed = statement
        .split("\n")
        .filter((line, i, lines) => !(line.trim().startsWith("--") && lines.slice(0, i).every((l) => !l.trim() || l.trim().startsWith("--"))))
        .join("\n")
        .trim();
      if (!trimmed) continue;
      try {
        await client.unsafe(trimmed);
      } catch (error) {
        failures.push(`${trimmed.slice(0, 90).replace(/\s+/g, " ")} -> ${error.message}`);
      }
    }
  } finally {
    await client.end();
  }
  if (failures.length) {
    console.log(`\n${label}: ${failures.length} statement(s) failed to apply:`);
    for (const f of failures) console.log(`  ${f}`);
  }
  return failures.length;
}

async function introspect(dbName) {
  const client = postgres(baseUrl(dbName), { max: 1, onnotice: () => {} });
  try {
    const cols = await client`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' order by 1, 2`;
    const idx = await client`
      select indexname from pg_indexes where schemaname = 'public' order by 1`;
    const byTable = new Map();
    for (const row of cols) {
      if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Set());
      byTable.get(row.table_name).add(row.column_name);
    }
    return { byTable, indexes: new Set(idx.map((r) => r.indexname)) };
  } finally {
    await client.end();
  }
}

let problems = 0;

await withAdmin(async (client) => {
  for (const db of [DB_INIT, DB_MIG]) {
    await client.unsafe(`DROP DATABASE IF EXISTS "${db}"`);
    await client.unsafe(`CREATE DATABASE "${db}"`);
  }
});

try {
  problems += await apply(DB_INIT, initStatements, "init.ts");
  problems += await apply(DB_MIG, migStatements, "drizzle migrations");

  const a = await introspect(DB_INIT);
  const b = await introspect(DB_MIG);

  const tables = [...new Set([...a.byTable.keys(), ...b.byTable.keys()])].sort();
  const lines = [];

  for (const table of tables) {
    const fromInit = a.byTable.get(table);
    const fromMig = b.byTable.get(table);
    if (!fromInit) {
      lines.push(`TABLE ${table}: created by migrations only, init.ts never creates it`);
      continue;
    }
    if (!fromMig) {
      lines.push(`TABLE ${table}: created by init.ts only, no migration creates it`);
      continue;
    }
    const onlyInit = [...fromInit].filter((c) => !fromMig.has(c)).sort();
    const onlyMig = [...fromMig].filter((c) => !fromInit.has(c)).sort();
    if (onlyInit.length) lines.push(`${table}: only init.ts has ${onlyInit.join(", ")}`);
    if (onlyMig.length) lines.push(`${table}: only migrations have ${onlyMig.join(", ")}`);
  }

  // Index names differ harmlessly between the two (an inline UNIQUE gets a
  // _key suffix, a named constraint gets _unique), so compare only the ones
  // both sides are supposed to declare explicitly.
  const ignorable = /(_pkey|_key|_unique)$/;
  const onlyInitIdx = [...a.indexes].filter((i) => !b.indexes.has(i) && !ignorable.test(i)).sort();
  const onlyMigIdx = [...b.indexes].filter((i) => !a.indexes.has(i) && !ignorable.test(i)).sort();
  if (onlyInitIdx.length) lines.push(`INDEXES only in init.ts: ${onlyInitIdx.join(", ")}`);
  if (onlyMigIdx.length) lines.push(`INDEXES only in migrations: ${onlyMigIdx.join(", ")}`);

  if (lines.length) {
    problems += lines.length;
    console.log("\nSchema drift between init.ts and the migration chain:\n");
    for (const line of lines) console.log(`  ${line}`);
    console.log("\nBoth sources must produce the same schema — whichever path a");
    console.log("deployment takes, the app expects everything in src/db/schema.ts.");
  } else {
    console.log("\nNo drift: init.ts and the migration chain produce the same schema.");
  }
} finally {
  await withAdmin(async (client) => {
    for (const db of [DB_INIT, DB_MIG]) {
      await client.unsafe(`DROP DATABASE IF EXISTS "${db}"`);
    }
  });
}

process.exit(problems > 0 ? 1 : 0);
