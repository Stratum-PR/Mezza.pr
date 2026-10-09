# Auth (`src/lib/auth`)

## What it does

Staff sign-in, owner signup, password reset, and the per-request check of who is signed in and what
they may see. Every person has their own Supabase account; there is no shared device login.

## Entry points

- `staff.ts`: `requireStaff(slug)` (signed-in active member of the restaurant, cached per request),
  `requireSection(slug, section)`, `requirePlatformAdmin`, `currentUserId`, `myRestaurants`,
  `canSee`, `homeFor`, `SECTION_ROLES`, `SECTION_PATH`. Called by every page, route and action under
  `app/app/[restaurant]/`, `lib/staff`, `lib/settings`, `lib/admin`, `app/admin/layout.tsx`, and
  `components/app/app-shell.tsx` (navigation).
- `actions.ts` (server actions): `signInWithPassword`, `sendMagicLink`, `signOut`, `safeNext`. Used by
  `components/auth/login-form.tsx`, the app shell and `app/api/auth/callback/route.ts`.
- `signup.ts` (server actions): `signUp`, `requestPasswordReset`, `setNewPassword`. Used by
  `components/auth/signup-forms.tsx` on `/[locale]/registro`, `/[locale]/recuperar` and
  `/app/contrasena`.
- `finish-signup.ts`: `finishSignup(userId)`. Called by `signUp` (confirmation off), the auth callback
  route and `app/app/page.tsx` (link confirmed on another device).

## Data

- `requireStaff` reads `restaurants` (by slug) and `memberships` with the user's client.
- `signUp` writes `pending_signups` with the service-role client. `finishSignup` (service role)
  checks `email_confirmed_at`, claims the row by deleting it, then calls `create_restaurant_with_owner`
  (SECURITY DEFINER, `service_role` only; writes `restaurants`, `memberships`, `profiles`,
  `qr_designs`, `subscriptions`) and updates `profiles`. On failure it puts the pending row back.
- `requirePlatformAdmin` calls `is_platform_admin` (SECURITY DEFINER, `authenticated`).
- Signup is rate limited per IP (10 per hour) through the rate-limit connector.

## Rules

- Section access is decided by `SECTION_ROLES`; row-level security enforces the data side.
- No restaurant, slug or trial exists until the owner's email is confirmed.
- Post-login redirects only go to `/app…` or `/admin…` (`safeNext`).
- Email links use `NEXT_PUBLIC_SITE_URL`, never the request's Origin.
- Magic link and password reset answer the same whether or not the address has an account.

## Tests

- Unit: [`staff.test.ts`](staff.test.ts), [`signup.test.ts`](signup.test.ts),
  [`finish-signup.test.ts`](finish-signup.test.ts).
- Database: `supabase/tests/01_tenancy_and_roles`, `20_pending_signups`.
- E2E: `tests/e2e/auth`, `signup`, `settings` (roles).
