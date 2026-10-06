import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, isDeviceSecret, newDeviceSecret } from "./device-cookie";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The phone's device hash, or null when it has no cookie yet (reads). */
export async function deviceHash(): Promise<string | null> {
  const secret = (await cookies()).get(DEVICE_COOKIE)?.value;
  return isDeviceSecret(secret) ? sha256(secret) : null;
}

/** The phone's device hash, setting the cookie first if the proxy didn't (Server Actions only). */
export async function ensureDeviceHash(): Promise<string> {
  const jar = await cookies();
  let secret = jar.get(DEVICE_COOKIE)?.value;
  if (!isDeviceSecret(secret)) {
    secret = newDeviceSecret();
    jar.set(DEVICE_COOKIE, secret, DEVICE_COOKIE_OPTIONS);
  }
  return sha256(secret);
}
