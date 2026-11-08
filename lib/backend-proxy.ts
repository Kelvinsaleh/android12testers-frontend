import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { PortalUser } from "@/lib/session";

type BackendIdentity = Pick<PortalUser, "id" | "email" | "emailVerified">;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/**
 * Creates a very short-lived assertion signed only by the Vercel server.
 * The browser never receives BACKEND_PROXY_SECRET. Render accepts only these
 * assertions, not user-supplied identity headers or browser-provided roles.
 */
export function createBackendAssertion(user: BackendIdentity): string {
  const secret = process.env.BACKEND_PROXY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BACKEND_PROXY_SECRET must be configured with at least 32 characters on Vercel.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: "android-testers-vercel",
    aud: "android-testers-api",
    sub: user.id,
    email: user.email.trim().toLowerCase(),
    email_verified: user.emailVerified === true,
    iat: now,
    exp: now + 120,
    jti: randomUUID(),
  }));
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

export function getBackendUrl(path: string): URL {
  const base = process.env.BACKEND_API_URL;
  if (!base) throw new Error("BACKEND_API_URL is not configured on Vercel.");
  const url = new URL(path.replace(/^\/+/, ""), `${base.replace(/\/+$/, "")}/`);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("BACKEND_API_URL must use HTTPS in production.");
  }
  return url;
}

export async function fetchBackendAsUser(
  user: BackendIdentity,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${createBackendAssertion(user)}`);
  headers.set("Accept", "application/json");
  return fetch(getBackendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
    redirect: "manual",
  });
}
