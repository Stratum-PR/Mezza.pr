# Team (`src/lib/team`)

## What it does

The one way staff are added to a restaurant: invite a new person by email, or give an existing
account a membership.

## Entry points

- `invite.ts`: `addMember({ restaurantId, email, role, actorIsOwner, name? })`. Called by
  `inviteMember` in `lib/settings/actions.ts` (Equipo, after `requireSection(slug, "team")`) and
  `wizardInvite` in `app/app/[restaurant]/empezar/actions.ts` (setup wizard, owner only).

## Data

- Service-role client throughout: `auth.admin.inviteUserByEmail`, then `memberships` (insert, or
  update role and reactivate) and `profiles` (upsert name).
- RPC `auth_user_id_by_email` (SECURITY DEFINER, `service_role` only) finds an existing account by
  exact email when the invite fails because the address already has one.

## Rules

- Never changes an owner's membership; roles are `manager`, `server` or `kitchen`.
- Only the owner adds or changes a manager (`actorIsOwner`).
- Callers check the signed-in member's role first; this module trusts `actorIsOwner`.
- The invite link uses `NEXT_PUBLIC_SITE_URL`, never the request's Origin.
- The database keeps at least one active owner per restaurant whoever writes memberships.

## Tests

- Unit: [`invite.test.ts`](invite.test.ts).
- Database: `supabase/tests/13_membership_writes`, `14_keep_an_owner`, `19_user_lookup`.
- E2E: `tests/e2e/settings`, `signup` (wizard invite).
