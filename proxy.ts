import { getAuth } from "@/lib/auth/server";

export default getAuth().middleware({
  loginUrl: "/sign-in",
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/submit/:path*",
    "/payment/result/:path*",
  ],
};