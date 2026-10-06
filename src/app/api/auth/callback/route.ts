import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/actions";
import { createClient } from "@/lib/db/server";

/** Magic-link and invite landing: exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = await safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/es/entrar?error=link", request.url));
}
