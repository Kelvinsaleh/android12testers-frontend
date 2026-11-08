# Android Testers — Vercel frontend + Render API

Android Testers is a customer portal and campaign operations system for genuine Google Play closed-testing services.

## Business rules

- One fixed price: **USD $10 per campaign**.
- Each campaign uses the same pool of **12 human testers**.
- The **15 consecutive 24-hour-day clock** starts only after all 12 testers have been individually confirmed opted in.
- The 12-person pool supports one enrolling/running campaign at a time. Paid orders wait in `paid_queued`; they are not promised overlapping start dates.
- The only administrator is the verified Google account `sksalee071@gmail.com`.
- Customers choose either a complimentary retest or a refund when submitting a remedy request. The administrator can approve only the remedy selected by the customer or decline with a recorded reason.
- Google decides whether a developer account receives production access. Android Testers does not guarantee production approval.

## Production architecture

```text
Browser
  |
  v
Vercel — Next.js frontend (android12testers.com)
  |  Neon Auth manages Google sign-in/session
  |  Short-lived HMAC assertion signed server-side
  v
Render — Rust + Axum API
  |---- Neon PostgreSQL (pooled connection; private backend only)
  |---- Paystack API + signed webhook
  |---- Cloudflare R2 (private evidence screenshots)
  |---- Resend (optional transactional email)
```

**The business API is Rust/Axum on Render.** Next.js API routes are reduced to a same-origin server proxy. They validate the Neon Auth session server-side and mint a 120-second HMAC-signed assertion. The browser never receives the shared proxy secret and Render does not trust browser-supplied identity headers or roles. Google sign-in remains managed by Neon Auth through the Next.js frontend.

The Neon Auth JWKS URL supplied during setup is not required by the Render service: Render does not accept Neon bearer tokens directly. It accepts only the short-lived assertion signed by the Vercel server after the Neon Auth server session has been read. The Vercel frontend uses `NEON_AUTH_BASE_URL`.

## Main workflows

### Customer

1. Sign in with Google.
2. View the 12 current tester Google accounts after the owner has configured them.
3. Add the addresses to the Play Console closed-test email list, enable Kenya, publish the test and copy the opt-in URL.
4. Submit the app name, package name, opt-in URL, attestations and 2–4 evidence screenshots.
5. Wait for the owner to review the setup evidence.
6. After approval, start a unique Paystack checkout for exactly USD $10.
7. Paystack is verified server-side using the amount, currency, reference, customer email and campaign metadata. Only a verified transaction enters the paid queue.
8. Follow campaign status in the customer dashboard.
9. After completion, request a review and choose either a complimentary retest or refund.

### Owner / administrator

Only the verified identity `sksalee071@gmail.com` can access the administrator API. The server checks this before querying the retest queue or processing privileged mutations.

The admin workspace supports:

- Configuring the 12-address tester pool before customers can see it. The pool locks after the first customer receives the addresses.
- Reviewing submissions and private evidence links.
- Approving setup or requesting corrections.
- Assigning all 12 testers to the next paid/complimentary campaign.
- Recording opt-in and opt-out status.
- Recording one genuine participation note per tester per campaign day.
- Resetting the complete 15-day cohort clock if a tester opts out.
- Completing a campaign only after 15 full days, with all 12 still opted in and 15 dated notes for each tester.
- Viewing pending retest/refund requests, approving the customer's chosen remedy, or declining with a reason.
- Viewing refunds that require provider reconciliation and reviewing an audit log.

Tester opt-in and daily activity are manually recorded by the administrator. The website does not connect to a developer's Play Console and does not fabricate tester participation. Only record genuine testing activity that actually took place.

## Repository structure

```text
app/                         Next.js public pages and customer/admin portal
app/api/auth/[...path]/      Neon Auth managed routes
app/api/[...path]/           Same-origin authenticated proxy to Render
backend/                     Rust/Axum API and Dockerfile for Render
  src/main.rs
  Cargo.toml
  Dockerfile
database/migrations/          Ordered Neon PostgreSQL migrations
components/                   Frontend components
lib/auth/                     Neon Auth client/server setup
lib/backend-proxy.ts           Short-lived signed assertion + backend URL helper
lib/session.ts                 Server-side Neon Auth session / admin identity
render.yaml                   Render Blueprint for backend deployment
vercel.json                    Vercel Next.js build configuration
```

