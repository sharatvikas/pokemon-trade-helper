#!/usr/bin/env node
/**
 * Poke Trade Helper — Interactive setup script
 * Run with: node setup.mjs
 *
 * Reads existing .env.local values so you can update only what changed.
 */

import { createInterface } from "readline";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ENV_PATH = join(process.cwd(), ".env.local");

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseEnv(content) {
  const map = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    map[key] = val;
  }
  return map;
}

function mask(value) {
  if (!value || value.includes("YOUR_") || value.includes("sk-ant")) return null;
  if (value.length <= 6) return "***";
  return value.slice(0, 3) + "*".repeat(Math.min(value.length - 3, 8));
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    if (rl.closed) { resolve(""); return; }
    const onClose = () => resolve("");
    rl.once("close", onClose);
    rl.question(question, (answer) => {
      rl.removeListener("close", onClose);
      resolve(answer);
    });
  });
}

function color(code, text) {
  return `\x1b[${code}m${text}\x1b[0m`;
}
const bold  = (t) => color("1", t);
const dim   = (t) => color("2", t);
const cyan  = (t) => color("36", t);
const green = (t) => color("32", t);
const yellow= (t) => color("33", t);

// ── Load existing values ──────────────────────────────────────────────────────

const existing = existsSync(ENV_PATH)
  ? parseEnv(readFileSync(ENV_PATH, "utf8"))
  : {};

// ── Fields ───────────────────────────────────────────────────────────────────

const fields = [
  {
    key: "DATABASE_URL",
    label: "Database path",
    default: "file:./prisma/dev.db", // must match .env DATABASE_URL
    hint: "SQLite file location — leave as-is for local use",
    sensitive: false,
  },
  {
    key: "EBAY_APP_ID",
    label: "eBay App ID",
    default: "",
    hint: [
      "1. Go to " + cyan("https://developer.ebay.com") + " and sign in",
      "   2. Click 'Get Application Keys' → create a Production keyset",
      "   3. Copy the 'App ID (Client ID)'",
    ].join("\n"),
    sensitive: true,
  },
  {
    key: "GMAIL_USER",
    label: "Gmail address (sender + recipient)",
    default: "sharatvikas@gmail.com",
    hint: "Email address for sending and receiving price alerts",
    sensitive: false,
  },
  {
    key: "GMAIL_APP_PASSWORD",
    label: "Gmail App Password",
    default: "",
    hint: [
      "1. Go to " + cyan("https://myaccount.google.com/apppasswords"),
      "   2. Select app: Mail, device: Other → name it 'poke-trade'",
      "   3. Copy the 16-character password (no spaces)",
    ].join("\n"),
    sensitive: true,
  },
  {
    key: "NOTIFICATION_EMAIL",
    label: "Notification recipient email",
    default: "sharatvikas@gmail.com",
    hint: "Where price alert emails will be delivered",
    sensitive: false,
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API key",
    default: "",
    hint: [
      "1. Go to " + cyan("https://console.anthropic.com/keys"),
      "   2. Create a new key and paste it here",
    ].join("\n"),
    sensitive: true,
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "App URL",
    default: "http://localhost:3000",
    hint: "Change only if you run the app on a different port",
    sensitive: false,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log("\n" + bold("🃏  Poke Trade Helper — Setup"));
console.log(dim("─".repeat(50)));
if (existsSync(ENV_PATH)) {
  console.log(yellow("  Existing .env.local found — press Enter to keep current values.\n"));
} else {
  console.log(dim("  No .env.local found — creating one now.\n"));
}

const results = {};

for (const field of fields) {
  const current = existing[field.key];
  const hasCurrent = current && !current.includes("YOUR_");
  const fallback = hasCurrent ? current : field.default;

  console.log(bold(`  ${field.label}`));
  if (field.hint) {
    for (const line of field.hint.split("\n")) {
      console.log(dim(`  ${line}`));
    }
  }

  let placeholder;
  if (hasCurrent) {
    placeholder = field.sensitive ? mask(current) : current;
    placeholder = `[${green(placeholder ?? "set")}] `;
  } else if (field.default) {
    placeholder = `[${dim(field.default)}] `;
  } else {
    placeholder = "";
  }

  const answer = await prompt(rl, `  → ${placeholder}`);
  results[field.key] = answer.trim() || fallback || "";
  console.log();
}

rl.close();

// ── Write ─────────────────────────────────────────────────────────────────────

const content = `# Generated by setup.mjs — ${new Date().toLocaleString()}

# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL="${results.DATABASE_URL}"

# ── eBay API ─────────────────────────────────────────────────────────────────
EBAY_APP_ID="${results.EBAY_APP_ID}"

# ── Gmail (email alerts) ──────────────────────────────────────────────────────
GMAIL_USER="${results.GMAIL_USER}"
GMAIL_APP_PASSWORD="${results.GMAIL_APP_PASSWORD}"
NOTIFICATION_EMAIL="${results.NOTIFICATION_EMAIL}"

# ── Anthropic (card image identification) ─────────────────────────────────────
ANTHROPIC_API_KEY="${results.ANTHROPIC_API_KEY}"

# ── App URL ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="${results.NEXT_PUBLIC_APP_URL}"
`;

writeFileSync(ENV_PATH, content, "utf8");

console.log(green(bold("  ✓ .env.local saved!\n")));

// ── Check for missing required values ─────────────────────────────────────────

const required = ["ANTHROPIC_API_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD"];
const missing = required.filter((k) => !results[k] || results[k].includes("YOUR_"));

if (missing.length > 0) {
  console.log(yellow("  ⚠  Still missing:"));
  for (const k of missing) console.log(yellow(`     • ${k}`));
  console.log(yellow("  Run `node setup.mjs` again to fill them in.\n"));
} else {
  console.log(dim("  To start the app:"));
  console.log(cyan("    npm run dev") + dim("     # Terminal 1 — web app"));
  console.log(cyan("    npm run worker") + dim("  # Terminal 2 — price poller\n"));
}
}

main().catch(console.error);
