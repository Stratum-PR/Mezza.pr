/**
 * The phone's device cookie: a random secret set on guest pages (by the proxy, or by a guest action if
 * it's missing). The server stores only its sha256, scoped to a tab, as the participant's identity,
 * so a retried first order finds the same person and the next party at the table starts fresh.
 */
export const DEVICE_COOKIE = "mz_device";
export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 365 * 86400,
};

export function newDeviceSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const isDeviceSecret = (v: string | undefined): v is string => !!v && /^[a-f0-9]{64}$/.test(v);
