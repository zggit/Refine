/**
 * Run: node supabase/run-seed.mjs <PERSONAL_ACCESS_TOKEN>
 *
 * Applies supabase/seed.sql via the Supabase Management API.
 *
 * Get a Personal Access Token (PAT) from:
 *   https://supabase.com/dashboard/account/tokens  → "Generate new token"
 *
 * Example:
 *   node supabase/run-seed.mjs sbp_xxxxxxxxxxxx
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROJECT_REF = "quzdhrpthwzgmyuwovrq";

const pat = process.argv[2];
if (!pat) {
  console.error("Usage: node supabase/run-seed.mjs <PERSONAL_ACCESS_TOKEN>");
  console.error(
    "  Get a PAT at: https://supabase.com/dashboard/account/tokens"
  );
  process.exit(1);
}

const __dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dir, "seed.sql"), "utf8");

// Split into individual statements for progress reporting
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Sending ${statements.length} SQL statements to Supabase…\n`);

let ok = 0;
let failed = 0;

for (const stmt of statements) {
  const preview = stmt.slice(0, 70).replace(/\s+/g, " ");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify({ query: stmt + ";" }),
    }
  );

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body?.message ?? body?.error ?? "").toString();
    // Treat "already exists" as a no-op so the script stays idempotent
    if (/already exists|duplicate/i.test(msg)) {
      console.log(`  SKIP (already exists): ${preview}…`);
      ok++;
    } else {
      console.error(`  FAIL [HTTP ${res.status}]: ${preview}…`);
      console.error("        Error:", msg || JSON.stringify(body));
      failed++;
    }
  } else {
    console.log(`  OK: ${preview}…`);
    ok++;
  }
}

console.log(`\nDone — ${ok} ok, ${failed} failed.`);
if (failed > 0) process.exit(1);
