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

In Director Management, a director with a current team can issue player or coach accounts. Names and roles are selected before issuance, with multiple coach specialties supported. IDs and passwords are cryptographically generated. Because issuance is the director's explicit approval, the new profile joins that team as approved. Moving to another team still follows the existing approval process. New temporary accounts cannot be issued with the director role.

Only the issuing screen displays the generated password; it is not retrievable after closing it. New temporary credentials use a random salt and PBKDF2-SHA256 (210,000 iterations), never a plaintext password field. The Google secret is unrelated and never used for temporary credentials. Legacy accounts remain compatible, including their existing plaintext storage limitations. There is no automatic expiry or password recovery for the newly issued accounts in this change. As with the rest of the legacy application, server-enforced membership/RLS migration remains outstanding; password hashing does not complete it.

Temporary login fetches the authoritative cloud account list and deletion status and fails closed on network errors. It does not authenticate from stale local account cache. Issuance rechecks the current director and team, verifies Google Auth when the director is linked, and reports success only after the cloud write succeeds.

Credential regression tests (Node 24): `node --experimental-strip-types tests/temporaryAccounts.test.mjs`. The three cases cover valid/invalid passwords, independent salts and malformed credentials. Local browser tests also exercised issuance failure, player/coach creation, temporary login and the Google PKCE regression flow using fake accounts only.
