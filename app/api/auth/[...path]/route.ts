import { getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auth = getAuth();

export const { GET, POST } = auth.handler();