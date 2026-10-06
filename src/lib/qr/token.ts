import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * QR table tokens. token = base64url(HMAC-SHA256(QR_TOKEN_SECRET, `${tableId}:${version}`)).
 * Only sha256(token) is stored (dining_tables.qr_token_hash), so printed codes can be regenerated
 * at any time without storing the token. Bumping token_version invalidates the old code;
 * changing QR_TOKEN_SECRET invalidates every printed code.
 */
export function deriveQrToken(secret: string, tableId: string, version: number): string {
  if (secret.length < 32) throw new Error("QR_TOKEN_SECRET must be at least 32 characters");
  if (!Number.isInteger(version) || version < 1)
    throw new RangeError("token version must be a positive integer");
  return createHmac("sha256", secret).update(`${tableId}:${version}`).digest("base64url");
}

/** sha256(token), hex: the value stored and looked up in dining_tables.qr_token_hash. */
export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A syntactically valid token: 43 base64url characters (32 bytes). */
export function isTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Constant-time check that a token belongs to a table at a version. */
export function verifyQrToken(secret: string, tableId: string, version: number, token: string): boolean {
  if (!isTokenShape(token)) return false;
  const expected = Buffer.from(deriveQrToken(secret, tableId, version));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The URL printed in a table's QR code. */
export function tableUrl(baseUrl: string, restaurantSlug: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/r/${encodeURIComponent(restaurantSlug)}/t/${token}`;
}