## Neon database setup

**Security:** the database connection string pasted into chat contained a real database password. Treat it as exposed and reset/rotate that password in the Neon Console before using the database in production. Do not reuse the exposed password. No connection string or password is stored in this repository.

1. Open the Neon project and rotate the password for `neondb_owner` (or create a dedicated runtime role with access to the application tables). Copy the new pooled connection string. Ensure the host is the pooled `-pooler` hostname and `sslmode=require` is present. The backend normalizes the URL for SQLx 0.8 by removing the unsupported `channel_binding` query option while preserving mandatory TLS (`sslmode=require`).
2. Keep the new `DATABASE_URL` for Render only. Do not add it to Vercel, `NEXT_PUBLIC_*`, GitHub, README files, or the frontend environment template.
3. Apply the SQL migrations to the `neondb` database, in this exact order:

   - `database/migrations/0001_initial_schema.sql`
   - `database/migrations/0002_campaign_completed_at.sql`
   - `database/migrations/0003_retest_requested_remedy.sql`
   - `database/migrations/0004_campaign_day_checkins.sql`
   - `database/migrations/0005_campaign_day_checkin_key.sql`
   - `database/migrations/0006_durable_paystack_webhook_queue.sql`
   - `database/migrations/0007_legal_acceptance.sql`

   Easiest option: open `database/neon_setup_all.sql`, copy its full contents into the Neon SQL Editor, and run it once. It contains all seven migrations in order. Alternatively, paste/run each file individually in order, or use a local terminal with `psql`:

   ```bash
   export DATABASE_URL='YOUR_NEW_NEON_POOLED_CONNECTION_STRING'
   for file in database/migrations/000*.sql; do
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
   done
   ```

   PowerShell equivalent:

   ```powershell
   $env:DATABASE_URL = 'YOUR_NEW_NEON_POOLED_CONNECTION_STRING'
   Get-ChildItem .\database\migrations\000*.sql | Sort-Object Name | ForEach-Object {
     psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
     if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
   }
   ```

4. Confirm the tables exist: `app_users`, `apps`, `campaigns`, `uploads`, `testers`, `tester_pool_state`, `campaign_testers`, `campaign_tester_checkins`, `payments`, `campaign_events`, `retest_requests`, `refunds`, `admin_audit_logs`, `request_rate_limits`, and `paystack_webhook_events`.
5. Do not seed tester emails in SQL or commit them. Enter the exact 12 verified Google account addresses through the private admin workspace after deployment.

The migration files intentionally do not contain the 12 tester email addresses. `database/neon_setup_all.sql` is a convenience concatenation of migrations 0001–0006; the separate files remain the canonical ordered migration history.

## Neon Auth / Google OAuth setup

The Neon Auth base URL supplied for the project is:

```text
https://ep-sparkling-tree-bdsqsqc8.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth
```

The supplied JWKS endpoint is:

```text
https://ep-sparkling-tree-bdsqsqc8.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json
```

1. In Neon, confirm Neon Auth is enabled for the correct project/branch and Google is enabled as a social provider.
2. Configure the Google OAuth client credentials in Neon Auth. Add the production origin and local development origin where Neon instructs you to do so.
3. Copy the exact callback/redirect URI shown by Neon Auth into the Google OAuth client. Do not guess the callback URI.
4. Set both `NEON_AUTH_BASE_URL` and `NEXT_PUBLIC_NEON_AUTH_URL` to the supplied Neon Auth base URL, and set a new random `NEON_AUTH_COOKIE_SECRET` on Vercel. The first is used by the Next.js server adapter; the public variable lets the browser-side Neon Auth client discover the same Auth endpoint.
5. Test Google sign-in, sign-out, session persistence and verified-email status before opening the site.

The supplied Neon Auth JWKS URL is retained as a reference but is not used by this Vercel-session-to-Render assertion design. The backend does not need the JWKS URL in this architecture. Neon Auth is consumed by the Next.js server; Render receives only a short-lived assertion signed with the shared `BACKEND_PROXY_SECRET`. The session adapter normalizes both documented SDK result shapes (`data.user` and top-level `user`) while still requiring server-returned identity data and a verified email for privileged actions.

