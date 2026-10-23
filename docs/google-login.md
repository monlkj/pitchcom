# Google login

This adds Google OAuth through Supabase Auth alongside a separate temporary-account login below the Google button. New self-registration uses Google; existing legacy accounts still sign in through the temporary/legacy login panel. It is not a complete authorization or email/password Auth migration.

## Provider setup

- Enable Google in Supabase Authentication / Sign In / Providers. Store the OAuth client ID and client secret there, never in this repository or browser configuration.
- Register the Supabase project's `/auth/v1/callback` URL as the Google web client's authorized redirect URI.
- Supabase Site URL: `https://pitchcom-three.vercel.app`.
- Allow `https://pitchcom-three.vercel.app/login?oauth=google` in Supabase Redirect URLs (or the already configured site wildcard).
- While Google's publishing status is Testing, add each participating Google email to its test users. School administrators may additionally restrict the application.
- Rotate any client secret previously shared in chat in Google Cloud, replace it in Supabase, and revoke the old secret.

The existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required. The browser uses PKCE and Supabase's session handling; no service-role key is needed by this implementation.

## Account compatibility

A new verified Google user chooses their name and role, then gets an empty team profile. No app password is generated or saved. Existing users must prove their existing PitchCom password before first linking; email matching alone never transfers existing team ownership. Multiple matching profiles block automatic linking until those accounts are resolved. Linking preserves the original app account ID, team membership, approvals, coach specialties and managed teams, and removes the linked profile's legacy password from the shared profile and current browser cache. Subsequent Google logins reuse the profile. Linked accounts cannot use the old password login. Ordinary visits to `/` or `/login` still show login rather than automatically entering the app. Logout also signs out of the local Supabase Auth session.

## Remaining security work

The existing shared JSON users table, its anonymous-access policies, and the temporary accounts' plaintext passwords predate this change. Account linking and profile permissions are still enforced by application code on that legacy table. This is not sufficient server-side authorization for a production multi-user deployment. A full migration must move membership and ownership to per-user tables with RLS based on `auth.uid()`, replace client-side global-user writes with authorized database/server operations, remove every remaining legacy password, and migrate deletion, password reset and administrator operations accordingly. Do not describe this Google-button change as completion of that migration. Email/password Supabase Auth and password reset are not part of this change.

## Verification

Run `npx tsc --noEmit`. Browser checks should use a local mock Supabase service and fake identities only: OAuth redirect construction, cancellation/error, first-time profile creation, legacy-password linking, original ID/team preservation, no password saved for Google profiles, subsequent login, invalid Auth session rejection and logout. Real provider consent and the configured production deployment require a user-operated test with a Google test account; local mocks cannot prove Google project settings are correct.

## Director-issued temporary accounts

In Director Management, a director with a current team can issue player or coach accounts by entering name, login ID (plain IDs such as `pobi01` or email addresses), password and confirmation. Multiple coach specialties remain supported. Login IDs are trimmed, case-insensitive, contain no internal whitespace and must be unique across the cloud account list. Existing email logins remain supported. For compatibility they continue to use the existing `email` profile field. Passwords must match and have 8–256 characters. New accounts start with an empty team code and `joinApproved: false`; issuance creates no join request. After login, the account holder enters a team code and awaits the usual director approval. New temporary accounts cannot be issued with the director role.

Credentials use a random salt and PBKDF2-SHA256 (210,000 iterations). Neither the password nor its confirmation is persisted in the profile, local storage or issuance result. The form clears both password fields after successful issuance. Previously issued generated-ID accounts remain compatible and are not reassigned or detached by this change. There is no automatic expiry or password recovery in this change. Server-enforced membership/RLS migration is still outstanding; password hashing does not complete it.

Temporary login fetches the authoritative cloud account list and deletion status and fails closed on network errors. It does not authenticate from stale local account cache. Issuance rechecks the current director and team, verifies Google Auth when the director is linked, and reports success only after the cloud write succeeds.

Cross-team/unaffiliated deletion supports both legacy plaintext credentials and hashed temporary credentials. It still requires the account's email/ID, password, matching team code (or `무소속`), exact deletion confirmation and two correct arithmetic answers. Manager and Google-linked accounts are excluded. Deletion creates persistent markers, removes the profile and revokes app sessions when their online check runs. A temporary account using an actual email can also be linked to Google after checking its temporary password; the legacy credential is removed on linking.

Credential regression tests (Node 24): `node --experimental-strip-types tests/temporaryAccounts.test.mjs`. The three cases cover valid/invalid passwords, independent salts and malformed credentials. Local browser tests use fake accounts only.
