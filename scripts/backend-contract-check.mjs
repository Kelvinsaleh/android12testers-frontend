import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const read=(p)=>readFileSync(join(root,p),"utf8");
const source=read("backend/src/main.rs");
const errors=[];
const routes=[
  ["health endpoint",'.route("/healthz", get(health))','async fn health('],
  ["customer app listing",'.route("/api/apps", get(list_apps).post(create_app))','async fn list_apps('],
  ["customer app submission",'.route("/api/apps", get(list_apps).post(create_app))','async fn create_app('],
  ["tester list",'.route("/api/tester-list", post(get_tester_list))','async fn get_tester_list('],
  ["private evidence upload",'.route("/api/uploads", post(upload_evidence))','async fn upload_evidence('],
  ["Paystack checkout",'.route("/api/campaigns/{id}/checkout", post(start_checkout))','async fn start_checkout('],
  ["customer remedy request",'.route("/api/campaigns/{id}/retests", post(create_retest_request))','async fn create_retest_request('],
  ["payment verification",'.route("/api/payments/verify", post(verify_payment_endpoint))','async fn verify_payment_endpoint('],
  ["Paystack callback",'.route("/api/payments/callback", get(payment_callback))','async fn payment_callback('],
  ["Paystack webhook",'.route("/api/paystack/webhook", post(paystack_webhook))','async fn paystack_webhook('],
  ["admin campaign listing",'.route("/api/admin/campaigns", get(admin_list_campaigns))','async fn admin_list_campaigns('],
  ["admin campaign updates",'.route("/api/admin/campaigns/{id}", patch(admin_update_campaign))','async fn admin_update_campaign('],
  ["admin tester pool",'.route("/api/admin/testers", get(admin_get_testers).put(admin_replace_testers))','async fn admin_replace_testers('],
  ["admin retest queue",'.route("/api/admin/retests", get(admin_list_retests).patch(admin_decide_retest))','async fn admin_list_retests('],
  ["admin retest decisions",'.route("/api/admin/retests", get(admin_list_retests).patch(admin_decide_retest))','async fn admin_decide_retest('],
  ["admin webhook reconciliation",'.route("/api/admin/webhook-events", get(admin_list_failed_webhooks).patch(admin_retry_webhook))','async fn admin_retry_webhook('],
];
for(const [label,route,handler] of routes){if(!source.includes(route)||!source.includes(handler))errors.push(`Missing ${label}`)}
if(!source.includes('#[serde(rename_all = "camelCase", deny_unknown_fields)]\nstruct RetestInput'))errors.push("Retest API payload must accept frontend camelCase fields");
if(!source.includes("fn retest_request_accepts_frontend_camel_case_payload()"))errors.push("Missing regression test for retest request payload casing");
for(const f of ["backend/Cargo.toml","backend/Dockerfile","backend/.env.example","render.yaml","app/api/[...path]/route.ts","lib/backend-proxy.ts"])if(!existsSync(join(root,f)))errors.push(`Missing deployment source ${f}`);

if(!source.includes("struct CheckoutConsent"))errors.push("Checkout must require explicit legal-document acknowledgement");
if(!source.includes("consent.terms_version != TERMS_VERSION || consent.privacy_version != PRIVACY_VERSION"))errors.push("Checkout must reject stale legal-document versions");
if(!source.includes("legal_terms_version=$3,legal_privacy_version=$4,legal_accepted_at=now()"))errors.push("Checkout must persist the accepted legal-document versions");
if(!existsSync(join(root,"database/migrations/0007_legal_acceptance.sql")))errors.push("Missing legal acceptance migration");
if(!read("components/checkout-button.tsx").includes("I have read and agree"))errors.push("Checkout must show an explicit terms/privacy acknowledgement");

if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log(`Backend contract checks passed: ${routes.length} API route-handler pairs and deployment artifacts found.`);