## Render backend deployment

1. Push this repository to a private GitHub repository.
2. In Render, create a new Blueprint deployment from the repository using `render.yaml`. The service is configured in the `ohio` region, near the Neon database's US East region, and auto-deploys only after linked CI checks pass. The Blueprint sets `rootDir: backend`; the Dockerfile path is `Dockerfile` and Docker build context is `.` relative to the service root directory. If configuring a Web Service manually, use Docker runtime, repository root directory `backend`, Dockerfile path `Dockerfile`, Docker context `.`, and health check path `/healthz`.
3. Set these environment variables in Render Dashboard (never in source code):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | New rotated Neon pooled connection string |
   | `BACKEND_PROXY_SECRET` | Shared random secret; exactly the same value as Vercel |
   | `PAYSTACK_SECRET_KEY` | Paystack test secret initially; live secret only after testing |
   | `PAYSTACK_WEBHOOK_SECRET` | Required active Paystack webhook signing secret (`whsec_...`) from Developers > API configuration |
   | `PAYSTACK_WEBHOOK_SECRETS` | Optional comma-separated active + previous `whsec_...` keys during a signing-secret rotation. Add it manually only during the overlap window. |
   | `FRONTEND_URL` | `https://android12testers.com` |
   | `R2_ACCOUNT_ID` | Cloudflare account ID |
   | `R2_ACCESS_KEY_ID` | Bucket-scoped R2 access key |
   | `R2_SECRET_ACCESS_KEY` | Bucket-scoped R2 secret |
   | `R2_BUCKET_NAME` | `android-testers-evidence` |
   | `RESEND_API_KEY` | Optional Resend API key; add manually in Render only if email notifications are enabled. |
   | `RESEND_FROM_EMAIL` | Optional verified sender; default is `Android Testers <notifications@android12testers.com>`. |

4. Generate the shared proxy secret locally, for example `openssl rand -base64 48`. Paste the same value into Render and Vercel; do not commit it.
5. Deploy after the GitHub Actions checks pass. Confirm the Render service is healthy at `https://YOUR-RENDER-SERVICE.onrender.com/healthz`. It should return `ok: true`, `database: ready`, and `evidenceStorage: true` once R2 is configured. The `checksPass` trigger depends on GitHub Actions being enabled for the linked branch; do not disable the workflow if you want gated deployments.
6. Create a private Cloudflare R2 bucket named `android-testers-evidence`. In Cloudflare Dashboard, open R2 Object Storage, create the bucket, then create an S3 API token with read/write access scoped to this bucket only. Copy the account ID, access key ID, and secret access key into Render. Keep public bucket access disabled; the API stores evidence privately and issues short-lived signed viewing URLs to the administrator. Evidence upload and admin previews will remain unavailable until R2 is configured.

Render reads `PORT` from its environment. The container binds to `0.0.0.0` and defaults to port `10000` for local operation.

## Vercel frontend deployment

1. Import the same GitHub repository into Vercel. Set the project root to the repository root and framework preset to Next.js.
2. Add these environment variables to Vercel (Production and Preview as appropriate):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://android12testers.com` |
   | `NEON_AUTH_BASE_URL` | The Neon Auth base URL shown above (server-side) |
   | `NEXT_PUBLIC_NEON_AUTH_URL` | The same Neon Auth base URL (browser-side Neon Auth client) |
   | `NEON_AUTH_COOKIE_SECRET` | New random secret, at least 32 characters |
   | `BACKEND_API_URL` | The Render service origin, e.g. `https://android-testers-api.onrender.com` |
   | `BACKEND_PROXY_SECRET` | The exact same shared secret configured on Render |

