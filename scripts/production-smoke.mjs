#!/usr/bin/env node
import process from "node:process";

const apiBase = (process.env.API_BASE_URL || "").replace(/\/+$/, "");
const siteBase = (process.env.SITE_URL || "").replace(/\/+$/, "");

if (!apiBase || !siteBase) {
  console.error("Usage: API_BASE_URL=https://...onrender.com SITE_URL=https://android12testers.com npm run smoke:production");
  process.exit(2);
}

const checks = [];
async function check(name, fn) {
  try {
    const result = await fn();
    checks.push({ name, ok: true, detail: result || "passed" });
  } catch (error) {
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

async function request(url, init) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), ...init });
}

await check("Render health endpoint", async () => {
  const response = await request(`${apiBase}/healthz`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.ok !== true || data.database !== "ready" || data.evidenceStorage !== true) {
    throw new Error(`Unexpected health body: ${JSON.stringify(data)}`);
  }
  return "API, Neon database and R2 storage report ready";
});

await check("Protected administrator endpoint rejects anonymous request", async () => {
  const response = await request(`${apiBase}/api/admin/retests`);
  if (response.status !== 401) throw new Error(`Expected HTTP 401, received ${response.status}`);
  return "HTTP 401 as expected";
});

await check("Paystack webhook rejects unsigned payload", async () => {
  const response = await request(`${apiBase}/api/paystack/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "charge.success", data: { reference: "SMOKE-UNSIGNED" } }),
  });
  if (response.status !== 401) throw new Error(`Expected HTTP 401, received ${response.status}`);
  return "HTTP 401 as expected";
});

await check("Public website homepage", async () => {
  const response = await request(siteBase);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (!html.toLowerCase().includes("android testers")) throw new Error("Homepage title/content was not found");
  return `HTTP ${response.status}`;
});

await check("Sitemap is publicly reachable", async () => {
  const response = await request(`${siteBase}/sitemap.xml`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  if (!xml.includes("<urlset") || !xml.includes("android12testers.com")) throw new Error("Unexpected sitemap content");
  return `HTTP ${response.status}`;
});

for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`);
}
const failed = checks.filter((item) => !item.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} production smoke checks passed.`);
if (failed) process.exit(1);
