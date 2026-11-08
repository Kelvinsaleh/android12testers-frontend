use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Extension, Multipart, Path, Query, State},
    http::{header, HeaderMap, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Redirect, Response},
    routing::{get, patch, post, put},
    Json, Router,
};
use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{
    primitives::ByteStream,
    presigning::PresigningConfig,
    Client as S3Client,
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256, Sha512};
use sqlx::{postgres::{PgConnectOptions, PgPoolOptions}, PgPool};
use std::{env, net::SocketAddr, str::FromStr, sync::Arc, time::Duration};
use subtle::ConstantTimeEq;
use tracing::{error, info, warn};
use uuid::Uuid;

const ADMIN_EMAIL: &str = "sksalee071@gmail.com";
const CAMPAIGN_LOCK: i64 = 817263;
const CAMPAIGN_AMOUNT_MINOR: i64 = 1000;
const CAMPAIGN_DURATION_DAYS: i64 = 15;
const REQUIRED_TESTERS: i64 = 12;
const MAX_UPLOAD_BYTES: usize = 4 * 1024 * 1024;
const TERMS_VERSION: &str = "2026-11-08-v1";
const PRIVACY_VERSION: &str = "2026-11-08-v1";

#[derive(Clone)]
struct Config {
    proxy_secret: String,
    paystack_secret: String,
    paystack_webhook_secrets: Vec<String>,
    frontend_url: String,
    r2_bucket: String,
    resend_api_key: Option<String>,
    resend_from: String,
}

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    config: Arc<Config>,
    http: HttpClient,
    r2: Option<S3Client>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProxyClaims {
    iss: String,
    aud: String,
    sub: String,
    email: String,
    email_verified: bool,
    iat: usize,
    exp: usize,
    jti: String,
}

#[derive(Debug, Clone)]
struct User {
    id: String,
    email: String,
    email_verified: bool,
}

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }
    fn bad(message: impl Into<String>) -> Self { Self::new(StatusCode::BAD_REQUEST, message) }
    fn unauthorized() -> Self { Self::new(StatusCode::UNAUTHORIZED, "Sign in with your verified Google account to continue.") }
    fn forbidden() -> Self { Self::new(StatusCode::FORBIDDEN, "You do not have permission to access this resource.") }
    fn not_found(message: impl Into<String>) -> Self { Self::new(StatusCode::NOT_FOUND, message) }
    fn conflict(message: impl Into<String>) -> Self { Self::new(StatusCode::CONFLICT, message) }
    fn unavailable(message: impl Into<String>) -> Self { Self::new(StatusCode::SERVICE_UNAVAILABLE, message) }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({"error": self.message}))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(value: sqlx::Error) -> Self {
        error!(error = %value, "database operation failed");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "The request could not be completed. Please try again.")
    }
}
impl From<reqwest::Error> for ApiError {
    fn from(value: reqwest::Error) -> Self {
        error!(error = %value, "upstream HTTP request failed");
        Self::unavailable("A payment or storage provider is temporarily unavailable. Please try again shortly.")
    }
}

fn env_required(name: &str) -> Result<String, String> {
    env::var(name).ok().filter(|v| !v.trim().is_empty()).ok_or_else(|| format!("Missing required environment variable: {name}"))
}

/// SQLx 0.8's PostgreSQL URL parser does not expose libpq's `channel_binding`
/// query option. Neon connection strings commonly include it. Preserve TLS
/// (`sslmode=require`) while removing only that unsupported client option.
fn sqlx_compatible_neon_url(raw: &str) -> Result<String, String> {
    let mut parsed = url::Url::parse(raw).map_err(|_| "DATABASE_URL is not a valid PostgreSQL URL".to_string())?;
    if !matches!(parsed.scheme(), "postgres" | "postgresql") || parsed.host_str().is_none() {
        return Err("DATABASE_URL must be a valid postgres:// or postgresql:// URL".into());
    }
    let pairs: Vec<(String, String)> = parsed.query_pairs()
        .filter(|(key, _)| key != "channel_binding")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    let sslmode = pairs.iter().find(|(key, _)| key == "sslmode").map(|(_, value)| value.as_str());
    if !matches!(sslmode, Some("require" | "verify-ca" | "verify-full")) {
        return Err("DATABASE_URL must set sslmode=require (or a stricter TLS mode)".into());
    }
    parsed.set_query(None);
    if !pairs.is_empty() {
        let mut query = parsed.query_pairs_mut();
        for (key, value) in pairs { query.append_pair(&key, &value); }
    }
    Ok(parsed.to_string())
}

async fn build_state() -> Result<AppState, Box<dyn std::error::Error + Send + Sync>> {
    let database_url_raw = env_required("DATABASE_URL")?;
    let database_url = sqlx_compatible_neon_url(&database_url_raw)?;
    let proxy_secret = env_required("BACKEND_PROXY_SECRET")?;
    if proxy_secret.len() < 32 { return Err("BACKEND_PROXY_SECRET must be at least 32 characters".into()); }
    let paystack_secret = env_required("PAYSTACK_SECRET_KEY")?;
    if !(paystack_secret.starts_with("sk_test_") || paystack_secret.starts_with("sk_live_")) {
        return Err("PAYSTACK_SECRET_KEY must be a Paystack test or live secret key".into());
    }
    let webhook_secret_value = env::var("PAYSTACK_WEBHOOK_SECRETS")
        .ok().filter(|value| !value.trim().is_empty())
        .or_else(|| env::var("PAYSTACK_WEBHOOK_SECRET").ok())
        .unwrap_or_default();
    let paystack_webhook_secrets: Vec<String> = webhook_secret_value
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    if paystack_webhook_secrets.is_empty() || paystack_webhook_secrets.iter().any(|value| !value.starts_with("whsec_")) {
        return Err("Set PAYSTACK_WEBHOOK_SECRET to the active whsec_ signing secret from Paystack before starting the API".into());
    }
    let frontend_url = env_required("FRONTEND_URL")?;
    let parsed_frontend = url::Url::parse(&frontend_url)?;
    if parsed_frontend.scheme() != "https" && parsed_frontend.host_str() != Some("localhost") {
        return Err("FRONTEND_URL must use HTTPS in production".into());
    }
    if parsed_frontend.path() != "/" || parsed_frontend.query().is_some() || parsed_frontend.fragment().is_some() {
        return Err("FRONTEND_URL must be an origin without a path, query, or fragment".into());
    }
    let config = Config {
        proxy_secret,
        paystack_secret,
        paystack_webhook_secrets,
        frontend_url: frontend_url.trim_end_matches('/').to_string(),
        r2_bucket: env_required("R2_BUCKET_NAME")?,
        resend_api_key: env::var("RESEND_API_KEY").ok().filter(|v| !v.is_empty()),
        resend_from: env::var("RESEND_FROM_EMAIL").unwrap_or_else(|_| "Android Testers <notifications@android12testers.com>".to_string()),
    };
    // Neon pooled endpoints use PgBouncer transaction pooling. Disabling SQLx
    // statement caching avoids relying on connection-local prepared statements.
    let connect_options = PgConnectOptions::from_str(&database_url)?.statement_cache_capacity(0);
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(60))
        .max_lifetime(Duration::from_secs(30 * 60))
        .connect_with(connect_options).await?;
    sqlx::query("SELECT 1").execute(&pool).await?;

    // Evidence storage is a mandatory part of the customer submission workflow.
    // Fail startup rather than advertise a healthy API that cannot accept evidence.
    let account = env_required("R2_ACCOUNT_ID")?;
    let access = env_required("R2_ACCESS_KEY_ID")?;
    let secret = env_required("R2_SECRET_ACCESS_KEY")?;
    let credentials = Credentials::new(access, secret, None, None, "render-environment");
    let shared = aws_config::defaults(BehaviorVersion::latest())
        .region(aws_config::Region::new("auto"))
        .credentials_provider(credentials)
        .load().await;
    let s3_config = aws_sdk_s3::config::Builder::from(&shared)
        .endpoint_url(format!("https://{account}.r2.cloudflarestorage.com"))
        .force_path_style(true)
        .build();
    let r2 = S3Client::from_conf(s3_config);
    r2.head_bucket().bucket(&config.r2_bucket).send().await?;

    // Refuse to start when database migrations are incomplete. This catches
    // misconfigured deployments before the first paying customer encounters them.
    let schema_ready: bool = sqlx::query_scalar("SELECT to_regclass('public.apps') IS NOT NULL AND to_regclass('public.campaigns') IS NOT NULL AND to_regclass('public.payments') IS NOT NULL AND to_regclass('public.paystack_webhook_events') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='paystack_webhook_events' AND column_name='payload') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='paystack_webhook_events' AND column_name='next_attempt_at') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaign_tester_checkins' AND column_name='campaign_day')")
        .fetch_one(&pool).await?;
    if !schema_ready { return Err("Neon schema is incomplete; apply all database migrations before deploying the API".into()); }

    Ok(AppState { pool, config: Arc::new(config), http: HttpClient::builder().timeout(Duration::from_secs(20)).build()?, r2: Some(r2) })
}

fn make_router(state: AppState) -> Router {
    let protected = Router::new()
        .route("/api/apps", get(list_apps).post(create_app))
        .route("/api/tester-list", post(get_tester_list))
        .route("/api/uploads", post(upload_evidence))
        .route("/api/campaigns/{id}/checkout", post(start_checkout))
        .route("/api/campaigns/{id}/retests", post(create_retest_request))
        .route("/api/payments/verify", post(verify_payment_endpoint))
        .route("/api/admin/campaigns", get(admin_list_campaigns))
        .route("/api/admin/campaigns/{id}", patch(admin_update_campaign))
        .route("/api/admin/testers", get(admin_get_testers).put(admin_replace_testers))
        .route("/api/admin/retests", get(admin_list_retests).patch(admin_decide_retest))
        .route("/api/admin/webhook-events", get(admin_list_failed_webhooks).patch(admin_retry_webhook))
        .layer(DefaultBodyLimit::max(6 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(state.clone(), authenticate_proxy));

    Router::new()
        .route("/healthz", get(health))
        .route("/api/payments/callback", get(payment_callback))
        .route("/api/paystack/webhook", post(paystack_webhook))
        .merge(protected)
        .layer(DefaultBodyLimit::max(6 * 1024 * 1024))
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(state)
}

async fn health(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(json!({"ok":true,"service":"android-testers-api","database":"ready","evidenceStorage":state.r2.is_some()})))
}

async fn authenticate_proxy(
    State(state): State<AppState>,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let token = request.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));
    let Some(token) = token else { return ApiError::unauthorized().into_response(); };
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&["android-testers-vercel"]);
    validation.set_audience(&["android-testers-api"]);
    validation.set_required_spec_claims(&["iss", "aud", "sub", "exp", "iat"]);
    validation.validate_exp = true;
    validation.validate_nbf = true;
    let claims = match decode::<ProxyClaims>(token, &DecodingKey::from_secret(state.config.proxy_secret.as_bytes()), &validation) {
        Ok(data) => data.claims,
        Err(_) => return ApiError::unauthorized().into_response(),
    };
    let now = Utc::now().timestamp().max(0) as usize;
    if claims.sub.trim().is_empty()
        || claims.email.trim().is_empty()
        || claims.jti.trim().is_empty()
        || claims.exp <= claims.iat
        || claims.exp.saturating_sub(claims.iat) > 120
        || claims.iat > now.saturating_add(30)
        || now.saturating_sub(claims.iat) > 180
    {
        return ApiError::unauthorized().into_response();
    }
    let user = User { id: claims.sub, email: claims.email.trim().to_lowercase(), email_verified: claims.email_verified };
    if let Err(db_error) = sqlx::query(
        "INSERT INTO app_users (auth_user_id,email,email_verified) VALUES ($1,$2,$3) ON CONFLICT (auth_user_id) DO UPDATE SET email=EXCLUDED.email,email_verified=EXCLUDED.email_verified,updated_at=now()"
    ).bind(&user.id).bind(&user.email).bind(user.email_verified).execute(&state.pool).await {
        error!(error = %db_error, "could not synchronize authenticated user");
        return ApiError::unavailable("The account service is temporarily unavailable.").into_response();
    }
    request.extensions_mut().insert(user);
    next.run(request).await
}