3. Do not add `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, or R2 credentials to Vercel.
4. Deploy. Test a signed-in customer request to `/api/apps` (it should return an empty `campaigns` list before the first submission) and an unsigned request (it should return HTTP 401).
5. Add `android12testers.com` to Vercel and configure the DNS records Vercel provides. Enable HTTPS and redirect `www` to the canonical non-`www` domain.

## Paystack setup and checkout

The hosted Paystack Shop URL supplied by the owner is:

```text
https://paystack.shop/pay/ka5-epv4t1
```

That link is retained as a reference/manual fallback. The website's primary checkout uses Paystack's transaction API instead of the static shop page. This is intentional: each campaign receives a unique reference and campaign metadata, so the backend can verify the exact USD $10 transaction before marking that particular campaign paid. The static shop page alone cannot safely associate a generic purchase with a specific signed-in campaign.

1. Add the Paystack **secret key** to Render as `PAYSTACK_SECRET_KEY`; start with a test key.
2. Confirm with Paystack that the account can accept international card payments and USD transactions. Activation and settlement options are account-dependent.
3. Set the Paystack webhook URL to:

   ```text
   https://YOUR-RENDER-SERVICE.onrender.com/api/paystack/webhook
   ```

4. The transaction initialization callback is generated as `https://android12testers.com/api/payments/callback` and proxied to Render. The callback independently verifies the transaction before returning a result page.
5. The backend checks transaction status, exact `1000` minor units, `USD`, provider reference, customer email and campaign metadata. A browser redirect is never treated as proof of payment.
6. Test successful, failed, abandoned, duplicate-webhook and refund scenarios with Paystack test keys before changing to a live key.
7. Activate live international/USD collection with Paystack and complete a real controlled low-value test before opening production checkout.

`PAYSTACK_SECRET_KEY` is required. The hosted shop link cannot replace the API secret for secure per-campaign checkout and automatic payment reconciliation.

## Optional email notifications

Resend is optional. Without it, users can still see all state changes in the dashboard and the support channel remains WhatsApp (`+254 742 608 319`). To enable notices, verify `android12testers.com` with Resend, publish the SPF/DKIM/DMARC DNS records Resend provides, then add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to Render.

## Post-deployment smoke checks

After both services are deployed and the Render health endpoint is green, run the unauthenticated production checks from the repository root:

```bash
API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com SITE_URL=https://android12testers.com npm run smoke:production
```

PowerShell:

```powershell
$env:API_BASE_URL = "https://YOUR-RENDER-SERVICE.onrender.com"
$env:SITE_URL = "https://android12testers.com"
npm run smoke:production
```

This checks Render health (including Neon and R2), confirms admin endpoints reject anonymous requests, confirms the webhook rejects unsigned requests, and checks the public homepage and sitemap. It does not replace authenticated customer-flow or Paystack test-mode transactions.

## Local development

Requirements: Node.js 22+, npm, and Rust (stable).

Frontend:

```bash
cp .env.example .env.local
# Fill the Neon Auth values, Render backend URL and shared secret.
npm install
npm run dev
```

This source handoff does not contain a generated `package-lock.json` because the package registry was unreachable in the build environment. The first successful `npm install` will generate it; commit that file to GitHub. After that, use `npm ci` locally and in CI for reproducible installs. Until a lockfile is committed, CI and Vercel use `npm install`.

Backend:

```bash
cd backend
cp .env.example .env
# Fill DATABASE_URL, BACKEND_PROXY_SECRET, PAYSTACK_SECRET_KEY and FRONTEND_URL.
cargo run
```

Before deployment:

```bash
npm test
npm run typecheck
npm run build
cargo check --manifest-path backend/Cargo.toml
cargo test --manifest-path backend/Cargo.toml
```

The repository includes `.github/workflows/ci.yml` to run the frontend and Rust checks on GitHub Actions. Configure branch protection to require these checks before merging/deploying. This environment could run the source-contract tests but could not download npm/Rust dependencies, so the GitHub CI result must be checked after you push the repository.

The Rust service should also be built/tested with `cargo check` and `cargo test` (and its Docker image built) in CI or a machine with the Rust toolchain installed.

## Security and production boundaries

