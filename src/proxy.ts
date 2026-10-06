import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/db/proxy-session";
import { isMarketingPath } from "@/i18n/paths";
import { routing } from "@/i18n/routing";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_OPTIONS,
  isDeviceSecret,
  newDeviceSecret,
} from "@/lib/guest/device-cookie";

const intl = createMiddleware(routing);
const STAFF = /^\/(app|admin)(\/|$)/;
const GUEST = /^\/r\//;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Locale handling (including the Accept-Language redirect from /) applies to marketing paths only.
  if (isMarketingPath(pathname)) return intl(request);
  // Staff areas refresh the Supabase session and require sign-in. Guest pages (/r) never use it.
  if (STAFF.test(pathname)) return updateSession(request);
  const response = NextResponse.next();
  // Guest pages give the phone its device cookie on the first visit, before any order.
  if (GUEST.test(pathname) && !isDeviceSecret(request.cookies.get(DEVICE_COOKIE)?.value))
    response.cookies.set(DEVICE_COOKIE, newDeviceSecret(), DEVICE_COOKIE_OPTIONS);
  return response;
}

export const config = {
  // Everything except Next internals and files with an extension.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