fn user_from_extensions(extensions: &axum::http::Extensions) -> Result<User, ApiError> {
    extensions.get::<User>().cloned().ok_or_else(ApiError::unauthorized)
}
fn require_verified(user: &User) -> Result<(), ApiError> {
    if !user.email_verified { return Err(ApiError::forbidden()); }
    Ok(())
}
fn require_admin(user: &User) -> Result<(), ApiError> {
    if !user.email_verified || user.email.to_lowercase() != ADMIN_EMAIL { return Err(ApiError::forbidden()); }
    Ok(())
}

async fn rate_limit(pool: &PgPool, key: &str, max_hits: i32, window_seconds: i64) -> Result<(), ApiError> {
    let hits: i32 = sqlx::query_scalar(
        "INSERT INTO request_rate_limits(rate_key,window_started_at,hits) VALUES($1,now(),1) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN request_rate_limits.window_started_at <= now() - ($2 * interval '1 second') THEN 1 ELSE request_rate_limits.hits+1 END, window_started_at=CASE WHEN request_rate_limits.window_started_at <= now() - ($2 * interval '1 second') THEN now() ELSE request_rate_limits.window_started_at END RETURNING hits"
    ).bind(key).bind(window_seconds).fetch_one(pool).await?;
    if hits > max_hits { return Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS, "Too many requests. Please wait before trying again.")); }
    Ok(())
}

async fn json_scalar(pool: &PgPool, sql: &str, bind: &str) -> Result<Value, ApiError> {
    Ok(sqlx::query_scalar::<_, Value>(sql).bind(bind).fetch_one(pool).await?)
}

fn valid_package_name(name: &str) -> bool {
    let parts: Vec<&str> = name.split('.').collect();
    parts.len() >= 2 && parts.iter().all(|part| {
        !part.is_empty() && part.as_bytes()[0].is_ascii_alphabetic()
            && part.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
    })
}
fn valid_opt_in_url(raw: &str) -> bool {
    url::Url::parse(raw).map(|url| url.scheme() == "https" && url.host_str() == Some("play.google.com") && url.path().starts_with("/apps/testing/")).unwrap_or(false)
}
fn is_valid_email(email: &str) -> bool {
    email_address::EmailAddress::is_valid(email)
}
fn sanitize_filename(name: &str) -> String {
    let value: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-')).take(100).collect();
    if value.is_empty() { "evidence-image".into() } else { value }
}

async fn send_email(state: &AppState, to: &str, subject: &str, heading: &str, message: &str, action_path: &str) {
    let Some(key) = state.config.resend_api_key.as_deref() else { return; };
    let safe_to = to.trim();
    if safe_to.is_empty() { return; }
    let url = format!("{}{}", state.config.frontend_url, action_path);
    let html = format!("<div style=\"font-family:Arial,sans-serif;max-width:620px;margin:auto\"><h2>{}</h2><p>{}</p><p><a href=\"{}\">Open Android Testers</a></p><p>Support: <a href=\"https://wa.me/254742608319\">WhatsApp support</a></p></div>", html_escape(heading), html_escape(message), html_escape(&url));
    let response = state.http.post("https://api.resend.com/emails")
        .bearer_auth(key)
        .json(&json!({"from":state.config.resend_from,"to":[safe_to],"subject":subject,"html":html}))
        .send().await;
    if let Err(err) = response { warn!(error=%err,"email notification failed"); }
}
fn html_escape(input: &str) -> String {
    input.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SubmitApp {
    app_name: String,
    package_name: String,
    opt_in_url: String,
    kenya_available: bool,
    email_list_configured: bool,
    evidence_keys: Vec<String>,
}

async fn list_apps(State(state): State<AppState>, Extension(user): Extension<User>) -> Result<Json<Value>, ApiError> {
    let campaigns = json_scalar(&state.pool, r#"
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',c.id,'status',c.status,'created_at',c.created_at,
        'actual_start_at',c.actual_start_at,'actual_end_at',c.actual_end_at,
        'is_comped_retest',c.is_comped_retest,'payment_required',c.payment_required,
        'completion_summary',c.completion_summary,'completed_at',c.completed_at,
        'app_id',a.id,'app_name',a.app_name,'package_name',a.package_name,
        'setup_status',a.setup_status,'admin_note',a.admin_note,
        'payment_status',p.status,'provider_reference',p.provider_reference,
        'refund_status',(SELECT rf.status FROM refunds rf WHERE rf.payment_id=p.id ORDER BY rf.created_at DESC LIMIT 1),
        'opted_in_count',(SELECT count(*)::int FROM campaign_testers ct WHERE ct.campaign_id=c.id AND ct.status IN ('opted_in','completed')),
        'retest_count',(SELECT count(*)::int FROM retest_requests rr WHERE rr.campaign_id=c.id),
        'latest_retest_status',(SELECT rr.status FROM retest_requests rr WHERE rr.campaign_id=c.id ORDER BY rr.created_at DESC LIMIT 1),
        'latest_retest_note',(SELECT rr.decision_note FROM retest_requests rr WHERE rr.campaign_id=c.id ORDER BY rr.created_at DESC LIMIT 1)
      ) ORDER BY c.created_at DESC),'[]'::jsonb)
      FROM campaigns c JOIN apps a ON a.id=c.app_id
      LEFT JOIN payments p ON p.campaign_id=c.id
      WHERE c.customer_user_id=$1
    "#, &user.id).await?;
    Ok(Json(json!({"campaigns": campaigns})))
}

async fn create_app(
    State(state): State<AppState>, Extension(user): Extension<User>, Json(input): Json<SubmitApp>,
) -> Result<impl IntoResponse, ApiError> {
    require_verified(&user)?;
    if input.app_name.trim().len() < 2 || input.app_name.trim().len() > 100 { return Err(ApiError::bad("App name must be between 2 and 100 characters.")); }
    if !valid_package_name(input.package_name.trim()) { return Err(ApiError::bad("Enter a valid Android package name.")); }
    if !valid_opt_in_url(&input.opt_in_url) { return Err(ApiError::bad("Use the HTTPS Google Play closed-test opt-in link.")); }
    if !input.kenya_available || !input.email_list_configured { return Err(ApiError::bad("Confirm that Kenya is available and the supplied tester email list is configured.")); }
    if !(2..=4).contains(&input.evidence_keys.len()) || input.evidence_keys.iter().any(|k| k.len() < 10 || k.len() > 300) {
        return Err(ApiError::bad("Upload 2–4 valid setup screenshots before submitting."));
    }
    rate_limit(&state.pool, &format!("app-submit:{}", user.id), 5, 3600).await?;

    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(CAMPAIGN_LOCK).execute(&mut *tx).await?;
    let pool_count: i64 = sqlx::query_scalar("SELECT count(*) FROM testers WHERE active=TRUE").fetch_one(&mut *tx).await?;
    if pool_count != REQUIRED_TESTERS { return Err(ApiError::unavailable("The 12-person tester pool is not ready yet. Please contact support.")); }
    let duplicate: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM apps a JOIN campaigns c ON c.app_id=a.id WHERE a.owner_user_id=$1 AND lower(a.package_name)=lower($2) AND c.status IN ('awaiting_review','awaiting_payment','payment_pending','paid_queued','enrolling','running','refund_pending'))")
        .bind(&user.id).bind(input.package_name.trim()).fetch_one(&mut *tx).await?;
    if duplicate { return Err(ApiError::conflict("This app already has a campaign awaiting review, payment, scheduling, or completion. Check your dashboard before submitting it again.")); }
    let evidence: Value = sqlx::query_scalar(r#"
      SELECT COALESCE(jsonb_agg(jsonb_build_object('key',object_key,'fileName',file_name,'contentType',content_type,'bytes',byte_size)),'[]'::jsonb)
      FROM uploads WHERE owner_user_id=$1 AND object_key=ANY($2::text[]) AND linked_at IS NULL
    "#).bind(&user.id).bind(&input.evidence_keys).fetch_one(&mut *tx).await?;
    let evidence_count = evidence.as_array().map(|a| a.len()).unwrap_or(0);
    if evidence_count != input.evidence_keys.len() { return Err(ApiError::bad("One or more evidence files are invalid, expired, or already attached to another submission.")); }
    sqlx::query("INSERT INTO tester_pool_state(singleton_id,locked_at) VALUES(TRUE,now()) ON CONFLICT(singleton_id) DO UPDATE SET locked_at=COALESCE(tester_pool_state.locked_at,now()),updated_at=now()")
        .execute(&mut *tx).await?;
    let app_id: Uuid = sqlx::query_scalar(r#"
      INSERT INTO apps(owner_user_id,app_name,package_name,opt_in_url,tester_list_configured,kenya_available,setup_evidence)
      VALUES($1,$2,$3,$4,TRUE,TRUE,$5) RETURNING id
    "#).bind(&user.id).bind(input.app_name.trim()).bind(input.package_name.trim()).bind(input.opt_in_url.trim()).bind(&evidence).fetch_one(&mut *tx).await?;
    let campaign_id: Uuid = sqlx::query_scalar("INSERT INTO campaigns(app_id,customer_user_id,status) VALUES($1,$2,'awaiting_review') RETURNING id")
        .bind(app_id).bind(&user.id).fetch_one(&mut *tx).await?;
    sqlx::query("UPDATE uploads SET linked_at=now() WHERE owner_user_id=$1 AND object_key=ANY($2::text[])")
        .bind(&user.id).bind(&input.evidence_keys).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'submission_created',$3)")
        .bind(campaign_id).bind(&user.id).bind(json!({"evidenceCount": evidence_count})).execute(&mut *tx).await?;
    tx.commit().await?;

    send_email(&state, &user.email, &format!("Submission received: {}", input.app_name), "Your app has been submitted.", "We received your app. The Play Console setup evidence is waiting for administrator review. Payment is not due until the setup is approved.", "/dashboard").await;
    Ok((StatusCode::CREATED, Json(json!({"ok":true,"appId":app_id,"campaignId":campaign_id}))))
}

async fn get_tester_list(State(state): State<AppState>, Extension(user): Extension<User>) -> Result<Json<Value>, ApiError> {
    require_verified(&user)?;
    rate_limit(&state.pool, &format!("tester-list:{}", user.id), 20, 3600).await?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(CAMPAIGN_LOCK).execute(&mut *tx).await?;
    let emails: Vec<String> = sqlx::query_scalar("SELECT email FROM testers WHERE active=TRUE ORDER BY email ASC FOR SHARE")
        .fetch_all(&mut *tx).await?;
    if emails.len() != 12 { return Err(ApiError::unavailable("The tester list is being prepared. Please check back later.")); }
    sqlx::query("INSERT INTO tester_pool_state(singleton_id,locked_at) VALUES(TRUE,now()) ON CONFLICT(singleton_id) DO UPDATE SET locked_at=COALESCE(tester_pool_state.locked_at,now()),updated_at=now()")
        .execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"testerEmails":emails})))
}

