/** /app, /r, /admin and /api have no locale prefix; everything else is the marketing site. */
const UNPREFIXED = /^\/(app|r|admin|api)(\/|$)/;

export function isMarketingPath(pathname: string): boolean {
  return !UNPREFIXED.test(pathname);
}
