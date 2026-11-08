import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

let cachedAuth: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret || cookieSecret.length < 32) {
    throw new Error("Configure NEON_AUTH_BASE_URL and a 32+ character NEON_AUTH_COOKIE_SECRET.");
  }
  if (!cachedAuth) {
    cachedAuth = createNeonAuth({
      baseUrl,
      cookies: { secret: cookieSecret, sessionDataTtl: 120 },
    });
  }
  return cachedAuth;
}
