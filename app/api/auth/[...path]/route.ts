import { getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const authHandler = getAuth().handler();

export const GET = authHandler.GET;
export const POST = authHandler.POST;