#[derive(Deserialize)]
struct CheckoutPath { id: Uuid }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CheckoutConsent { terms_version: String, privacy_version: String }
async fn start_checkout(
    State(state): State<AppState>, Extension(user): Extension<User>, Path(path): Path<CheckoutPath>, Json(consent): Json<CheckoutConsent>,
) -> Result<Json<Value>, ApiError> {
    require_verified(&user)?;
    if consent.terms_version != TERMS_VERSION || consent.privacy_version != PRIVACY_VERSION {
        return Err(ApiError::conflict("The legal documents have changed. Refresh the page, review the current policies and confirm again."));
    }
    rate_limit(&state.pool, &format!("checkout:{}", user.id), 10, 3600).await?;
    let campaign = sqlx::query(r#"SELECT c.id,c.status,a.setup_status AS app_status FROM campaigns c JOIN apps a ON a.id=c.app_id WHERE c.id=$1 AND c.customer_user_id=$2"#)
        .bind(path.id).bind(&user.id).fetch_optional(&state.pool).await?;
    let row = campaign.ok_or_else(|| ApiError::not_found("Campaign not found."))?;
    let status: String = sqlx::Row::try_get(&row, "status").map_err(|_| ApiError::bad("Invalid campaign record"))?;
    let app_status: String = sqlx::Row::try_get(&row, "app_status").map_err(|_| ApiError::bad("Invalid app record"))?;
    if status != "awaiting_payment" || app_status != "approved" { return Err(ApiError::conflict("This campaign must pass setup review before checkout can begin.")); }

    let reference = format!("AT{}", Uuid::new_v4().simple());
    let mut tx = state.pool.begin().await?;
    let changed: i64 = sqlx::query_scalar("UPDATE campaigns SET status='payment_pending',legal_terms_version=$3,legal_privacy_version=$4,legal_accepted_at=now(),updated_at=now() WHERE id=$1 AND customer_user_id=$2 AND status='awaiting_payment' RETURNING 1")
        .bind(path.id).bind(&user.id).bind(TERMS_VERSION).bind(PRIVACY_VERSION).fetch_optional(&mut *tx).await?.unwrap_or(0);
    if changed != 1 { return Err(ApiError::conflict("This campaign is already being checked out.")); }
    sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'legal_terms_accepted',$3)")
        .bind(path.id).bind(&user.id).bind(json!({"termsVersion":TERMS_VERSION,"privacyVersion":PRIVACY_VERSION})).execute(&mut *tx).await?;
    let inserted = sqlx::query(r#"
      INSERT INTO payments(campaign_id,provider_reference,amount_minor,currency,status)
      VALUES($1,$2,1000,'USD','initiated')
      ON CONFLICT(campaign_id) DO UPDATE SET provider_reference=EXCLUDED.provider_reference,amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,status='initiated',verified_at=NULL,updated_at=now()
      WHERE payments.status IN ('failed','reversed','initiated') RETURNING id
    "#).bind(path.id).bind(&reference).fetch_optional(&mut *tx).await?;
    if inserted.is_none() { return Err(ApiError::conflict("A Paystack transaction is already in progress for this campaign.")); }
    tx.commit().await?;

    let callback_url = format!("{}/api/payments/callback", state.config.frontend_url);
    match initialize_paystack(&state, &user.email, &reference, path.id, &callback_url).await {
        Ok(authorization_url) => {
            sqlx::query("UPDATE payments SET status='pending',updated_at=now() WHERE campaign_id=$1 AND provider_reference=$2")
                .bind(path.id).bind(&reference).execute(&state.pool).await?;
            Ok(Json(json!({"authorizationUrl":authorization_url,"reference":reference})))
        }
        Err(err) if err.status.is_client_error() => {
            sqlx::query("UPDATE payments SET status='failed',updated_at=now() WHERE campaign_id=$1 AND provider_reference=$2")
                .bind(path.id).bind(&reference).execute(&state.pool).await?;
            sqlx::query("UPDATE campaigns SET status='awaiting_payment',updated_at=now() WHERE id=$1 AND status='payment_pending'")
                .bind(path.id).execute(&state.pool).await?;
            Err(err)
        }
        Err(_) => Err(ApiError::unavailable("Paystack's response was inconclusive. Check payment status before attempting another payment.")),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RetestInput { reason: String, requested_remedy: String, #[serde(default)] evidence_url: String }
async fn create_retest_request(
    State(state): State<AppState>, Extension(user): Extension<User>, Path(path): Path<CheckoutPath>, Json(input): Json<RetestInput>,
) -> Result<impl IntoResponse, ApiError> {
    require_verified(&user)?;
    if input.reason.trim().len() < 20 || input.reason.trim().len() > 1500 { return Err(ApiError::bad("Explain the issue in 20–1,500 characters.")); }
    if !["retest", "refund"].contains(&input.requested_remedy.as_str()) { return Err(ApiError::bad("Choose either a retest or refund.")); }
    if !input.evidence_url.is_empty() {
        let u = url::Url::parse(&input.evidence_url).map_err(|_| ApiError::bad("Enter a valid evidence URL."))?;
        if u.scheme() != "https" { return Err(ApiError::bad("Evidence links must use HTTPS.")); }
    }
    rate_limit(&state.pool, &format!("retest:{}", user.id), 4, 3600).await?;
    let mut tx = state.pool.begin().await?;
    let campaign = sqlx::query(r#"
      SELECT c.status,c.completed_at,c.is_comped_retest,
        EXISTS(SELECT 1 FROM retest_requests rr WHERE rr.campaign_id=c.id AND rr.status IN ('approved_retest','approved_refund')) AS remedy_already_approved
      FROM campaigns c WHERE c.id=$1 AND c.customer_user_id=$2 FOR UPDATE
    "#).bind(path.id).bind(&user.id).fetch_optional(&mut *tx).await?;
    let campaign = campaign.ok_or_else(|| ApiError::not_found("Campaign not found."))?;
    let status: String = sqlx::Row::try_get(&campaign,"status").map_err(|_| ApiError::bad("Invalid campaign status"))?;
    let comped: bool = sqlx::Row::try_get(&campaign,"is_comped_retest").unwrap_or(false);
    let already: bool = sqlx::Row::try_get(&campaign,"remedy_already_approved").unwrap_or(false);
    let completed: Option<DateTime<Utc>> = sqlx::Row::try_get(&campaign,"completed_at").unwrap_or(None);
    if status != "completed" { return Err(ApiError::conflict("A retest or refund review can be requested after a campaign is completed.")); }
    if comped || already { return Err(ApiError::conflict("A complimentary retest or refund remedy has already been approved for this campaign.")); }
    if completed.map(|d| d < Utc::now() - ChronoDuration::days(14)).unwrap_or(true) { return Err(ApiError::conflict("Requests must be submitted within 14 calendar days of campaign completion.")); }
    let pending: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM retest_requests WHERE campaign_id=$1 AND status IN ('pending','processing'))")
        .bind(path.id).fetch_one(&mut *tx).await?;
    if pending { return Err(ApiError::conflict("A review request is already pending for this campaign.")); }
    let request_id: Uuid = sqlx::query_scalar(r#"
      INSERT INTO retest_requests(campaign_id,customer_user_id,customer_reason,requested_remedy,evidence_url)
      VALUES($1,$2,$3,$4,$5) RETURNING id
    "#).bind(path.id).bind(&user.id).bind(input.reason.trim()).bind(&input.requested_remedy).bind(if input.evidence_url.is_empty(){None}else{Some(input.evidence_url.trim())}).fetch_one(&mut *tx).await?;
    sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'retest_requested',$3)")
        .bind(path.id).bind(&user.id).bind(json!({"retestRequestId":request_id,"requestedRemedy":input.requested_remedy})).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({"ok":true,"retestRequestId":request_id}))))
}

async fn paystack_request(state: &AppState, method: Method, path: &str, body: Option<Value>) -> Result<Value, ApiError> {
    let url = format!("https://api.paystack.co{}", path);
    let mut req = state.http.request(method, &url).bearer_auth(&state.config.paystack_secret);
    if let Some(value) = body { req = req.json(&value); }
    let response = req.send().await.map_err(|_| ApiError::unavailable("Paystack could not be reached. Please try again shortly."))?;
    let status = response.status();
    let payload: Value = response.json().await.unwrap_or(Value::Null);
    if !status.is_success() || payload.get("status").and_then(Value::as_bool) != Some(true) {
        let message = payload.get("message").and_then(Value::as_str).unwrap_or("Paystack rejected the request.").to_string();
        let safe_status = if status.is_client_error() { status } else { StatusCode::SERVICE_UNAVAILABLE };
        return Err(ApiError::new(safe_status, message));
    }
    Ok(payload.get("data").cloned().unwrap_or(Value::Null))
}

async fn initialize_paystack(state: &AppState, email: &str, reference: &str, campaign_id: Uuid, callback_url: &str) -> Result<String, ApiError> {
    let data = paystack_request(state, Method::POST, "/transaction/initialize", Some(json!({
        "email":email,
        "amount":CAMPAIGN_AMOUNT_MINOR,
        "currency":"USD",
        "reference":reference,
        "callback_url":callback_url,
        "channels":["card"],
        "metadata":{
            "campaign_id":campaign_id.to_string(),
            "service":"android-testers-12-testers-15-days",
            "custom_fields":[{"display_name":"Campaign","variable_name":"campaign_id","value":campaign_id.to_string()}]
        }
    }))).await?;
    let authorization = data.get("authorization_url").and_then(Value::as_str).ok_or_else(|| ApiError::unavailable("Paystack did not return a checkout URL."))?;
    if !authorization.starts_with("https://checkout.paystack.com/") { return Err(ApiError::unavailable("Paystack returned an unexpected checkout address.")); }
    Ok(authorization.to_string())
}

async fn verify_paystack(state: &AppState, reference: &str) -> Result<Value, ApiError> {
    paystack_request(state, Method::GET, &format!("/transaction/verify/{}", urlencoding::encode(reference)), None).await
}

async fn finalize_payment(state: &AppState, reference: &str) -> Result<bool, ApiError> {
    let payment = sqlx::query(r#"
      SELECT p.campaign_id,p.status AS payment_status,u.email AS customer_email
      FROM payments p JOIN campaigns c ON c.id=p.campaign_id
      JOIN app_users u ON u.auth_user_id=c.customer_user_id WHERE p.provider_reference=$1
    "#).bind(reference).fetch_optional(&state.pool).await?;
    let row = payment.ok_or_else(|| ApiError::not_found("Payment reference was not found."))?;
    let campaign_id: Uuid = sqlx::Row::try_get(&row,"campaign_id").map_err(|_| ApiError::bad("Invalid payment record"))?;
    let payment_status: String = sqlx::Row::try_get(&row,"payment_status").map_err(|_| ApiError::bad("Invalid payment status"))?;
    let customer_email: String = sqlx::Row::try_get(&row,"customer_email").map_err(|_| ApiError::bad("Invalid customer record"))?;
    if payment_status == "success" { return Ok(true); }

    let transaction = verify_paystack(state, reference).await?;
    let valid = transaction.get("status").and_then(Value::as_str) == Some("success")
        && transaction.get("reference").and_then(Value::as_str) == Some(reference)
        && transaction.get("amount").and_then(Value::as_i64) == Some(CAMPAIGN_AMOUNT_MINOR)
        && transaction.get("currency").and_then(Value::as_str) == Some("USD")
        && transaction.pointer("/customer/email").and_then(Value::as_str).map(|e| e.eq_ignore_ascii_case(&customer_email)).unwrap_or(false)
        && transaction.pointer("/metadata/campaign_id").and_then(Value::as_str) == Some(campaign_id.to_string().as_str());
    if !valid { return Err(ApiError::new(StatusCode::PAYMENT_REQUIRED, "Paystack has not confirmed the expected $10 USD payment for this campaign.")); }

    let mut tx = state.pool.begin().await?;
    let transaction_id = transaction.get("id").map(|v| v.to_string().trim_matches('"').to_string());
    let changed = sqlx::query(r#"
      UPDATE payments SET status='success',provider_transaction_id=$2,verified_at=now(),raw_provider_event=$3,updated_at=now()
      WHERE provider_reference=$1 AND status <> 'success' RETURNING campaign_id
    "#).bind(reference).bind(transaction_id).bind(&transaction).fetch_optional(&mut *tx).await?;
    if changed.is_some() {
        sqlx::query("UPDATE campaigns SET status='paid_queued',updated_at=now() WHERE id=$1 AND status IN ('payment_pending','awaiting_payment')")
            .bind(campaign_id).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO campaign_events(campaign_id,event_type,details) VALUES($1,'payment_verified',$2)")
            .bind(campaign_id).bind(json!({"provider":"paystack","currency":"USD","amountMinor":1000})).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    if changed.is_some() {
        let app_name: String = sqlx::query_scalar("SELECT a.app_name FROM campaigns c JOIN apps a ON a.id=c.app_id WHERE c.id=$1").bind(campaign_id).fetch_one(&state.pool).await?;
        send_email(state,&customer_email,&format!("Payment confirmed: {app_name}"),"Your $10 payment is confirmed.","Paystack confirmed the campaign payment. Your campaign is queued for the 12-person tester pool; the 15-day clock starts after all 12 opt-ins are confirmed.","/dashboard").await;
        Ok(true)
    } else { Ok(false) }
}

async fn mark_payment_failed(state: &AppState, reference: &str) -> Result<bool, ApiError> {
    let row = sqlx::query("SELECT campaign_id,status FROM payments WHERE provider_reference=$1")
        .bind(reference).fetch_optional(&state.pool).await?;
    let Some(row) = row else { return Ok(false); };
    let campaign_id: Uuid = sqlx::Row::try_get(&row,"campaign_id").map_err(|_| ApiError::bad("Invalid payment record"))?;
    let status: String = sqlx::Row::try_get(&row,"status").map_err(|_| ApiError::bad("Invalid payment status"))?;
    if status == "success" { return Ok(false); }
    let transaction = verify_paystack(state, reference).await?;
    let provider_status = transaction.get("status").and_then(Value::as_str).unwrap_or("");
    if !["failed","abandoned"].contains(&provider_status) { return Ok(false); }
    let mut tx = state.pool.begin().await?;
    let changed = sqlx::query("UPDATE payments SET status='failed',raw_provider_event=$2,updated_at=now() WHERE provider_reference=$1 AND status <> 'success' RETURNING id")
        .bind(reference).bind(&transaction).fetch_optional(&mut *tx).await?;
    if changed.is_some() {
        sqlx::query("UPDATE campaigns SET status='awaiting_payment',updated_at=now() WHERE id=$1 AND status='payment_pending'").bind(campaign_id).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO campaign_events(campaign_id,event_type,details) VALUES($1,'payment_failed',$2)")
            .bind(campaign_id).bind(json!({"provider":"paystack","reference":reference,"providerStatus":provider_status})).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(changed.is_some())
}

#[derive(Deserialize)]
struct VerifyPaymentInput { reference: String }
async fn verify_payment_endpoint(
    State(state): State<AppState>, Extension(user): Extension<User>, Json(input): Json<VerifyPaymentInput>,
) -> Result<Json<Value>, ApiError> {
    if input.reference.len() < 8 || input.reference.len() > 80 || !input.reference.chars().all(|c| c.is_ascii_alphanumeric() || "_.=-".contains(c)) {
        return Err(ApiError::bad("Invalid payment reference."));
    }
    let own: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM payments p JOIN campaigns c ON c.id=p.campaign_id WHERE p.provider_reference=$1 AND c.customer_user_id=$2)")
        .bind(&input.reference).bind(&user.id).fetch_one(&state.pool).await?;
    if !own { return Err(ApiError::not_found("Payment not found.")); }
    match finalize_payment(&state,&input.reference).await {
        Ok(_) => Ok(Json(json!({"ok":true,"status":"success"}))),
        Err(err) if err.status == StatusCode::PAYMENT_REQUIRED => {
            if mark_payment_failed(&state,&input.reference).await.unwrap_or(false) { Ok(Json(json!({"ok":true,"status":"failed"}))) }
            else { Ok(Json(json!({"ok":true,"status":"pending"}))) }
        }
        Err(err) => Err(err),
    }
}

async fn payment_callback(State(state): State<AppState>, Query(query): Query<std::collections::HashMap<String,String>>) -> Response {
    let reference = query.get("reference").or_else(||query.get("trxref")).cloned().unwrap_or_default();
    let status = if reference.len() >= 8 && reference.len() <= 80 {
        match finalize_payment(&state,&reference).await {
            Ok(_) => "success",
            Err(_) => if mark_payment_failed(&state,&reference).await.unwrap_or(false) { "failed" } else { "pending" },
        }
    } else { "invalid" };
    let target = format!("{}/payment/result?status={}",state.config.frontend_url,status);
    Redirect::to(&target).into_response()
}

type HmacSha512 = Hmac<Sha512>;
fn verify_paystack_signature(headers: &HeaderMap, body: &[u8], webhook_secrets: &[String], legacy_secret: &str) -> bool {
    if let Some(header_value) = headers.get("paystack-signature").and_then(|v| v.to_str().ok()) {
        let mut timestamp: Option<i64> = None;
        let mut signatures: Vec<(String, String)> = Vec::new();
        for part in header_value.split(',') {
            let mut kv = part.trim().splitn(2, '=');
            let key = kv.next().unwrap_or("").trim();
            let value = kv.next().unwrap_or("").trim();
            if key == "t" {
                if timestamp.is_some() { return false; }
                timestamp = value.parse::<i64>().ok();
            } else if key == "v1" {
                if let Some((kid, signature)) = value.split_once(':') {
                    signatures.push((kid.to_string(), signature.to_string()));
                }
            }
        }
        if let Some(ts) = timestamp {
            let now = Utc::now().timestamp();
            if ts.abs_diff(now) <= 300 {
                for secret in webhook_secrets {
                    let mut mac = match HmacSha512::new_from_slice(secret.as_bytes()) {
                        Ok(value) => value,
                        Err(_) => return false,
                    };
                    mac.update(ts.to_string().as_bytes());
                    mac.update(b".");
                    mac.update(body);
                    let expected = mac.finalize().into_bytes();
                    for (_kid, signature) in &signatures {
                        if signature.len() != 128 { continue; }
                        if let Ok(actual) = hex::decode(signature) {
                            if expected.as_slice().ct_eq(actual.as_slice()).into() { return true; }
                        }
                    }
                }
            }
        }
    }
    // Compatibility with the original Paystack signature while the new whsec_ mode is enabled.
    if let Some(signature) = headers.get("x-paystack-signature").and_then(|v| v.to_str().ok()) {
        if let Ok(actual) = hex::decode(signature) {
            if let Ok(mut mac) = HmacSha512::new_from_slice(legacy_secret.as_bytes()) {
                mac.update(body);
                if mac.verify_slice(&actual).is_ok() { return true; }
            }
        }
    }
    false
}

fn valid_paystack_signature(headers: &HeaderMap, body: &[u8], state: &AppState) -> bool {
    verify_paystack_signature(
        headers,
        body,
        &state.config.paystack_webhook_secrets,
        &state.config.paystack_secret,
    )
}

async fn process_paystack_event(state: &AppState, event: &Value) -> Result<(), ApiError> {
    let event_type = event.get("event").and_then(Value::as_str).unwrap_or("unknown").to_string();
    let data = event.get("data").cloned().unwrap_or(Value::Null);
    let transaction_reference = data.get("reference")
        .or_else(|| data.get("transaction_reference"))
        .and_then(Value::as_str).map(str::to_string);
    let refund_reference = data.get("refund_reference").and_then(Value::as_str).map(str::to_string);

    if event_type == "charge.success" {
        let reference = transaction_reference.as_deref()
            .ok_or_else(|| ApiError::bad("Paystack charge.success event has no transaction reference."))?;
        match finalize_payment(state, reference).await {
            Ok(_) => {},
            Err(err) if err.status == StatusCode::NOT_FOUND => {
                warn!(reference, "Paystack success webhook has no matching local payment; retrying for reconciliation");
                return Err(err);
            }
            Err(err) => return Err(err),
        }
    } else if event_type == "charge.failed" {
        if let Some(reference) = transaction_reference.as_deref() {
            let _ = mark_payment_failed(state, reference).await?;
        }
    } else if event_type.starts_with("refund.") {
        let mapped = match event_type.as_str() {
            "refund.pending" => Some("pending"),
            "refund.processing" => Some("processing"),
            "refund.needs-attention" => Some("needs_attention"),
            "refund.failed" => Some("failed"),
            "refund.processed" => Some("succeeded"),
            _ => None,
        };
        if let Some(status) = mapped {
            let mut tx = state.pool.begin().await?;
            let row = sqlx::query(r#"
              WITH target AS (
                SELECT r.id,r.payment_id,r.retest_request_id FROM refunds r LEFT JOIN payments p ON p.id=r.payment_id
                WHERE r.provider_reference=$1 OR ($2::text IS NOT NULL AND p.provider_reference=$2 AND r.status IN ('initiating','pending','processing','needs_attention'))
                ORDER BY (r.provider_reference=$1) DESC,r.created_at DESC LIMIT 1 FOR UPDATE OF r
              ) UPDATE refunds r SET status=$3,raw_provider_event=$4,processed_at=CASE WHEN $3='succeeded' THEN now() ELSE processed_at END,updated_at=now()
                FROM target t WHERE r.id=t.id AND r.status NOT IN ('succeeded','failed') RETURNING r.id,t.payment_id,t.retest_request_id
            "#)
                .bind(refund_reference.as_deref().unwrap_or(""))
                .bind(transaction_reference.as_deref())
                .bind(status)
                .bind(event)
                .fetch_optional(&mut *tx).await?;
            if let Some(row) = row {
                let payment_id: Uuid = sqlx::Row::try_get(&row, "payment_id").map_err(|_| ApiError::bad("Invalid refund record"))?;
                let request_id: Option<Uuid> = sqlx::Row::try_get(&row, "retest_request_id").unwrap_or(None);
                if status == "succeeded" {
                    sqlx::query("UPDATE payments SET status='refunded',updated_at=now() WHERE id=$1")
                        .bind(payment_id).execute(&mut *tx).await?;
                    if let Some(rid) = request_id {
                        sqlx::query("UPDATE retest_requests SET status='approved_refund' WHERE id=$1 AND status='processing'")
                            .bind(rid).execute(&mut *tx).await?;
                    }
                    sqlx::query("UPDATE campaigns SET status='refunded',updated_at=now() WHERE id=(SELECT campaign_id FROM payments WHERE id=$1)")
                        .bind(payment_id).execute(&mut *tx).await?;
                } else if status == "failed" {
                    sqlx::query("UPDATE campaigns SET status='completed',updated_at=now() WHERE id=(SELECT campaign_id FROM payments WHERE id=$1) AND status='refund_pending'")
                        .bind(payment_id).execute(&mut *tx).await?;
                    if let Some(rid) = request_id {
                        sqlx::query("UPDATE retest_requests SET status='pending',decision_by_user_id=NULL,decision_note=NULL,decided_at=NULL WHERE id=$1 AND status IN ('processing','approved_refund')")
                            .bind(rid).execute(&mut *tx).await?;
                        sqlx::query("UPDATE refunds SET retest_request_id=NULL WHERE id=(SELECT id FROM refunds WHERE payment_id=$1 AND provider_reference=$2)")
                            .bind(payment_id).bind(refund_reference.as_deref().unwrap_or("")).execute(&mut *tx).await?;
                    }
                } else if status == "needs_attention" {
                    warn!(payment_id = %payment_id, "Paystack refund needs merchant action");
                }
            } else {
                warn!(event_type, "Paystack refund event did not match a local refund record; retrying for reconciliation");
                return Err(ApiError::not_found("No local refund record matched this Paystack event."));
            }
            tx.commit().await?;
        }
    }
    Ok(())
}

async fn claim_next_webhook(pool: &PgPool) -> Result<Option<(Uuid, Value, i32)>, ApiError> {
    let mut tx = pool.begin().await?;
    let row = sqlx::query(r#"
      WITH candidate AS (
        SELECT id FROM paystack_webhook_events
        WHERE payload IS NOT NULL AND (
          (processing_status='pending' AND next_attempt_at <= now()) OR
          (processing_status='processing' AND COALESCE(locked_at,received_at) < now() - interval '2 minutes')
        )
        ORDER BY received_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE paystack_webhook_events e
      SET processing_status='processing',attempts=attempts+1,locked_at=now()
      FROM candidate c WHERE e.id=c.id
      RETURNING e.id,e.payload,e.attempts
    "#).fetch_optional(&mut *tx).await?;
    tx.commit().await?;
    match row {
        Some(row) => Ok(Some((
            sqlx::Row::try_get(&row, "id").map_err(|_| ApiError::bad("Invalid webhook record"))?,
            sqlx::Row::try_get(&row, "payload").map_err(|_| ApiError::bad("Webhook payload is missing"))?,
            sqlx::Row::try_get(&row, "attempts").map_err(|_| ApiError::bad("Invalid webhook attempt count"))?,
        ))),
        None => Ok(None),
    }
}

async fn webhook_worker(state: AppState) {
    loop {
        match claim_next_webhook(&state.pool).await {
            Ok(Some((id, event, attempts))) => {
                match process_paystack_event(&state, &event).await {
                    Ok(()) => {
                        if let Err(err) = sqlx::query("UPDATE paystack_webhook_events SET processing_status='processed',last_error=NULL,locked_at=NULL,processed_at=now() WHERE id=$1")
                            .bind(id).execute(&state.pool).await {
                            error!(webhook_id=%id,error=%err,"could not mark webhook event as processed");
                        }
                    }
                    Err(err) => {
                        let final_attempt = attempts >= 8;
                        let status = if final_attempt { "failed" } else { "pending" };
                        let update = sqlx::query(r#"
                          UPDATE paystack_webhook_events
                          SET processing_status=$2,last_error=$3,locked_at=NULL,
                              next_attempt_at=now()+make_interval(secs => LEAST(300,power(2,$4)::int))
                          WHERE id=$1
                        "#).bind(id).bind(status).bind(&err.message).bind(attempts).execute(&state.pool).await;
                        if let Err(update_err) = update {
                            error!(webhook_id=%id,error=%update_err,"could not schedule webhook retry");
                        }
                        error!(webhook_id=%id,attempts,status,error=%err,"Paystack webhook processing failed");
                    }
                }
            }
            Ok(None) => tokio::time::sleep(Duration::from_secs(2)).await,
            Err(err) => {
                error!(error=%err,"Paystack webhook worker could not claim event");
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

async fn paystack_webhook(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Result<Json<Value>, ApiError> {
    if body.len() > 512_000 {
        return Err(ApiError::new(StatusCode::PAYLOAD_TOO_LARGE, "Webhook payload too large."));
    }
    if !valid_paystack_signature(&headers, &body, &state) {
        return Err(ApiError::new(StatusCode::UNAUTHORIZED, "Invalid Paystack webhook signature."));
    }
    let event: Value = serde_json::from_slice(&body).map_err(|_| ApiError::bad("Invalid webhook JSON."))?;
    let event_type = event.get("event").and_then(Value::as_str).unwrap_or("unknown").to_string();
    let data = event.get("data").cloned().unwrap_or(Value::Null);
    let transaction_reference = data.get("reference").or_else(|| data.get("transaction_reference"))
        .and_then(Value::as_str).map(str::to_string);
    let refund_reference = data.get("refund_reference").and_then(Value::as_str).map(str::to_string);
    let provider_reference = if event_type.starts_with("refund.") {
        refund_reference.clone().or(transaction_reference.clone())
    } else { transaction_reference.clone() };
    let payload_hash = hex::encode(Sha256::digest(&body));
    let inserted = sqlx::query(r#"
      INSERT INTO paystack_webhook_events(payload_hash,event_type,provider_reference,payload,processing_status)
      VALUES($1,$2,$3,$4,'pending')
      ON CONFLICT(payload_hash) DO UPDATE
        SET processing_status='pending',attempts=0,next_attempt_at=now(),last_error=NULL,locked_at=NULL
        WHERE paystack_webhook_events.processing_status='failed'
      RETURNING id
    "#)
        .bind(&payload_hash).bind(&event_type).bind(&provider_reference).bind(&event)
        .fetch_optional(&state.pool).await?;
    if inserted.is_none() {
        // A duplicate event is already queued or has been processed. Acknowledge it
        // to prevent needless Paystack retries; database idempotency handles delivery.
        return Ok(Json(json!({"received":true,"duplicate":true})));
    }
    // Processing is performed by the durable database-backed worker, not inside
    // the 30-second webhook request. A verified event is safely persisted first.
    Ok(Json(json!({"received":true,"queued":true})))
}

async fn admin_list_failed_webhooks(
    State(state): State<AppState>, Extension(user): Extension<User>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&user)?;
    let events = sqlx::query_scalar::<_, Value>(r#"
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',id,'event_type',event_type,'provider_reference',provider_reference,
        'attempts',attempts,'last_error',last_error,'received_at',received_at
      ) ORDER BY received_at ASC),'[]'::jsonb)
      FROM paystack_webhook_events WHERE processing_status='failed'
    "#).fetch_one(&state.pool).await?;
    Ok(Json(json!({"events":events})))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RetryWebhookInput { id: Uuid }

async fn admin_retry_webhook(
    State(state): State<AppState>, Extension(user): Extension<User>, Json(input): Json<RetryWebhookInput>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&user)?;
    let changed = sqlx::query(r#"
      UPDATE paystack_webhook_events SET processing_status='pending',attempts=0,
        next_attempt_at=now(),last_error=NULL,locked_at=NULL
      WHERE id=$1 AND processing_status='failed' RETURNING id
    "#).bind(input.id).fetch_optional(&state.pool).await?;
    if changed.is_none() { return Err(ApiError::conflict("This webhook event is not failed or has already been retried.")); }
    sqlx::query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,details) VALUES($1,'retry_webhook','webhook_event',$2,'{}'::jsonb)")
        .bind(&user.id).bind(input.id).execute(&state.pool).await?;
    Ok(Json(json!({"ok":true,"queued":true})))
}

async fn admin_get_testers(State(state): State<AppState>, Extension(user): Extension<User>) -> Result<Json<Value>, ApiError> {
    require_admin(&user)?;
    let testers=sqlx::query_scalar::<_,Value>("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.email),'[]'::jsonb) FROM (SELECT id,email,active,created_at FROM testers ORDER BY email) t")
        .fetch_one(&state.pool).await?;
    let locked:bool=sqlx::query_scalar("SELECT COALESCE((SELECT locked_at IS NOT NULL FROM tester_pool_state WHERE singleton_id=TRUE),FALSE)")
        .fetch_one(&state.pool).await?;
    let active_count= testers.as_array().map(|a|a.iter().filter(|v|v.get("active").and_then(Value::as_bool)==Some(true)).count()).unwrap_or(0);
    Ok(Json(json!({"testers":testers,"activeCount":active_count,"locked":locked})))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TesterPoolInput { emails: Vec<String> }
async fn admin_replace_testers(
    State(state): State<AppState>, Extension(user): Extension<User>, Json(input): Json<TesterPoolInput>,
) -> Result<Json<Value>,ApiError> {
    require_admin(&user)?;
    if input.emails.len()!=12 { return Err(ApiError::bad("Enter exactly 12 valid, distinct Google account email addresses.")); }
    let emails:Vec<String>=input.emails.iter().map(|e|e.trim().to_lowercase()).collect();
    if emails.iter().any(|e|!is_valid_email(e)) || emails.iter().collect::<std::collections::HashSet<_>>().len()!=12 {
        return Err(ApiError::bad("Enter exactly 12 valid, distinct Google account email addresses."));
    }
    let mut tx=state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(CAMPAIGN_LOCK).execute(&mut *tx).await?;
    let locked_row: Option<bool> = sqlx::query_scalar("SELECT locked_at IS NOT NULL FROM tester_pool_state WHERE singleton_id=TRUE FOR UPDATE")
        .fetch_optional(&mut *tx).await?;
    let locked = locked_row.unwrap_or(false);
    if locked { return Err(ApiError::conflict("The tester pool is locked because a customer has already viewed the addresses.")); }
    let has_campaign:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM campaigns)").fetch_one(&mut *tx).await?;
    if has_campaign { return Err(ApiError::conflict("The tester pool cannot be changed after the first campaign has been submitted.")); }
    sqlx::query("UPDATE testers SET active=FALSE,updated_at=now()").execute(&mut *tx).await?;
    for email in &emails {
        sqlx::query("INSERT INTO testers(email,active) VALUES($1,TRUE) ON CONFLICT(email) DO UPDATE SET active=TRUE,updated_at=now()")
            .bind(email).execute(&mut *tx).await?;
    }
    sqlx::query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,details) VALUES($1,'replace_tester_pool','tester_pool',gen_random_uuid(),$2)")
        .bind(&user.id).bind(json!({"activeTesterCount":12})).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"ok":true,"activeCount":12})))
}

async fn admin_list_campaigns(State(state): State<AppState>, Extension(user): Extension<User>) -> Result<Json<Value>,ApiError> {
    require_admin(&user)?; // This check is intentionally before any customer/tester data is queried.
    let mut campaigns=sqlx::query_scalar::<_,Value>(r#"
      SELECT COALESCE(jsonb_agg(item ORDER BY sort_order,created_at),'[]'::jsonb) FROM (
        SELECT c.created_at,
          CASE c.status WHEN 'awaiting_review' THEN 0 WHEN 'paid_queued' THEN 1 WHEN 'enrolling' THEN 2 WHEN 'running' THEN 3 ELSE 4 END AS sort_order,
          jsonb_build_object(
            'id',c.id,'status',c.status,'created_at',c.created_at,'actual_start_at',c.actual_start_at,'actual_end_at',c.actual_end_at,
            'is_comped_retest',c.is_comped_retest,'payment_required',c.payment_required,'parent_campaign_id',c.parent_campaign_id,
            'app_name',a.app_name,'package_name',a.package_name,'opt_in_url',a.opt_in_url,'setup_status',a.setup_status,
            'admin_note',a.admin_note,'setup_evidence',a.setup_evidence,'customer_email',u.email,
            'payment_status',p.status,'provider_reference',p.provider_reference,
            'assigned_testers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id',ct.id,'testerId',t.id,'email',t.email,'status',ct.status,'optedInAt',ct.opted_in_at,
              'lastConfirmedAt',ct.last_confirmed_at,'checkins',(SELECT count(*)::int FROM campaign_tester_checkins ci WHERE ci.campaign_tester_id=ct.id)
            ) ORDER BY t.email) FROM campaign_testers ct JOIN testers t ON t.id=ct.tester_id WHERE ct.campaign_id=c.id),'[]'::jsonb)
          ) AS item
        FROM campaigns c JOIN apps a ON a.id=c.app_id JOIN app_users u ON u.auth_user_id=c.customer_user_id
        LEFT JOIN payments p ON p.campaign_id=c.id
      ) records
    "#).fetch_one(&state.pool).await?;
    let active_count:i64=sqlx::query_scalar("SELECT count(*) FROM testers WHERE active=TRUE").fetch_one(&state.pool).await?;
    if let Some(items)=campaigns.as_array_mut() {
        for campaign in items.iter_mut() {
            if let Some(evidence)=campaign.get_mut("setup_evidence").and_then(Value::as_array_mut) {
                for entry in evidence.iter_mut() {
                    let key=entry.get("key").and_then(Value::as_str).unwrap_or("");
                    let url=if key.is_empty(){None}else{signed_evidence_url(&state,key).await.ok()};
                    if let Some(object)=entry.as_object_mut(){ object.insert("url".to_string(),url.map(Value::String).unwrap_or(Value::Null)); }
                }
            }
        }
    }
    Ok(Json(json!({"campaigns":campaigns,"activeTesterCount":active_count})))
}

#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
struct CampaignAction {
    action:String,
    #[serde(default)] note:String,
    #[serde(default)] campaign_tester_id:Option<Uuid>,
    #[serde(default)] status:Option<String>,
    #[serde(default)] summary:String,
}
async fn admin_update_campaign(
    State(state):State<AppState>,Extension(user):Extension<User>,Path(path):Path<CheckoutPath>,Json(body):Json<CampaignAction>,
)->Result<Json<Value>,ApiError>{
    require_admin(&user)?;
    let mut clock_started=false;
    let mut tx=state.pool.begin().await?;
    match body.action.as_str(){
        "approve_setup"=>{
            let changed=sqlx::query("UPDATE apps SET setup_status='approved',admin_note=NULL,updated_at=now() WHERE id=(SELECT app_id FROM campaigns WHERE id=$1 AND status='awaiting_review') RETURNING id")
                .bind(path.id).fetch_optional(&mut *tx).await?;
            if changed.is_none(){return Err(ApiError::conflict("This setup is no longer awaiting review."));}
            sqlx::query("UPDATE campaigns SET status='awaiting_payment',updated_at=now() WHERE id=$1 AND status='awaiting_review'").bind(path.id).execute(&mut *tx).await?;
        }
        "request_changes"=>{
            if body.note.trim().len()<5||body.note.trim().len()>1000{return Err(ApiError::bad("Provide a review note between 5 and 1,000 characters."));}
            let changed=sqlx::query("UPDATE apps SET setup_status='needs_changes',admin_note=$2,updated_at=now() WHERE id=(SELECT app_id FROM campaigns WHERE id=$1 AND status='awaiting_review') RETURNING id")
                .bind(path.id).bind(body.note.trim()).fetch_optional(&mut *tx).await?;
            if changed.is_none(){return Err(ApiError::conflict("This setup is no longer awaiting review."));}
            sqlx::query("UPDATE campaigns SET status='needs_changes',updated_at=now() WHERE id=$1").bind(path.id).execute(&mut *tx).await?;
        }
        "start_campaign"=>{
            sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(CAMPAIGN_LOCK).execute(&mut *tx).await?;
            let current:String=sqlx::query_scalar("SELECT status FROM campaigns WHERE id=$1 FOR UPDATE").bind(path.id).fetch_optional(&mut *tx).await?.ok_or_else(||ApiError::not_found("Campaign not found."))?;
            if current!="paid_queued"{return Err(ApiError::conflict("Only a paid or complimentary campaign in the queue can be started."));}
            let active:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM campaigns WHERE status IN ('enrolling','running'))").fetch_one(&mut *tx).await?;
            if active{return Err(ApiError::conflict("The 12-person tester pool is already assigned to another active campaign."));}
            let count:i64=sqlx::query_scalar("SELECT count(*) FROM testers WHERE active=TRUE").fetch_one(&mut *tx).await?;
            if count!=12{return Err(ApiError::unavailable("Exactly 12 active tester accounts must be configured."));}
            sqlx::query("INSERT INTO campaign_testers(campaign_id,tester_id,status) SELECT $1,id,'assigned' FROM testers WHERE active=TRUE ORDER BY email")
                .bind(path.id).execute(&mut *tx).await?;
            sqlx::query("UPDATE campaigns SET status='enrolling',updated_at=now() WHERE id=$1").bind(path.id).execute(&mut *tx).await?;
            sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'tester_enrollment_started',$3)")
                .bind(path.id).bind(&user.id).bind(json!({"testerCount":12})).execute(&mut *tx).await?;
        }
        "set_tester_status"=>{
            let assignment_id=body.campaign_tester_id.ok_or_else(||ApiError::bad("Missing tester assignment ID."))?;
            let new_status=body.status.as_deref().ok_or_else(||ApiError::bad("Missing tester status."))?;
            if !["opted_in","opted_out"].contains(&new_status){return Err(ApiError::bad("Tester status must be opted_in or opted_out."));}
            let campaign_status:Option<String>=sqlx::query_scalar("SELECT status FROM campaigns WHERE id=$1 FOR UPDATE").bind(path.id).fetch_optional(&mut *tx).await?;
            let campaign_status=campaign_status.ok_or_else(||ApiError::not_found("Campaign not found."))?;
            if !["enrolling","running"].contains(&campaign_status.as_str()){return Err(ApiError::conflict("This campaign is not currently enrolling or running."));}
            let assignment:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM campaign_testers WHERE id=$1 AND campaign_id=$2 FOR UPDATE)")
                .bind(assignment_id).bind(path.id).fetch_one(&mut *tx).await?;
            if !assignment{return Err(ApiError::not_found("Tester assignment not found."));}
            if new_status=="opted_in"{
                sqlx::query("UPDATE campaign_testers SET status='opted_in',opted_in_at=COALESCE(opted_in_at,now()),last_confirmed_at=now() WHERE id=$1")
                    .bind(assignment_id).execute(&mut *tx).await?;
                let opted:i64=sqlx::query_scalar("SELECT count(*) FROM campaign_testers WHERE campaign_id=$1 AND status='opted_in'").bind(path.id).fetch_one(&mut *tx).await?;
                if opted==12 && campaign_status=="enrolling"{
                    clock_started=true;
                    sqlx::query("UPDATE campaigns SET status='running',actual_start_at=now(),actual_end_at=now()+interval '15 days',updated_at=now() WHERE id=$1")
                        .bind(path.id).execute(&mut *tx).await?;
                    sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'15_day_clock_started',$3)")
                        .bind(path.id).bind(&user.id).bind(json!({"testerCount":12,"durationDays":15})).execute(&mut *tx).await?;
                }
            }else{
                sqlx::query("DELETE FROM campaign_tester_checkins WHERE campaign_tester_id IN (SELECT id FROM campaign_testers WHERE campaign_id=$1)")
                    .bind(path.id).execute(&mut *tx).await?;
                sqlx::query("UPDATE campaign_testers SET status='opted_out',opted_in_at=NULL,last_confirmed_at=now() WHERE id=$1")
                    .bind(assignment_id).execute(&mut *tx).await?;
                sqlx::query("UPDATE campaign_testers SET status='assigned',opted_in_at=NULL,last_confirmed_at=NULL WHERE campaign_id=$1 AND id<>$2 AND status='opted_in'")
                    .bind(path.id).bind(assignment_id).execute(&mut *tx).await?;
                sqlx::query("UPDATE campaigns SET status='enrolling',actual_start_at=NULL,actual_end_at=NULL,updated_at=now() WHERE id=$1")
                    .bind(path.id).execute(&mut *tx).await?;
                sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'continuity_reset',$3)")
                    .bind(path.id).bind(&user.id).bind(json!({"reason":"A tester opted out; all 12 testers must re-opt in for a new continuous 15-day period."})).execute(&mut *tx).await?;
            }
        }
        "daily_check_in"=>{
            let assignment_id=body.campaign_tester_id.ok_or_else(||ApiError::bad("Missing tester assignment ID."))?;
            if body.note.trim().len()<10||body.note.trim().len()>1000{return Err(ApiError::bad("Record a genuine testing activity or feedback note of at least 10 characters."));}
            let campaign_day:Option<i32>=sqlx::query_scalar("SELECT floor(extract(epoch FROM (now()-c.actual_start_at))/86400)::int+1 FROM campaign_testers ct JOIN campaigns c ON c.id=ct.campaign_id WHERE ct.id=$1 AND ct.campaign_id=$2 AND ct.status='opted_in' AND c.status='running' AND c.actual_start_at IS NOT NULL")
                .bind(assignment_id).bind(path.id).fetch_optional(&mut *tx).await?;
            let day=campaign_day.ok_or_else(||ApiError::conflict("Only an opted-in tester on a running campaign can be checked in."))?;
            if !(1..=15).contains(&day){return Err(ApiError::conflict("A daily check-in can only be recorded during one of the 15 campaign days."));}
            sqlx::query("INSERT INTO campaign_tester_checkins(campaign_tester_id,campaign_day,note) VALUES($1,$2,$3) ON CONFLICT(campaign_tester_id,campaign_day) DO UPDATE SET note=EXCLUDED.note")
                .bind(assignment_id).bind(day as i16).bind(body.note.trim()).execute(&mut *tx).await?;
            sqlx::query("UPDATE campaign_testers SET last_confirmed_at=now() WHERE id=$1").bind(assignment_id).execute(&mut *tx).await?;
        }
        "complete_campaign"=>{
            if body.summary.trim().len()<20||body.summary.trim().len()>2000{return Err(ApiError::bad("Provide a completion summary of at least 20 characters."));}
            let ready=sqlx::query(r#"
              SELECT c.status,c.actual_end_at,
                (SELECT count(*) FROM campaign_testers ct WHERE ct.campaign_id=c.id AND ct.status='opted_in') AS opted_in_count,
                (SELECT count(*) FROM campaign_testers ct WHERE ct.campaign_id=c.id AND ct.status='opted_in' AND
                  (SELECT count(*) FROM campaign_tester_checkins ci WHERE ci.campaign_tester_id=ct.id AND ci.campaign_day BETWEEN 1 AND 15 AND length(trim(COALESCE(ci.note,'')))>=10)>=15) AS testers_with_15_checkins
              FROM campaigns c WHERE c.id=$1 FOR UPDATE
            "#).bind(path.id).fetch_optional(&mut *tx).await?.ok_or_else(||ApiError::not_found("Campaign not found."))?;
            let status:String=sqlx::Row::try_get(&ready,"status").map_err(|_|ApiError::bad("Invalid campaign status"))?;
            let end:Option<DateTime<Utc>>=sqlx::Row::try_get(&ready,"actual_end_at").unwrap_or(None);
            let opted:i64=sqlx::Row::try_get(&ready,"opted_in_count").unwrap_or(0);
            let checkins:i64=sqlx::Row::try_get(&ready,"testers_with_15_checkins").unwrap_or(0);
            if status!="running"||end.map(|d|d>Utc::now()).unwrap_or(true){return Err(ApiError::conflict("The full 15-day campaign window has not elapsed."));}
            if opted!=12{return Err(ApiError::conflict("All 12 testers must still be opted in before completion."));}
            if checkins!=12{return Err(ApiError::conflict("Every tester must have 15 daily participation notes before completion."));}
            sqlx::query("UPDATE campaigns SET status='completed',completed_at=now(),completion_summary=$2,updated_at=now() WHERE id=$1")
                .bind(path.id).bind(body.summary.trim()).execute(&mut *tx).await?;
            sqlx::query("UPDATE campaign_testers SET status='completed' WHERE campaign_id=$1 AND status='opted_in'").bind(path.id).execute(&mut *tx).await?;
        }
        _=>return Err(ApiError::bad("Unknown campaign action.")),
    }
    sqlx::query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,details) VALUES($1,$2,'campaign',$3,$4)")
        .bind(&user.id).bind(&body.action).bind(path.id).bind(json!({"note":body.note,"campaignTesterId":body.campaign_tester_id,"status":body.status,"summary":body.summary})).execute(&mut *tx).await?;
    tx.commit().await?;

    let customer=sqlx::query("SELECT u.email,a.app_name,c.actual_start_at FROM campaigns c JOIN apps a ON a.id=c.app_id JOIN app_users u ON u.auth_user_id=c.customer_user_id WHERE c.id=$1")
        .bind(path.id).fetch_optional(&state.pool).await?;
    if let Some(row)=customer{
        let email:String=sqlx::Row::try_get(&row,"email").unwrap_or_default();
        let app_name:String=sqlx::Row::try_get(&row,"app_name").unwrap_or_default();
        let (subject,heading,message)=match body.action.as_str(){
            "approve_setup"=>(format!("Setup approved: {app_name}"),"Your Play Console setup passed review.".to_string(),format!("The setup for {app_name} has been approved. You can now pay the $10 USD campaign fee.")),
            "request_changes"=>(format!("Action required: {app_name}"),"A setup correction is required.".to_string(),format!("Please update your Play Console configuration: {}",body.note)),
            "start_campaign"=>(format!("Tester enrollment started: {app_name}"),"Tester enrollment has started.".to_string(),"The 12-person tester pool is being assigned. The 15-day clock starts after all opt-ins are confirmed.".to_string()),
            "complete_campaign"=>(format!("Campaign completed: {app_name}"),"Your 15-day campaign is complete.".to_string(),body.summary.clone()),
            _=> (String::new(),String::new(),String::new()),
        };
        if !subject.is_empty(){send_email(&state,&email,&subject,&heading,&message,"/dashboard").await;}
        if clock_started{
            let start:Option<DateTime<Utc>>=sqlx::Row::try_get(&row,"actual_start_at").unwrap_or(None);
            if let Some(start)=start{send_email(&state,&email,&format!("Your 15-day campaign is now running: {app_name}"),"All 12 testers are opted in.",&format!("The 15-day participation window began at {} UTC.",start.to_rfc3339()),"/dashboard").await;}
        }
    }
    Ok(Json(json!({"ok":true})))
}


