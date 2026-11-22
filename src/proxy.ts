import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  if (!config) return NextResponse.redirect(new URL("/configuracao", request.url));
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: "lax" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && (request.nextUrl.pathname === "/kids" || request.nextUrl.pathname.startsWith("/kids/"))) {
    return NextResponse.redirect(new URL("/login?app=kids", request.url), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/conta/:path*", "/kids", "/kids/((?!manifest\\.webmanifest).*)", "/onboarding/:path*", "/login", "/register", "/forgot-password", "/reset-password", "/auth/:path*"],
};
