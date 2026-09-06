import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";

export function proxy(request: NextRequest) {
  // An opaque database cookie is only a redirect hint. Forged/stale cookies
  // still reach the page/DAL, which independently checks the database session.
  const secure = serverEnv.AUTH_URL?.startsWith("https:");
  const name = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  if (!request.cookies.get(name)?.value) {
    const login = new URL("/api/auth/signin", serverEnv.AUTH_URL ?? request.url);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/author/:path*", "/admin/:path*"] };
