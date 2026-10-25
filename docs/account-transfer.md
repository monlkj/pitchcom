# Account transfer

Home has an Account Transfer button accessible to every logged-in role, including unaffiliated and pending users. `/account-transfer` changes login identity while retaining the source application profile ID. It does not copy or rewrite team data. Name, role, approval/request token, owned team codes, captain IDs, message authorship, condition/date keys, attendance and other original-ID references remain unchanged.

## Verification and scope

The API verifies both identities. Temporary sources require the existing password (PBKDF2 or legacy plaintext comparison). Google sources require their current Supabase Auth token, checked with `getUser(token)`. A temporary destination may be an unused existing temporary account with its correct password or a new ID/password of at least four characters. Google destinations use a separate PKCE client and popup; Google passwords are never entered into the app. Source and destination Google tokens are checked independently. The target popup uses `pitchcom-transfer-google`, so it does not replace the original login before committing. The callback is `/account-transfer/google`; the already configured Supabase site wildcard redirect allows it. With a narrower redirect allowlist, explicitly add this callback URL.

A destination with an existing team, managed-team history or references in shared records is blocked. This is not a merger of two populated profiles. No existing target history is silently overwritten. An unused target's credential-free archive keeps its original ID with `transferredTo`, while active-profile reads hide it. Duplicate source identifiers and Google destinations whose email belongs to an unlinked temporary account are blocked pending explicit resolution.

## Persistence

Preview does not write. Commit re-verifies credentials, requires the preview revision, and updates the users JSON with one compare-and-swap SQL UPDATE on `updated_at`. A failed write or concurrent change leaves both identities unchanged. The original source profile keeps its ID and gains an identity version. Updated sync clients preserve newer identity fields and archives when older profile caches are saved. Existing source/unused-target sessions are rejected by the access guard after identity changes. Normal logins include the identity version. Google self-registration uses an independent application UUID so a previous Google identity cannot re-register over a retained application ID.

After commit, the browser clears its app session/cache and signs out its local Auth sessions. The user then logs in with the future account. The transfer page does not run recurring access-guard polling during its credential/commit flow; the server independently verifies both proofs on preview and commit, and the success screen can survive intentional logout. Other pages retain normal access checks.

## Existing limitations

This uses the existing shared JSON user store and its legacy anonymous policies, not a complete Supabase Auth/RLS migration. Public table access and last-write-wins writes from old deployed clients remain existing architectural limitations. Updated clients preserve identity versions; old clients must refresh. Proper authenticated profile/membership tables and server policies remain required for production authorization. There is no new secret or database migration for this feature. Passwords and Auth tokens are not logged or stored in transfer archives. Tokens are kept by the separate Supabase Auth client and cleared after completion/unmount; form passwords remain in component memory only.

## Validation

- `npx tsc --noEmit` and `git diff --check`.
- `node --experimental-strip-types tests/accountIdentity.test.mjs`: stale identity/cache protection, archive preservation and current-version profile edits.
- Local browser/API tests with fake accounts: both-password verification, preview without writes, compare-and-swap conflicts, failed persistence, original ID/team/role/history preservation, old-session rejection, new login, occupied target protection, new temporary destination, isolated target Google PKCE popup and Google-to-temporary/Google transfer.
- Real Google consent/project settings still require a user-operated production test; the local mock provider cannot verify those external settings.

## Self-account deletion next to transfer

The home header places Account Delete beside Account Transfer for all roles, including unaffiliated/pending users. The former local-only footer deletion was removed. `/account-delete` requires two matching entries of the actual existing password and two correctly answered arithmetic questions for temporary/legacy accounts. A separate `/api/account-self-deletion` verifies both fields and both answers before writing anything. It supports the current user's director, coach or player profile; cross-team administrator deletion rules remain separate and unchanged.

Google accounts do not have an app password. They instead verify through an isolated Google popup and type the exact deletion phrase twice, then solve the same two arithmetic questions. Another Google identity cannot delete the current profile. Google passwords are never collected. This removes the PitchCom profile and app access, not the external Google account or the Supabase Auth provider identity.

The API writes a persistent deleted-user marker, then removes the matching profile with a compare-and-swap users update that preserves unrelated accounts. It can retry cleanup after a partial failure. The form reports partial completion rather than success when cleanup fails, clears entered passwords on failure, and permits retry. Existing online sessions are rejected on their account-status check; the current browser clears its session/cache and local Auth sessions after success. Team-shared historical records are not removed by self-account deletion. Arithmetic prevents accidental clicks and is not a security CAPTCHA. The existing table-policy limitations above continue to apply.
