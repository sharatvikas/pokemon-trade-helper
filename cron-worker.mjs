/**
 * Standalone price polling worker.
 * Runs every 6 hours and hits the local Next.js /api/poll endpoint.
 *
 * Start with: node cron-worker.mjs
 * (Run this alongside `npm run dev` in a separate terminal)
 */

import cron from "node-cron";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function poll() {
  const now = new Date().toLocaleString();
  console.log(`[${now}] Polling prices…`);
  try {
    const res = await fetch(`${APP_URL}/api/poll`, { method: "POST" });
    const data = await res.json();
    console.log(`[${now}] Done — updated: ${data.updated}, alerts: ${data.alerts}`);
  } catch (err) {
    console.error(`[${now}] Poll failed:`, err.message);
  }
}

// Run immediately on start, then every 6 hours
poll();
cron.schedule("0 */6 * * *", poll);

console.log("Price polling worker started. Runs every 6 hours.");
console.log(`App URL: ${APP_URL}`);