- Real secrets are absent from this repository. Never commit `.env`, `.env.local`, Paystack keys, Neon connection strings, R2 credentials, or the shared proxy secret.
- Rotate the exposed Neon database password before production. Use a dedicated database runtime role if practical.
- Never expose the Neon connection string to the browser or Vercel; only the Render API needs it.
- Only the verified owner account can call admin routes. The admin guard runs before the retest queue query.
- Customer API queries are restricted to the authenticated customer's own campaigns.
- Evidence screenshots are private R2 objects; admin links are signed and expire after 15 minutes.
- Paystack webhook signatures are checked against the raw body; event payloads are deduplicated and replay-safe.
- Tester opt-in and daily activity are manually attested by the administrator. Do not record activity that did not happen.
- The public legal pages are drafts. Complete legal business details, privacy retention schedule, refund wording and governing law before live transactions.
- The website cannot guarantee Google Play production access.

## SEO and organic discovery

The public pages use server-rendered content, unique titles/descriptions, canonical URLs, internal links, structured data, Open Graph metadata, `robots.txt` and an XML sitemap. Customer dashboard, sign-in and admin pages are `noindex`; private routes remain protected by server-side authorization.

After domain deployment:

1. Verify `android12testers.com` in Google Search Console and Bing Webmaster Tools.
2. Submit `https://android12testers.com/sitemap.xml`.
3. Inspect representative URLs and repair canonical/indexing errors.
4. Keep guides accurate against current Google Play documentation and write useful, original articles that answer real developer questions.
5. Monitor impressions, clicks and queries, then improve pages based on actual search data.
6. Measure mobile performance and Core Web Vitals; earn relevant links through useful developer resources and partnerships rather than spam.

SEO cannot guarantee indexing, rankings or traffic levels.

## Verification status of this handoff

This handoff includes the new Rust/Axum Render service, Docker deployment file, Render Blueprint, Vercel-to-Render server proxy, and environment templates. Static route and security contract checks are included. **This source has not yet been proven by a successful Rust compile, Next.js typecheck/production build, live Neon migration, OAuth session, Paystack test transaction, Cloudflare R2 upload, or deployed Render/Vercel runtime.** Those require dependency installation and your external service configuration. Do not accept live customer payments until all these checks pass.


## Verification record (7 November 2026)

Checks completed against this source tree:

- `npm test`: passed (public-route/content checks, security contract checks, 16 API route/handler contracts).
- Retest request JSON casing issue was corrected: the Rust API now accepts the frontend’s `requestedRemedy` and `evidenceUrl` fields, with a regression test included for GitHub CI.
- Node syntax checks for the JavaScript test scripts: passed.
- YAML parsing for `render.yaml` and `.github/workflows/ci.yml`: passed.
- Secret scan: no pasted Neon password, live Paystack key, or real `.env` file included.
- ZIP integrity is checked on the release archive.

Not verified in this execution environment:

- npm dependency installation timed out, so `npm run typecheck` and `npm run build` were not run.
- Rust/Cargo is not installed here, so `cargo check`, `cargo test`, and the Docker image build were not run. The included GitHub Actions workflow performs these checks after you push the repository.
- The migrations have not been applied to your Neon project; Google OAuth, Paystack transactions/refunds, R2 uploads, and Render/Vercel deployment have not been live-tested.

Do not accept customer payments until GitHub CI passes, all seven migrations are applied, the Render health endpoint reports database and evidence storage ready, and the complete Paystack test-mode customer journey passes.


## Legal pages and acceptance record

The public routes `/privacy`, `/terms`, and `/refund-policy` contain service-specific legal drafts. The checkout requires an explicit customer acknowledgement and the Rust API records the exact terms/privacy version and timestamp on the campaign (`legal_terms_version`, `legal_privacy_version`, `legal_accepted_at`) before it initializes Paystack. Apply migration `0007_legal_acceptance.sql` or run the updated `database/neon_setup_all.sql`.

**Do not enable live checkout while these drafts still contain bracketed operator-identity placeholders.** Before launch, replace the legal operator name and business address; confirm the applicable company/sole-trader and tax disclosures; establish the ODPC registration/exemption position; document international data-transfer safeguards for the selected Neon, Render, Vercel, Paystack, Cloudflare and WhatsApp configurations; validate the stated retention schedule; and have a Kenyan advocate review the terms, privacy notice and refund policy for the target markets. The privacy notice also discloses that the 12 tester email addresses are shown to customers for closed-test setup.
