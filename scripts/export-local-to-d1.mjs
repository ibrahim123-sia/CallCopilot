// Exports the local SQLite data (data/callcopilot.db) as SQL that can be imported into D1.
//
// Usage:
//   node scripts/export-local-to-d1.mjs [path/to/callcopilot.db] [output.sql]
//   npx wrangler d1 execute callcopilot --remote --file .wrangler/d1-import.sql
//
// Notes
// - Data only (the tables already exist in D1 after `npm run cf:db:migrate:remote`).
// - Rows are inserted parents first (clients → meetings → segments …) so foreign keys hold.
// - D1 rejects statements over 100 KB, so long text values are inserted in pieces:
//   INSERT with the first piece, then UPDATE … SET col = col || '<next piece>'.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.argv[2] || path.join(process.cwd(), "data", "callcopilot.db");
const outPath = process.argv[3] || path.join(process.cwd(), ".wrangler", "d1-import.sql");
const PIECE = 40_000; // characters per piece, well under the 100 KB statement limit

// Parent tables first so foreign keys are satisfied
const TABLES = [
  { name: "clients", key: "id" },
  { name: "meetings", key: "id" },
  { name: "transcript_segments", key: "id" },
  { name: "documents", key: "id" },
  { name: "chat_messages", key: "id" },
  { name: "settings", key: "key" },
];

const quote = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

if (!fs.existsSync(dbPath)) {
  console.error(`No local database at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const lines = [];
const counts = {};

for (const { name, key } of TABLES) {
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  counts[name] = rows.length;
  for (const row of rows) {
    const cols = Object.keys(row);
    const first = {};
    const rest = []; // [column, remaining pieces[]]
    for (const c of cols) {
      const v = row[c];
      if (typeof v === "string" && v.length > PIECE) {
        const pieces = v.match(new RegExp(`[\\s\\S]{1,${PIECE}}`, "g"));
        first[c] = pieces[0];
        rest.push([c, pieces.slice(1)]);
      } else {
        first[c] = v;
      }
    }
    lines.push(
      `INSERT OR IGNORE INTO ${name} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((c) => quote(first[c])).join(", ")});`
    );
    for (const [c, pieces] of rest) {
      for (const p of pieces) {
        lines.push(`UPDATE ${name} SET "${c}" = "${c}" || ${quote(p)} WHERE "${key}" = ${quote(row[key])};`);
      }
    }
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${lines.length} statements to ${path.relative(process.cwd(), outPath)}`);
console.log("Rows:", counts);
console.log(`Next: npx wrangler d1 execute callcopilot --remote --file ${path.relative(process.cwd(), outPath)}`);
