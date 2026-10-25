# Tactics and condition tabs

Home adds `/tactics` and `/condition` after team messages. The existing defensive-position roster in `/field` remains under team/player management; tactics are separate diagrams and do not overwrite roster formations or statistics.

## Tactics

Directors and coaches can move nine defensive markers with pointer/touch input or arrow keys, draw attack batting/running routes and defensive throwing/fielder-movement routes, undo routes, reset the arrangement, save a title and explanation. Position-name input fields are not shown. Batting is orange solid, running green dashed, throwing sky-blue dash-dot, and fielder movement purple dotted; arrowheads match each type and a legend is shown to viewers. The chosen type is saved with each new route. Old untyped arrows remain yellow and are labeled as existing routes without guessing their meaning. The P marker retains its position and drag behavior, but its name caption is hidden. Name editors are hidden for every position; existing saved marker data is retained. Multiple named boards are stored in the current team's `tactics` row. Saving merges with the latest board list; deleting only removes the selected board. Players view saved diagrams without editing controls. Saves are explicit. Two editors changing the same diagram concurrently still use last-write-wins; this is not a live collaborative editor.

## Condition

Players record their own condition (1–5), fatigue (1–5), sleep hours (0–12 in half-hour increments), and an optional short team-shared note. Dates use Asia/Seoul and future dates are not accepted. Each player/date uses a separate row, `condition:YYYY-MM-DD:account-id`, so one player's write does not replace another's. Existing entries can be edited and past dates loaded. Directors and coaches see approved player accounts, daily submission counts, and entries flagged for a conversation when condition is low or fatigue high. These flags are self-reports, not medical diagnoses.

Condition is team-shared application data, not a private medical record. The current legacy Supabase shared-data table and anonymous policies predate these features. The UI restricts editing and staff overview, and save operations recheck membership and role, but those application checks do not replace server-enforced RLS. Do not claim that personal health notes are protected from other clients with database access. Dedicated authenticated tables/policies are required before collecting private medical information. There is no pain, diagnosis or medical-history questionnaire in this feature.

## Persistence and errors

New empty tactics/condition rows use `maybeSingle()` to distinguish a missing row from a real request failure. Writes use strict synchronization and recheck the account and team before saving. Failure is shown without a successful-save notification or replacing the persisted value. Views require current team approval through the shared TeamAccess guard. New tabs use no additional environment variables or dependencies.

## Validation performed

- TypeScript and whitespace checks.
- Browser checks against a local mock Supabase server with fake director, coach, player and second-team accounts.
- Tactics pointer drag, keyboard movement, arrow drawing, name/notes, save and reload.
- Coach editing controls and player read-only display.
- Independent player/date condition writes, sleep/fatigue values, reload, staff summary and empty previous date.
- Separate team UI, 320/390-pixel layouts, and a simulated failed condition write that left the saved record unchanged.

## Hall of fame

`/hall-of-fame` adds team-scoped award and milestone cards. Directors and coaches register, edit and delete; approved team members browse, search recipient/title/description and filter categories. Categories include monthly player, game MVP, first record, milestone, team contribution and other. Each card snapshots the recipient name, title, achievement date and explanation so historical awards remain readable if the roster changes. Names can be entered manually or suggested from roster/account names. Entries sort by achievement date and creation time, newest first.

The `hall-of-fame` shared-data row uses `maybeSingle()` for a new team's empty state. Mutations re-read the latest list and use the shared staff/membership check before strict persistence; editing preserves original creation metadata and unrelated records. A record removed by another editor is not silently recreated by edit. As with tactics, simultaneous shared-row writes retain the existing last-write-wins limitation. The legacy database authorization limitations above also apply; no new policy or private-data guarantee is introduced.

Validation covers empty state, required title/recipient, roster suggestions, registration and reload, coach edits, preserving another editor's additional record, search/filter, player read-only controls, second-team isolation in the UI, narrow layouts, rejected writes without success messages, deletion/refresh and home navigation.
