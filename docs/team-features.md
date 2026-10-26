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

## Chat alignment and deletion scopes

Chat explicitly aligns the active account's messages on the right and others on the left. Message bubbles open a native modal dialog with account-only deletion, sender-only everyone deletion, and cancel. Even directors/coaches do not receive an everyone-delete action for another sender's chat messages. Notice and poll moderation remain unchanged.

`message-hidden:account-id` stores hidden message IDs per team/account and syncs between devices. It leaves shared message contents untouched. Everyone deletion checks the fresh sender ID, writes a separate `message-deleted:message-id` marker and cleans the shared message list. New sends/readers filter those markers so stale cached/shared lists do not restore deleted messages in updated clients. A retry can complete cleanup after a marker write succeeded but the list write failed. Writes recheck the current team/account membership and use strict persistence. The existing shared JSON table still has last-write-wins concurrency and legacy database-policy limitations; these app-level ownership checks are not a substitute for server-side RLS.

Chat refreshes every five seconds and on focus/online, skips in-flight operations, and discards reads started before a mutation. Sending uses fresh data, UUID message IDs, a 2000-character limit and IME-safe Enter handling. Failed sends retain the draft. Failure notifications are separate from background-refresh errors. Updated clients wait for a successful initial chat read before displaying cached history. Old deployed clients must be refreshed to understand hiding/deletion markers.

Browser checks with fake users covered left/right layout; received-message account-only deletion; persistence on reload and another device; sender-only everyone deletion including a director's restricted menu; recipient refresh; stale-list reappearance prevention; failed deletes; partial-cleanup retry; separate-team UI and mobile widths.

### 대표 역할과 선수 겸임

홈의 ‘내 활동 설정’에서 감독·코치는 ‘선수로도 활동’을 저장할 수 있습니다. 대표 역할(`role`)과 팀 소유권은 변경하지 않고 `playsAsPlayer`만 별도로 저장합니다. 감독은 겸임 코치 업무도 여러 개 선택할 수 있습니다. 로그인 및 다른 기기에서의 세션 갱신에도 선수 겸임 상태를 반영합니다.

겸임자는 컨디션에서 ‘팀 제출 현황’과 ‘내 컨디션’을 모두 사용할 수 있습니다. 팀/선수 관리에서는 선택한 명단의 기존 선수와 본인 계정을 명시적으로 연결하거나 새 선수로 등록합니다. 동명이인을 자동으로 연결하지 않으며, 기존 선수 ID·기록·포지션을 유지합니다. 선수 겸임을 꺼도 명단 및 과거 기록은 삭제하지 않습니다. 기존 팀 데이터와 마찬가지로 공유 JSON 저장 방식이며 서버 권한 정책의 전면 개편을 포함하지 않습니다.

### 선수 겸임자의 주장·부주장

주장·부주장 후보에는 승인된 선수뿐 아니라 `playsAsPlayer`를 켠 감독·코치도 포함됩니다. 대표 역할과 관리 권한은 변경하지 않습니다. 겸임자 역시 홈과 감독 관리에 직책을 표시하며, 같은 사람이 주장·부주장을 동시에 맡을 수 없습니다. 계정 전환은 원래 프로필 ID와 가입 요청 토큰을 유지하므로 기존 직책도 유지됩니다. 일반적인 탈퇴·재가입으로 요청 토큰이 바뀌면 이전 임명은 무효입니다. 보관된 `transferredTo` 프로필은 후보에서 제외됩니다.

감독 관리의 팀원 목록과 승인·거절 처리는 서버의 활성 계정을 기준으로 합니다. 서버에서 사라진 계정을 브라우저 캐시에서 다시 추가하지 않습니다. 화면 복귀·온라인 전환 및 주기적 갱신으로 다른 기기에서의 전환도 반영하며, 목록이 같으면 주장·부주장 선택 내용을 다시 초기화하지 않습니다. 계정 전환에서 보관한 복귀 정보와 팀 기록은 그대로 유지합니다.

검증: `node --experimental-strip-types tests/teamLeadership.test.mjs` 및 모의 브라우저에서 옛 계정 캐시 제거, 겸임자 임명·직책 유지·표시, 중복 직책 방지, 화면 복귀 시 전환 반영과 모바일 레이아웃을 확인합니다.
