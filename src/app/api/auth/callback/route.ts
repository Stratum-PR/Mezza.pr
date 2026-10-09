import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/actions";
import { finishSignup } from "@/lib/auth/finish-signup";
import { createClient } from "@/lib/db/server";

/**
 * Magic-link, invite and signup-confirmation landing: exchanges the code for a session cookie. A
 * confirmed signup gets its restaurant here (P2-5) and goes straight to the setup wizard.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = await safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const slug = data.user ? await finishSignup(data.user.id) : null;
      return NextResponse.redirect(new URL(slug ? `/app/${slug}/empezar` : next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/es/entrar?error=link", request.url));
}
