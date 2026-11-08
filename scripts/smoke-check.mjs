import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const site = read("lib/site.ts");
const routes = [...site.matchAll(/^\s*"(\/[^"]*)",?\s*$/gm)].map((match) => match[1]);
const errors = [];
for (const route of routes) {
  const relative = route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
  if (!existsSync(join(root, relative))) errors.push(`Missing public route file: ${relative}`);
}
const home = read("app/page.tsx");
const price = read("app/pricing/page.tsx");
const faq = read("lib/content.ts");
const robots = read("app/robots.ts");
const sitemap = read("app/sitemap.ts");
const env = read(".env.example");
const siteConfig = read("lib/site.ts");
const contact = read("app/contact/page.tsx");
const layout = read("app/layout.tsx");
const whatsapp = read("components/whatsapp-support.tsx");
const footer = read("components/site-footer.tsx");
const backend = read("backend/src/main.rs");
const packageJson = JSON.parse(read("package.json"));

for (const [label, ok] of [
  ["home states the 12-person tester service", home.includes("12 real testers")],
  ["home states 15 days", home.includes("15 focused days")],
  ["home states $10", home.includes("$10")],
  ["pricing states $10", price.includes("$10")],
  ["production access is not guaranteed", faq.includes("No. Android Testers can coordinate")],
  ["robots config exists", robots.includes("MetadataRoute.Robots")],
  ["sitemap maps public routes", sitemap.includes("publicRoutes.map")],
  ["backend URL is server-only", env.includes("BACKEND_API_URL=") && !env.includes("NEXT_PUBLIC_BACKEND")],
  ["Neon Auth endpoint is configured as a public endpoint", env.includes("NEON_AUTH_BASE_URL=https://ep-sparkling-tree-bdsqsqc8.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth")],
  ["database URL is not present in the Vercel environment template", !env.includes("DATABASE_URL=")],
  ["all database migrations exist", [1,2,3,4,5,6].every((n) => existsSync(join(root, `database/migrations/${String(n).padStart(4,"0")}_${["initial_schema","campaign_completed_at","retest_requested_remedy","campaign_day_checkins","campaign_day_checkin_key","durable_paystack_webhook_queue"][n-1]}.sql`)))],
  ["WhatsApp support number is configured", siteConfig.includes("254742608319") && siteConfig.includes("+254 742 608 319")],
  ["contact page offers WhatsApp support", contact.includes("siteConfig.whatsappUrl") && contact.includes("Chat on WhatsApp")],
  ["site-wide WhatsApp support widget is rendered", layout.includes("<WhatsAppSupport />") && whatsapp.includes("siteConfig.whatsappUrl")],
  ["footer exposes WhatsApp support", footer.includes("WhatsApp support") && footer.includes("siteConfig.whatsappUrl")],
  ["Render service blueprint exists", existsSync(join(root, "render.yaml"))],
  ["Render backend has a health route", backend.includes('.route("/healthz", get(health))')],
  ["Rust backend startup exists", backend.includes("async fn main()") && backend.includes("axum::serve(listener")],
  ["no old Next API business routes remain", existsSync(join(root, "app/api/[...path]/route.ts")) && !existsSync(join(root, "app/api/apps/route.ts"))],
  ["Neon Auth catch-all remains on Vercel", existsSync(join(root, "app/api/auth/[...path]/route.ts"))],
  ["Vercel build command is configured", packageJson.scripts.build === "next build" && read("vercel.json").includes("npm install")],
]) if (!ok) errors.push(`Failed content check: ${label}`);

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Content/deployment smoke checks passed: ${routes.length} public routes and Render/Vercel architecture declarations.`);