fn detect_image_content(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() >= 8 && bytes[..8] == [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a] {
        return Some("image/png");
    }
    if bytes.len() >= 3 && bytes[..3] == [0xff, 0xd8, 0xff] {
        return Some("image/jpeg");
    }
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    None
}

async fn upload_evidence(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    require_verified(&user)?;
    let bucket = state.config.r2_bucket.as_str();
    let Some(client) = state.r2.as_ref() else {
        return Err(ApiError::unavailable("Private evidence storage is not configured yet. Please contact support."));
    };
    rate_limit(&state.pool, &format!("evidence-upload:{}", user.id), 12, 3600).await?;

    let mut selected: Option<(String, Vec<u8>, &'static str)> = None;
    while let Some(field) = multipart.next_field().await.map_err(|_| ApiError::bad("Could not read the upload request."))? {
        if field.name() != Some("file") { continue; }
        if selected.is_some() { return Err(ApiError::bad("Upload one screenshot per request.")); }
        let name = sanitize_filename(field.file_name().unwrap_or("evidence-image"));
        let bytes = field.bytes().await.map_err(|_| ApiError::bad("Could not read the screenshot."))?;
        if bytes.is_empty() || bytes.len() > MAX_UPLOAD_BYTES {
            return Err(ApiError::new(StatusCode::PAYLOAD_TOO_LARGE, "Each screenshot must be 4 MB or smaller."));
        }
        let detected = detect_image_content(&bytes).ok_or_else(|| ApiError::new(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Only PNG, JPEG, and WebP screenshots are accepted."))?;
        selected = Some((name, bytes.to_vec(), detected));
    }
    let (file_name, bytes, content_type) = selected.ok_or_else(|| ApiError::bad("Choose a screenshot to upload."))?;
    let safe_user_id: String = user.id.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')).take(160).collect();
    if safe_user_id.is_empty() { return Err(ApiError::unauthorized()); }
    let object_key = format!("evidence/{}/{}-{}", safe_user_id, Uuid::new_v4(), file_name);

    client.put_object()
        .bucket(bucket)
        .key(&object_key)
        .body(ByteStream::from(bytes.clone()))
        .content_type(content_type)
        .cache_control("private, max-age=0, no-store")
        .metadata("purpose", "play-console-setup-evidence")
        .send().await.map_err(|err| {
            error!(error = %err, "private evidence upload failed");
            ApiError::unavailable("The screenshot could not be stored. Please try again.")
        })?;

    let insert = sqlx::query(
        "INSERT INTO uploads(owner_user_id,object_key,file_name,content_type,byte_size) VALUES($1,$2,$3,$4,$5)"
    ).bind(&user.id).bind(&object_key).bind(&file_name).bind(content_type).bind(bytes.len() as i32).execute(&state.pool).await;
    if let Err(err) = insert {
        warn!(error = %err, "evidence metadata insert failed; deleting orphaned object");
        let _ = client.delete_object().bucket(bucket).key(&object_key).send().await;
        return Err(ApiError::unavailable("The screenshot could not be registered. Please try again."));
    }

    Ok((StatusCode::CREATED, Json(json!({
        "key": object_key,
        "fileName": file_name,
        "contentType": content_type,
        "bytes": bytes.len()
    }))))
}

async fn signed_evidence_url(state: &AppState, key: &str) -> Result<String, ApiError> {
    let bucket = state.config.r2_bucket.as_str();
    let client = state.r2.as_ref()
        .ok_or_else(|| ApiError::unavailable("Private evidence storage is not configured."))?;
    let expires = PresigningConfig::expires_in(Duration::from_secs(900))
        .map_err(|_| ApiError::unavailable("Could not prepare a private evidence link."))?;
    let signed = client.get_object().bucket(bucket).key(key).presigned(expires).await
        .map_err(|err| { warn!(error=%err,"evidence presigning failed"); ApiError::unavailable("Could not prepare a private evidence link.") })?;
    Ok(signed.uri().to_string())
}

async fn admin_list_retests(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
) -> Result<Json<Value>, ApiError> {
    // This authorization check must stay before the retest query.
    require_admin(&user)?;
    let requests = sqlx::query_scalar::<_, Value>(r#"
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',rr.id,'campaign_id',rr.campaign_id,'customer_reason',rr.customer_reason,
        'requested_remedy',rr.requested_remedy,'evidence_url',rr.evidence_url,
        'status',rr.status,'created_at',rr.created_at,'app_name',a.app_name,
        'package_name',a.package_name,'customer_email',u.email,
        'payment_status',p.status,'refund_status',rf.status
      ) ORDER BY rr.created_at ASC),'[]'::jsonb)
      FROM retest_requests rr
      JOIN campaigns c ON c.id=rr.campaign_id
      JOIN apps a ON a.id=c.app_id
      JOIN app_users u ON u.auth_user_id=rr.customer_user_id
      LEFT JOIN payments p ON p.campaign_id=rr.campaign_id
      LEFT JOIN refunds rf ON rf.retest_request_id=rr.id
      WHERE rr.status IN ('pending','processing') OR (rr.status='approved_refund' AND rf.status='needs_attention')
    "#).fetch_one(&state.pool).await?;
    Ok(Json(json!({"requests": requests})))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RetestDecision {
    id: Uuid,
    decision: String,
    note: String,
}

async fn admin_decide_retest(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Json(input): Json<RetestDecision>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&user)?;
    if input.note.trim().len() < 5 || input.note.trim().len() > 1000 {
        return Err(ApiError::bad("Provide a decision note between 5 and 1,000 characters."));
    }
    if !["approve_retest", "refund", "decline"].contains(&input.decision.as_str()) {
        return Err(ApiError::bad("Choose a valid retest decision."));
    }

    if input.decision == "approve_retest" {
        let mut tx = state.pool.begin().await?;
        let found = sqlx::query(r#"
          SELECT rr.id,rr.campaign_id,rr.customer_user_id,rr.requested_remedy,c.app_id
          FROM retest_requests rr JOIN campaigns c ON c.id=rr.campaign_id
          WHERE rr.id=$1 AND rr.status='pending' FOR UPDATE OF rr
        "#).bind(input.id).fetch_optional(&mut *tx).await?;
        let row = found.ok_or_else(|| ApiError::conflict("This request has already been handled."))?;
        let requested: String = sqlx::Row::try_get(&row, "requested_remedy").map_err(|_| ApiError::bad("Invalid request record."))?;
        if requested != "retest" { return Err(ApiError::conflict("The customer requested a refund, not a complimentary retest.")); }
        let campaign_id: Uuid = sqlx::Row::try_get(&row, "campaign_id").map_err(|_| ApiError::bad("Invalid request record."))?;
        let customer_id: String = sqlx::Row::try_get(&row, "customer_user_id").map_err(|_| ApiError::bad("Invalid customer record."))?;
        let app_id: Uuid = sqlx::Row::try_get(&row, "app_id").map_err(|_| ApiError::bad("Invalid app record."))?;
        let new_campaign: Uuid = sqlx::query_scalar(r#"
          INSERT INTO campaigns(app_id,customer_user_id,status,payment_required,is_comped_retest,parent_campaign_id,source_retest_request_id)
          VALUES($1,$2,'paid_queued',FALSE,TRUE,$3,$4) RETURNING id
        "#).bind(app_id).bind(&customer_id).bind(campaign_id).bind(input.id).fetch_one(&mut *tx).await?;
        sqlx::query("UPDATE retest_requests SET status='approved_retest',decision_by_user_id=$2,decision_note=$3,decided_at=now() WHERE id=$1")
            .bind(input.id).bind(&user.id).bind(input.note.trim()).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO campaign_events(campaign_id,actor_user_id,event_type,details) VALUES($1,$2,'complimentary_retest_approved',$3)")
            .bind(campaign_id).bind(&user.id).bind(json!({"retestRequestId":input.id,"newCampaignId":new_campaign,"note":input.note.trim()})).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,details) VALUES($1,'approve_retest','retest_request',$2,$3)")
            .bind(&user.id).bind(input.id).bind(json!({"note":input.note.trim(),"newCampaignId":new_campaign})).execute(&mut *tx).await?;
        tx.commit().await?;
        if let Some(row) = sqlx::query("SELECT u.email,a.app_name FROM app_users u JOIN campaigns c ON c.customer_user_id=u.auth_user_id JOIN apps a ON a.id=c.app_id WHERE c.id=$1")
            .bind(new_campaign).fetch_optional(&state.pool).await? {
            let email: String = sqlx::Row::try_get(&row,"email").unwrap_or_default();
            let app: String = sqlx::Row::try_get(&row,"app_name").unwrap_or_else(|_| "your app".to_string());
            send_email(&state,&email,&format!("Complimentary retest approved: {app}"),"Your complimentary 15-day retest is approved.",&format!("A new campaign for {app} is in the tester-pool queue. It does not require another payment; the 15-day clock starts when all 12 testers are confirmed opted in."),"/dashboard").await;
        }
        return Ok(Json(json!({"ok":true,"decision":"approve_retest","campaignId":new_campaign})));
    }

    if input.decision == "decline" {
        let mut tx = state.pool.begin().await?;
        let row = sqlx::query("UPDATE retest_requests SET status='declined',decision_by_user_id=$2,decision_note=$3,decided_at=now() WHERE id=$1 AND status='pending' RETURNING campaign_id,customer_user_id")
            .bind(input.id).bind(&user.id).bind(input.note.trim()).fetch_optional(&mut *tx).await?
            .ok_or_else(|| ApiError::conflict("This request has already been handled."))?;
        let campaign_id: Uuid = sqlx::Row::try_get(&row,"campaign_id").map_err(|_| ApiError::bad("Invalid request record."))?;
        let customer_id: String = sqlx::Row::try_get(&row,"customer_user_id").map_err(|_| ApiError::bad("Invalid customer record."))?;
        sqlx::query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,details) VALUES($1,'decline_retest','retest_request',$2,$3)")
            .bind(&user.id).bind(input.id).bind(json!({"note":input.note.trim()})).execute(&mut *tx).await?;
        tx.commit().await?;
        if let Some(email) = sqlx::query_scalar::<_,String>("SELECT email FROM app_users WHERE auth_user_id=$1").bind(&customer_id).fetch_optional(&state.pool).await? {
            send_email(&state,&email,"Your review request was declined","We reviewed your request.",&input.note,"/dashboard").await;
        }
        return Ok(Json(json!({"ok":true,"decision":"decline","campaignId":campaign_id})));
    }

    // Refunds are reserved before calling Paystack. A provider timeout is recorded as
    // needs_attention rather than blindly issuing a second refund on a later retry.
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query(r#"
      SELECT rr.campaign_id,rr.customer_user_id,rr.requested_remedy,p.id AS payment_id,
             p.provider_reference,p.provider_transaction_id,p.status AS payment_status
      FROM retest_requests rr
      JOIN payments p ON p.campaign_id=rr.campaign_id
      WHERE rr.id=$1 AND rr.status='pending' FOR UPDATE OF rr,p
    "#).bind(input.id).fetch_optional(&mut *tx).await?
        .ok_or_else(|| ApiError::conflict("The request is unavailable or has already been handled."))?;
    let requested: String = sqlx::Row::try_get(&row,"requested_remedy").unwrap_or_default();
    let payment_status: String = sqlx::Row::try_get(&row,"payment_status").unwrap_or_default();
    if requested != "refund" { return Err(ApiError::conflict("The customer requested a retest, not a refund.")); }
    if payment_status != "success" { return Err(ApiError::conflict("A refund can only be issued after the $10 payment is confirmed.")); }
    let campaign_id: Uuid = sqlx::Row::try_get(&row,"campaign_id").map_err(|_| ApiError::bad("Invalid request record."))?;
    let payment_id: Uuid = sqlx::Row::try_get(&row,"payment_id").map_err(|_| ApiError::bad("Invalid payment record."))?;
    let payment_reference: String = sqlx::Row::try_get(&row,"provider_reference").map_err(|_| ApiError::bad("Invalid payment record."))?;
    let refund_reference = format!("ATRF{}",Uuid::new_v4().simple());
    let refund_id: Uuid = sqlx::query_scalar(r#"
      INSERT INTO refunds(payment_id,retest_request_id,amount_minor,currency,provider_reference,status,reason)
      VALUES($1,$2,1000,'USD',$3,'initiating',$4) RETURNING id
    "#).bind(payment_id).bind(input.id).bind(&refund_reference).bind(input.note.trim()).fetch_one(&mut *tx).await?;
    sqlx::query("UPDATE retest_requests SET status='processing',decision_by_user_id=$2,decision_note=$3,decided_at=now() WHERE id=$1")
        .bind(input.id).bind(&user.id).bind(input.note.trim()).execute(&mut *tx).await?;
    sqlx::query("UPDATE campaigns SET status='refund_pending',updated_at=now() WHERE id=$1").bind(campaign_id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO admin_audit_logs(admin_user_id,action,entity_type,entity_id,details) VALUES($1,'initiate_refund','retest_request',$2,$3)")
        .bind(&user.id).bind(input.id).bind(json!({"note":input.note.trim(),"refundReference":refund_reference})).execute(&mut *tx).await?;
    tx.commit().await?;

    let refund_result = paystack_request(&state, Method::POST, "/refund", Some(json!({
        "transaction": payment_reference,
        "amount": CAMPAIGN_AMOUNT_MINOR,
        "currency": "USD",
        "reference": refund_reference,
        "customer_note": "Android Testers campaign refund",
        "merchant_note": input.note.trim()
    }))).await;

    match refund_result {
        Ok(data) => {
            let provider_refund_id = data.get("id").map(|v|v.to_string().trim_matches('"').to_string());
            sqlx::query("UPDATE refunds SET status='pending',provider_refund_id=$2,raw_provider_event=$3,updated_at=now() WHERE id=$1")
                .bind(refund_id).bind(provider_refund_id).bind(&data).execute(&state.pool).await?;
            if let Some(customer) = sqlx::query("SELECT u.email,a.app_name FROM campaigns c JOIN apps a ON a.id=c.app_id JOIN app_users u ON u.auth_user_id=c.customer_user_id WHERE c.id=$1")
                .bind(campaign_id).fetch_optional(&state.pool).await? {
                let email: String = sqlx::Row::try_get(&customer,"email").unwrap_or_default();
                let app: String = sqlx::Row::try_get(&customer,"app_name").unwrap_or_else(|_| "your app".into());
                send_email(&state,&email,&format!("Refund submitted: {app}"),"Your $10 USD refund was submitted to Paystack.","Paystack is processing the refund. The time it takes to appear depends on the card issuer or bank.","/dashboard").await;
            }
            Ok(Json(json!({"ok":true,"decision":"refund","status":"pending","refundReference":refund_reference})))
        }
        Err(err) => {
            error!(error=%err,"Paystack refund request needs manual reconciliation");
            sqlx::query("UPDATE refunds SET status='needs_attention',updated_at=now() WHERE id=$1").bind(refund_id).execute(&state.pool).await?;
            sqlx::query("UPDATE retest_requests SET status='approved_refund' WHERE id=$1 AND status='processing'").bind(input.id).execute(&state.pool).await?;
            Ok(Json(json!({"ok":true,"decision":"refund","status":"needs_attention","message":"Paystack did not confirm the refund request. Review this transaction in the Paystack dashboard before taking further action."})))
        }
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "android_testers_api=info,tower_http=info".into()))
        .init();

    let state = match build_state().await {
        Ok(state) => state,
        Err(err) => {
            eprintln!("Android Testers API could not start: {err}");
            std::process::exit(1);
        }
    };
    let port: u16 = env::var("PORT").ok().and_then(|v|v.parse().ok()).unwrap_or(10000);
    let address = SocketAddr::from(([0,0,0,0], port));
    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("Could not bind API listener: {err}");
            std::process::exit(1);
        }
    };
    info!(%address, "Android Testers API started");
    let worker_state = state.clone();
    tokio::spawn(async move { webhook_worker(worker_state).await; });
    if let Err(err) = axum::serve(listener, make_router(state)).await {
        error!(error=%err,"API server stopped unexpectedly");
        std::process::exit(1);
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn neon_connection_string_strips_sqlx_unsupported_channel_binding_but_keeps_tls() {
        let input = "postgresql://owner:pass@example.neon.tech/neondb?sslmode=require&channel_binding=require";
        let normalized = sqlx_compatible_neon_url(input).unwrap();
        assert!(normalized.contains("sslmode=require"));
        assert!(!normalized.contains("channel_binding"));
    }

    #[test]
    fn neon_connection_string_rejects_connections_without_required_tls() {
        let input = "postgresql://owner:pass@example.neon.tech/neondb?sslmode=prefer";
        assert!(sqlx_compatible_neon_url(input).is_err());
    }

    #[test]
    fn retest_request_accepts_frontend_camel_case_payload() {
        let payload = json!({
            "reason": "The testing campaign needs a service-delivery review.",
            "requestedRemedy": "refund",
            "evidenceUrl": "https://support.google.com/googleplay/android-developer/"
        });
        let parsed: RetestInput = serde_json::from_value(payload).unwrap();
        assert_eq!(parsed.requested_remedy, "refund");
        assert!(parsed.evidence_url.starts_with("https://"));
    }

    #[test]
    fn package_name_validation_accepts_valid_and_rejects_invalid_names() {
        assert!(valid_package_name("com.androidtesters.sample"));
        assert!(valid_package_name("io.example.app_2"));
        assert!(!valid_package_name("com"));
        assert!(!valid_package_name("com..app"));
        assert!(!valid_package_name("com.example.bad-name"));
    }

    #[test]
    fn opt_in_url_validation_requires_google_play_closed_testing_path() {
        assert!(valid_opt_in_url("https://play.google.com/apps/testing/com.example.app"));
        assert!(!valid_opt_in_url("http://play.google.com/apps/testing/com.example.app"));
        assert!(!valid_opt_in_url("https://example.com/apps/testing/com.example.app"));
        assert!(!valid_opt_in_url("https://play.google.com/store/apps/details?id=com.example.app"));
    }

    #[test]
    fn evidence_file_detection_uses_file_signatures() {
        assert_eq!(detect_image_content(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]), Some("image/png"));
        assert_eq!(detect_image_content(&[0xff, 0xd8, 0xff, 0x00]), Some("image/jpeg"));
        assert_eq!(detect_image_content(b"RIFF0000WEBP"), Some("image/webp"));
        assert_eq!(detect_image_content(b"not-an-image"), None);
    }

    #[test]
    fn paystack_timestamped_webhook_signature_is_verified_and_time_bounded() {
        let body = br#"{"event":"charge.success","data":{"reference":"AT1234567890"}}"#;
        let secret = "whsec_test_rotation_key";
        let timestamp = Utc::now().timestamp();
        let mut mac = HmacSha512::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(timestamp.to_string().as_bytes());
        mac.update(b".");
        mac.update(body);
        let signature = hex::encode(mac.finalize().into_bytes());
        let mut headers = HeaderMap::new();
        headers.insert("paystack-signature", format!("t={timestamp},v1=whk_test:{signature}").parse().unwrap());
        assert!(verify_paystack_signature(&headers, body, &[secret.to_string()], "sk_test_legacy"));

        let stale = timestamp - 600;
        let mut stale_mac = HmacSha512::new_from_slice(secret.as_bytes()).unwrap();
        stale_mac.update(stale.to_string().as_bytes());
        stale_mac.update(b".");
        stale_mac.update(body);
        let stale_signature = hex::encode(stale_mac.finalize().into_bytes());
        let mut stale_headers = HeaderMap::new();
        stale_headers.insert("paystack-signature", format!("t={stale},v1=whk_test:{stale_signature}").parse().unwrap());
        assert!(!verify_paystack_signature(&stale_headers, body, &[secret.to_string()], "sk_test_legacy"));

        let extreme_headers = {
            let mut headers = HeaderMap::new();
            headers.insert("paystack-signature", format!("t={},v1=whk_test:{}", i64::MIN, "0".repeat(128)).parse().unwrap());
            headers
        };
        assert!(!verify_paystack_signature(&extreme_headers, body, &[secret.to_string()], "sk_test_legacy"));
    }

    #[test]
    fn paystack_legacy_signature_uses_raw_body_hmac() {
        let body = br#"{"event":"charge.success"}"#;
        let secret = "sk_test_legacy_secret";
        let mut mac = HmacSha512::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let signature = hex::encode(mac.finalize().into_bytes());
        let mut headers = HeaderMap::new();
        headers.insert("x-paystack-signature", signature.parse().unwrap());
        assert!(verify_paystack_signature(&headers, body, &[], secret));
        assert!(!verify_paystack_signature(&headers, b"different body", &[], secret));
    }
}
