#!/usr/bin/env node
// Mint Meridian API keys.
//
// Usage:
//   node mint-key.mjs --email <analyst_email> [--learner <id>] [--label <text>]
//   node mint-key.mjs --demo        # mints one Type-A + one Type-B key
//
// Stores sha256(key) in meridian.api_keys mapped to the analyst. Prints the
// PLAINTEXT key once — it is never recoverable afterward.
//
// Resolves `pg` from platform/web/node_modules (this script has no deps of its
// own), so it runs from anywhere:
//   node platform/db/mint-key.mjs --demo
//
// DB URL: MERIDIAN_DB_URL env, else the local docker default.

import { randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Resolve `pg` from the sibling web app's node_modules regardless of cwd.
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "..", "web", "package.json"));
const pg = require("pg");

const { Client } = pg;

const CONNECTION_STRING =
  process.env.MERIDIAN_DB_URL ||
  "postgresql://meridian:meridian@localhost:5432/meridian";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--demo") args.demo = true;
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--learner") args.learner = argv[++i];
    else if (a === "--label") args.label = argv[++i];
  }
  return args;
}

function generateKey() {
  return `mrdn_${randomBytes(16).toString("hex")}`; // mrdn_<32 hex>
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

async function mintForAnalyst(client, analyst, label) {
  const key = generateKey();
  const keyHash = hashKey(key);
  await client.query(
    `INSERT INTO meridian.api_keys (key_hash, analyst_id, learner_id, label)
     VALUES ($1, $2, $3, $4)`,
    [keyHash, analyst.analyst_id, analyst.learner_id, label]
  );
  return key;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ssl = CONNECTION_STRING.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false };
  const client = new Client({ connectionString: CONNECTION_STRING, ssl });
  await client.connect();

  try {
    if (args.demo) {
      const { rows } = await client.query(
        `(SELECT analyst_id, full_name, email, scope, learner_id
            FROM meridian.analysts WHERE scope = 'type_a' ORDER BY analyst_id LIMIT 1)
         UNION ALL
         (SELECT analyst_id, full_name, email, scope, learner_id
            FROM meridian.analysts WHERE scope = 'type_b' ORDER BY analyst_id LIMIT 1)`
      );
      if (rows.length < 2) {
        throw new Error(
          "Could not find both a type_a and a type_b seeded analyst."
        );
      }
      console.log("Minted demo keys (store these — shown once):\n");
      for (const a of rows) {
        const key = await mintForAnalyst(client, a, `demo ${a.scope}`);
        console.log(`  scope=${a.scope}`);
        console.log(`    analyst : ${a.full_name} <${a.email}> (id ${a.analyst_id})`);
        console.log(`    learner : ${a.learner_id ?? "(none)"}`);
        console.log(`    KEY     : ${key}\n`);
      }
      return;
    }

    if (!args.email) {
      console.error(
        "Usage: node mint-key.mjs --email <analyst_email> [--learner <id>] [--label <text>]\n" +
          "   or: node mint-key.mjs --demo"
      );
      process.exitCode = 1;
      return;
    }

    const { rows } = await client.query(
      `SELECT analyst_id, full_name, email, scope, learner_id
         FROM meridian.analysts
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [args.email]
    );
    const analyst = rows[0];
    if (!analyst) {
      throw new Error(`No analyst found with email '${args.email}'.`);
    }
    // CLI --learner overrides the seeded learner_id for this key.
    if (args.learner) analyst.learner_id = args.learner;

    const label = args.label ?? `key for ${analyst.email}`;
    const key = await mintForAnalyst(client, analyst, label);
    console.log("Minted API key (store it — shown once):\n");
    console.log(`  analyst : ${analyst.full_name} <${analyst.email}> (id ${analyst.analyst_id})`);
    console.log(`  scope   : ${analyst.scope}`);
    console.log(`  learner : ${analyst.learner_id ?? "(none)"}`);
    console.log(`  label   : ${label}`);
    console.log(`  KEY     : ${key}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("mint-key failed:", err.message);
  process.exit(1);
});
