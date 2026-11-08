import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createBackendAssertion, getBackendUrl } from "@/lib/backend-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteContext = { params: Promise<{ path: string[] }> };
const PUBLIC_BACKEND_PATHS = new Set(["payments/callback", "paystack/webhook"]);

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { path } = await context.params;
    const pathname = path.join("/");
    const isProviderCallback = PUBLIC_BACKEND_PATHS.has(pathname);
    const method = request.method.toUpperCase();

    if (!isProviderCallback && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      const origin = request.headers.get("origin");
      if (!origin || origin !== new URL(request.url).origin) {
        return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
      }
    }

    const headers = new Headers();
    for (const name of ["content-type", "accept", "x-paystack-signature", "paystack-signature"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!isProviderCallback) {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Sign in with your verified Google account to continue." }, { status: 401 });
      headers.set("Authorization", `Bearer ${createBackendAssertion(user)}`);
    }

    const upstreamUrl = getBackendUrl(`/api/${pathname}`);
    upstreamUrl.search = new URL(request.url).search;
    const body = ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();
    const upstream = await fetch(upstreamUrl, {
      method, headers, body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(28_000),
    });

    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (!responseHeaders.has("cache-control")) responseHeaders.set("cache-control", "private, no-store");
    if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.get("location")) {
      const location = new URL(upstream.headers.get("location")!, upstreamUrl).toString();
      return new Response(null, { status: upstream.status, headers: { Location: location, "Cache-Control": "private, no-store" } });
    }
    return new Response([204, 304].includes(upstream.status) ? null : upstream.body, {
      status: upstream.status, headers: responseHeaders,
    });
  } catch (error) {
    console.error("Android Testers API proxy failed", error);
    return NextResponse.json({ error: "The service is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
