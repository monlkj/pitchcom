# Account transfer

Home has an Account Transfer button accessible to every logged-in role, including unaffiliated and pending users. `/account-transfer` changes login identity while retaining the source application profile ID. It does not copy or rewrite team data. Name, role, approval/request token, owned team codes, captain IDs, message authorship, condition/date keys, attendance and other original-ID references remain unchanged.

## Verification and scope

The API verifies both identities. Temporary sources require the existing password (PBKDF2 or legacy plaintext comparison). Google sources require their current Supabase Auth token, checked with `getUser(token)`. A temporary destination may be an existing temporary account with its correct password or a new ID/password of at least four characters. Google destinations use a separate PKCE client and popup; Google passwords are never entered into the app. Source and destination Google tokens are checked independently. The target popup uses `pitchcom-transfer-google`, so it does not replace the original login before committing. The callback is `/account-transfer/google`; the already configured Supabase site wildcard redirect allows it. With a narrower redirect allowlist, explicitly add this callback URL.

An existing destination's team, role, approval/request token, player participation and profile ID are parked in a credential-free archive with `transferredTo`. Shared records in both teams remain untouched; only the source profile is active after transfer. The preview explains when populated destination information is being parked. This is not a merger of the two profiles. Google destinations whose email belongs to an unlinked temporary account still require temporary-account proof first.

When the transferred active account is kicked, leaves its team, or its director saves a blank team code, the global users write restores the parked destination's original ID, membership, role and personal-record references. The current login identity follows that restored profile, with a new identity version; passwords and Google tokens are not copied into archives. Removal notices are retained. The access guard follows only the matching return transition (prior ID/version plus the same login email and Google identity) and reloads the home page to discard old-team UI state. An unaffiliated transferred profile also has an explicit return button. A restored team membership uses the saved approval as continuation of the parked membership; ordinary coach/player leave-and-rejoin still requires fresh director approval.

Parked directors' owned codes remain reserved, including while the active profile is a player/coach. After a return, entering a code of a parked original director reactivates that director profile without approval; arbitrary coach/player memberships cannot be resumed by this path. Nested account transfers while a return is pending are blocked until the user returns, so a backup is not silently replaced.

## Persistence

Preview does not write. Commit re-verifies credentials, requires the preview revision, and updates the users JSON with one compare-and-swap SQL UPDATE on `updated_at`. A failed write or concurrent change leaves both identities unchanged. The original source profile keeps its ID and gains an identity version. Updated sync clients preserve newer identity fields and archives and return metadata when older profile caches are saved. Automatic return uses a compare-and-swap update as well, so a conflict does not half-restore the two profiles. Existing source/unused-target sessions are rejected by the access guard after identity changes. Normal logins include the identity version. Google self-registration uses an independent application UUID so a previous Google identity cannot re-register over a retained application ID.

After commit, the browser clears its app session/cache and signs out its local Auth sessions. The user then logs in with the future account. The transfer page does not run recurring access-guard polling during its credential/commit flow; the server independently verifies both proofs on preview and commit, and the success screen can survive intentional logout. Other pages retain normal access checks.

## Existing limitations

This uses the existing shared JSON user store and its legacy anonymous policies, not a complete Supabase Auth/RLS migration. Public table access and last-write-wins writes from old deployed clients remain existing architectural limitations. Updated clients preserve identity versions; old clients must refresh. Proper authenticated profile/membership tables and server policies remain required for production authorization. There is no new secret or database migration for this feature. Passwords and Auth tokens are not logged or stored in transfer archives. Tokens are kept by the separate Supabase Auth client and cleared after completion/unmount; form passwords remain in component memory only.

## Validation

- `npx tsc --noEmit` and `git diff --check`.
- `node --experimental-strip-types tests/accountIdentity.test.mjs`: stale identity/cache protection, archive preservation and current-version profile edits.
- Local browser/API tests with fake accounts: both-password verification, preview without writes, compare-and-swap conflicts, failed persistence, original ID/team/role/history preservation, old-session rejection, new login, populated destination parking and automatic team return, new temporary destination, isolated target Google PKCE popup and Google-to-temporary/Google transfer.
- Real Google consent/project settings still require a user-operated production test; the local mock provider cannot verify those external settings.

## Self-account deletion next to transfer

The home header places Account Delete beside Account Transfer for all roles, including unaffiliated/pending users. The former local-only footer deletion was removed. `/account-delete` requires two matching entries of the actual existing password and two correctly answered arithmetic questions for temporary/legacy accounts. A separate `/api/account-self-deletion` verifies both fields and both answers before writing anything. It supports the current user's director, coach or player profile; cross-team administrator deletion rules remain separate and unchanged.

Google accounts do not have an app password. They instead verify through an isolated Google popup and type the exact deletion phrase twice, then solve the same two arithmetic questions. Another Google identity cannot delete the current profile. Google passwords are never collected. This removes the PitchCom profile and app access, not the external Google account or the Supabase Auth provider identity.

The API writes a persistent deleted-user marker, then removes the matching profile with a compare-and-swap users update that preserves unrelated accounts. It can retry cleanup after a partial failure. The form reports partial completion rather than success when cleanup fails, clears entered passwords on failure, and permits retry. Existing online sessions are rejected on their account-status check; the current browser clears its session/cache and local Auth sessions after success. Team-shared historical records are not removed by self-account deletion. Arithmetic prevents accidental clicks and is not a security CAPTCHA. The existing table-policy limitations above continue to apply.

### Legacy duplicate login identifiers

When the entered source identifier matches the current session identifier, the client sends `sourceProfileId` as an explicit selector. The API requires both that profile ID and the normalized identifier to match exactly one stored active profile, then independently verifies its password or Google identity. Selecting an ID is never authentication. Other profiles sharing the login identifier are retained unchanged; team records remain keyed to the selected original profile ID. Without an explicit selector, ambiguous identifiers remain blocked. Duplicate canonical profile IDs are also blocked rather than replacing multiple rows. Target-account uniqueness and existing-data safeguards remain in place.

### Return validation

`node --experimental-strip-types tests/transferTeamReturn.test.mjs` verifies credential-free parking, original-ID/role/membership restoration, retained current credentials, no return on unrelated edits, stale-cache protection, director-owned-code resume and explicit unaffiliated return. Local mock browser tests also exercise director blank-code exit, director kicking transferred players/coaches, old-team ownership reservation, unchanged shared history and mobile layout.
