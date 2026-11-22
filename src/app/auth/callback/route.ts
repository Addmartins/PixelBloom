import { NextResponse } from "next/server";
import { authOrigin } from "@/features/auth/urls";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = authOrigin();
  if (!origin) return new Response("A confirmação está indisponível neste ambiente.", { status: 503 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const recovery = url.searchParams.get("flow") === "recovery";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(recovery ? "/reset-password" : "/dashboard", origin));
  }
  return NextResponse.redirect(new URL(recovery ? "/forgot-password?link=invalid" : "/login?link=invalid", origin));
}
