# Family events, moving entries, group notifications, stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Families get events and reminders for every member, own tasks/events can be moved into a family, members are notified about others' entries / assignments / chat, and statistics count session and family work.

**Architecture:** Backend first (migration 040, family routes, a new `utils/groupNotices.js` for inbox notices + `groups` pushes, a family picker in the push schedule, stats SQL), then the app (family page, move card, inbox, settings, stats). Every new server behaviour is pinned by `api.test.mjs` before it is written; the app by Vitest.

**Tech Stack:** Node/Express 5 + PostgreSQL (`node:test`), React 19 + Redux + Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-family-events-notifications-design.md`

Repos: **BE** = `C:\Users\eesge\Quidey\quidey_react-backend`, **FE** = `C:\Users\eesge\Quidey\quidey_react-main`.
FE is on branch `refactor` with many unrelated uncommitted changes: every commit adds **only the
files the task touched** (`git add <paths>`, never `git add -A`).

## Global Constraints

- Migration file `migrations/040_family_events_groups_push.sql`, same header style as 039 (`\set ON_ERROR_STOP on`, `IF NOT EXISTS`), and the same statements appended to the end of `schema.sql` under `-- 040: … (see migrations/040_family_events_groups_push.sql)` (the tests build their DB from `schema.sql`).
- New push kind name: `groups`; `push_subscriptions.groups boolean NOT NULL DEFAULT true`; TTL 24 h.
- Family reminders: family **owner's** `timezone` and `allday_reminder_time`; to every **joined** member; push kind `plan`; late limit 1 h; once per reminder time (`push_sent_for`).
- Bundling window for `entries_added` notices: **30 minutes**, same reader + same place + same adder + still unread.
- Nobody is notified about their own action; only joined members (never `invited`) are notified.
- Moving is refused: `TASK_REPEATS` (repeat set), `TASK_SHARED` (any `task_shares` row), `TASK_DONE`, `TASK_NOT_FOUND` (not my own). Status 400 for the first three, 404 for the last.
- Stats: `together.places` top **8**, `together.done` at most **50**; old rows without `done_by` / `completed_at` don't count.
- All UI texts de + en in `src/i18n/translations.js` (exact strings given in the tasks). The accent never goes on buttons/nav (CLAUDE.md); sheets use `useSheet`.
- BE single test run: `node --test --test-concurrency=1 --test-name-pattern="<name>" scripts/test/api.test.mjs`; full: `npm test`. FE: `npx vitest run <file>`; full: `npm test`, plus `npm run lint`.

## Review Focus

1. **Double click on "move"** — the second request must answer 404 and leave exactly one family entry (the task is gone after the first). Test in Task 3.
2. **Invited, not joined members** — get no reminder, no entry notice, no chat push. Tests in Tasks 5 and 6.
3. **Same adder, two places** — Ann adding in family A then in family B gives two notices, not one merged one. Test in Task 5.
4. **Day taken away** — `PATCH { due: null }` on a family entry clears its reminders (and an event can't lose its day). Test in Task 2.
5. **Event moved across "now"** — into the past: done at once with `completed_at` = its end; back into the future: open again, `completed_at` null. Test in Task 2.

---

### Task 1: Migration 040

**Files:**
- Create: `BE/migrations/040_family_events_groups_push.sql`
- Modify: `BE/schema.sql` (append the 040 section)
- Modify: `BE/scripts/test/api.test.mjs:741-743` (replace the test "family calendars don't take a kind")

**Interfaces:**
- Produces columns: `family_tasks.kind text NOT NULL DEFAULT 'task'` (check `kind IN ('task','event')`, check `kind <> 'event' OR due IS NOT NULL`), `family_tasks.reminders integer[] NOT NULL DEFAULT '{}'` (copy the CHECK that `tasks.reminders` has in `schema.sql`), `family_tasks.push_sent_for timestamptz`, `family_tasks.done_by integer REFERENCES users(id) ON DELETE SET NULL`, `family_tasks.completed_at timestamptz`, the same `done_by` / `completed_at` on `shared_session_tasks`, `push_subscriptions.groups boolean NOT NULL DEFAULT true`; indexes `family_tasks_open_events (due) WHERE kind = 'event' AND NOT done`, `family_tasks_done_by (done_by, completed_at)`, `shared_session_tasks_done_by (done_by, completed_at)`.

- [ ] **Step 1: Replace the old test** with `test("family entries have a kind, reminders and who ticked them off", …)` asserting via `information_schema.columns` that `family_tasks` has `kind, reminders, push_sent_for, done_by, completed_at`, `shared_session_tasks` has `done_by, completed_at`, `push_subscriptions` has `groups`.
- [ ] **Step 2: Run it** — `--test-name-pattern="family entries have a kind"` → FAIL (columns missing).
- [ ] **Step 3: Write the migration and append it to `schema.sql`.** Header comment explains each column like 039 does.
- [ ] **Step 4: Run it + `scripts/test/migrations.test.mjs`** → PASS.
- [ ] **Step 5: Commit (BE)** `feat(db): 040 family events, reminders, done_by, push kind groups`

### Task 2: Family events, reminders, done_by / completed_at

**Files:**
- Modify: `BE/index.js` — `SHARED_TASK_FIELDS` area (~449), `syncSessionEvents` (~940) + `closePastEvents`, family `loadFamily` query (~4798), family `POST`/`PATCH` tasks (~5112–5183), session `PATCH` tasks (~4366–4440)
- Test: `BE/scripts/test/api.test.mjs` new `describe("events and reminders in a family", …)` after the families describe (~1362)

**Interfaces:**
- Produces `FAMILY_TASK_FIELDS = { ...SHARED_TASK_FIELDS, kind: TASK_EXTRAS.kind, reminders: TASK_EXTRAS.reminders }`.
- Produces `async function syncFamilyEvents(where, params = [], notify = true)` → `Promise<number[]>` (family ids changed); sets `done` and `completed_at = CASE WHEN over THEN <end> END`; time zone of `families.owner_id`; `notifyFamily` per changed family when `notify`.
- Family entry JSON (from `loadFamily`) gains `kind`, `reminders`, `completedAt`.

- [ ] **Step 1: Write the failing tests:**
  - `"an event needs a day; entries stay tasks by default"`: POST `{ name, kind: "event" }` → 400 `field: "due"`; POST `{ name }` → entry `kind === "task"`.
  - `"an event is done once it is over, never by hand; moving it opens it again"`: event yesterday → `done: true` and `completedAt` set right after POST; PATCH `{ done: false }` alone → 400 `EVENT_NOT_DONE_BY_HAND`; PATCH `{ due: daysFromToday(2) }` → `done: false`, `completedAt: null` (Review Focus 5).
  - `"the server ticks off family events that end while nobody looks"`: an event tomorrow, then `sql("UPDATE family_tasks SET due = current_date - 1, done = false WHERE id = $1")`; poll the DB up to 2 s (EVENT_CHECK_MS is 200) → `done = true`, `completed_at` not null.
  - `"reminders are kept only with a day"`: POST with `due`, `reminders: [60, 0]` → `[0, 60]`; PATCH `{ due: null }` → `reminders: []` (Review Focus 4); POST `{ name, reminders: [0] }` without due → stored `[]`.
  - `"ticking off records who and when, in families and sessions"`: PATCH `{ done: true }` → DB `done_by = me`, `completed_at` not null; `{ done: false }` → both null. Same on a session task.
- [ ] **Step 2: Run** `--test-name-pattern="in a family|records who"` → FAIL.
- [ ] **Step 3: Implement.** Family POST/PATCH read `FAMILY_TASK_FIELDS`; an event needs `due` (POST and PATCH, like the session routes at 4337/4404); `done` on an event alone → 400 `EVENT_NOT_DONE_BY_HAND`, else ignored for events; no `due` after the change → `reminders = '{}'`; `due` / `due_time` changed → `push_sent_for = NULL`. Both PATCH routes add `done_by = CASE WHEN $done THEN $me ELSE NULL END, completed_at = CASE WHEN $done THEN COALESCE(completed_at, now()) ELSE NULL END` only when `done` is sent for a task. After a family save of an event (or a kind change) call `syncFamilyEvents("family_tasks.id = $1", [id], false)`; `loadFamily` first runs `syncFamilyEvents("family_tasks.family_id = $1", [familyId], false)`; `closePastEvents` adds `syncFamilyEvents("NOT family_tasks.done AND family_tasks.due <= current_date + 1")`. `syncSessionEvents` also sets `completed_at` the same way.
- [ ] **Step 4: Run** the new tests + the existing `describe("events in a shared session")` → PASS.
- [ ] **Step 5: Commit (BE)** `feat: events and reminders in families; done_by/completed_at`

### Task 3: Move an own task / event into a family

**Files:**
- Modify: `BE/index.js` family `POST ${familyBase}/:id/tasks` (~5112)
- Test: `BE/scripts/test/api.test.mjs` in the Task 2 describe

**Interfaces:**
- `POST /api/families/:id/tasks { taskId, group_id?, assignee_id? }` → 201 with the family (same body as today's POST); emits `tasks:changed` to me (use the existing helper that the task routes use for my own changes) and `notifyFamily`.
- Consumes `FAMILY_TASK_FIELDS` (Task 2).

- [ ] **Step 1: Write the failing tests:**
  - `"one of my own tasks moves into the family with its details and reminders"`: own task with description, due, due_time, prio, duration, location, link, details, colour, reminders `[0, 60]` → family entry with all of them, `addedBy.id === me`; `GET /api/tasks` no longer has it.
  - `"an own event moves as an event, with its type's colour"`: event with a type of colour `teal`, no own colour → entry `kind: "event"`, `color: "teal"`.
  - `"moving is refused for repeating, shared, done and other people's tasks"`: codes `TASK_REPEATS`, `TASK_SHARED`, `TASK_DONE` (400), another member's task → 404 `TASK_NOT_FOUND`; the task still exists after each.
  - `"moving twice moves once"` (Review Focus 1): two POSTs with the same `taskId` via `Promise.all` → statuses sorted `[201, 404]`, exactly one family entry with that name.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in one transaction (`pool.connect`, `BEGIN`): `SELECT … FROM tasks LEFT JOIN event_types … WHERE tasks.id = $1 AND tasks.user_id = $2 FOR UPDATE OF tasks` (same column list as the session route at 4318–4326 plus `reminders`, `repeat`, `done`, `EXISTS (SELECT 1 FROM task_shares WHERE task_id = tasks.id) AS shared`); checks in the order done / repeat / shared; `INSERT INTO family_tasks`; `DELETE FROM tasks WHERE id = $1`; `COMMIT`. The `{ name, … }` path stays as it is.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (BE)** `feat: move own tasks and events into a family`

### Task 4: Push kind `groups` and its texts

**Files:**
- Modify: `BE/utils/push.js` (`KINDS`, `TTL`, `TEXTS`, file header comment)
- Test: `BE/scripts/test/api.test.mjs` in the existing push describe (~1923, `pushesFor`)

**Interfaces (all `(args, language) => { title, body, url, tag, renotify? }`):**
- `TEXTS.entriesAdded({ from, place: { kind: 'family'|'session', id, name }, count, name })` — de count 1: title `„{place}“`, body `{who} hat „{name}“ eingetragen.`; count > 1: body `{who} hat {count} Einträge eingetragen.`; en: `{who} added “{name}”.` / `{who} added {count} entries.`; url `/family/<id>` or `/together/<id>`; tag `entries-<kind>-<id>`; `renotify: true`.
- `TEXTS.familyAssigned({ from, name, family, familyId })` — like `taskAssigned` with “in „{family}“”, url `/family/<id>`, tag `assigned-family-<id>`.
- `TEXTS.chat({ from, place, body })` — title `{who} · {place.name}`, body clipped to 180, url as above, tag `chat-<kind>-<id>`, `renotify: true`.
- `TEXTS.familyEntry(entry, language)` — `TEXTS.entry` with `{ ...entry }` but body prefixed `„{familyName}“ · `, url `/family/<family_id>`, tag `family-task-<id>`.

- [ ] **Step 1: Failing test** `"devices switch the new kind groups on and off"`: `PUT /api/push/subscription` without kinds → answer `kinds.groups === true`; with `{ kinds: { groups: false } }` → `false`; unknown kind still 400.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (`KINDS` gets `"groups"`, `TTL.groups = 24 * 60 * 60`; the route already maps `PUSH_KINDS`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (BE)** `feat(push): kind groups and texts for group notices`

### Task 5: Notices and pushes about others' entries, assignments and chat

**Files:**
- Create: `BE/utils/groupNotices.js`
- Modify: `BE/index.js` — move `toNotice` into the new file and import it; call sites: family POST (new + moved, Task 3), session `POST /api/shared-sessions/:id/tasks` (~4308), family POST/PATCH assignee, family messages POST (~5230), session messages POST (~4605)
- Test: `BE/scripts/test/api.test.mjs` new `describe("notices about my families and sessions", …)` (the socket helpers `next` / `silent` of the real-time describe ~803 are local to it: lift them to the file's top level; give the new describe its own `pushesFor(user, kind, text)` like the one at ~1923, and a `groups` device per reader via `PUT /api/push/subscription`)

**Interfaces:**
- `toNotice(row)` (moved, unchanged).
- `noticeEntryAdded(pool, { place: 'family'|'session', placeId, byId, entryId, name })` → `Promise<void>`, never throws. Readers = joined members minus `byId`. Per reader: `UPDATE notifications SET title = left($name,120), data = jsonb_set(data, '{count}', ((data->>'count')::int + 1)::text::jsonb), created_at = now() WHERE user_id = $reader AND kind = 'entries_added' AND read_at IS NULL AND data->>'place' = $place AND (data->>'placeId')::int = $placeId AND (data#>>'{by,id}')::int = $byId AND created_at > now() - interval '30 minutes' RETURNING …`, else `INSERT` (`kind 'entries_added'`, `title` = entry name, `body` = place name, `data = { place, placeId, entryId, count: 1, by: { id, username, displayName } }`). Then `realtime.toUser(reader, "notification:new", toNotice(row))` and `pushToUsers(pool, [reader], "groups", lang => TEXTS.entriesAdded({ from: by, place, count: row.data.count, name }, lang))`.
- `noticeFamilyAssigned(pool, { familyId, entryId, name, byId, assigneeId })` — as `noticeTaskAssigned` (index.js ~3732), `data = { familyId, taskId, by }`, push `social` with `familyAssigned`. Called when `assignee_id` is set, differs from before and from `byId`.
- `pushChat(pool, { place, placeId, byId, text })` — push `groups` with `TEXTS.chat` to joined members minus `byId`; no notice.

- [ ] **Step 1: Failing tests:**
  - `"an entry by somebody else lands in the other members' inboxes, not mine"`: Ann + Ben joined, Cleo invited only; Ann adds → Ben gets `notification:new` kind `entries_added`, `data.count 1`, Ann and Cleo `silent` (Review Focus 2); `pushesFor(ben, "groups", "eingetragen") === 1`.
  - `"several entries within half an hour are one notice"`: Ann adds 3 more → Ben still one unread `entries_added` row for that family with `count 4`; after Ben reads (`POST /api/notifications/read`) the next one is a new row.
  - `"the same person in two places makes two notices"` (Review Focus 3).
  - `"a session entry by somebody else is announced too"` (new and `{ taskId }` copy).
  - `"a family entry given to me lands in my inbox"`: kind `task_assigned`, `data.familyId`; not when I assign myself.
  - `"family and session chat reach the others as a push"`: `pushesFor(ben, "groups", <text>) === 1`, Ann 0, invited Cleo 0.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `groupNotices.js` (requires `../realtime`, `./push`), wire the call sites after the response is sent (fire and forget, like `pushInvite`).
- [ ] **Step 4: Run** this describe + `describe("real time (Socket.IO)")` → PASS.
- [ ] **Step 5: Commit (BE)** `feat: notices and pushes about others' entries, family assignments and chat`

### Task 6: Family reminders to every member

**Files:**
- Modify: `BE/utils/push.js` (`PICK_DUE_FAMILY_ENTRIES`, `pushFamilyEntries`, `startPushSchedule`, export)
- Test: `BE/scripts/test/api.test.mjs` in the Task 2 describe

**Interfaces:**
- `async function pushFamilyEntries(pool)` → number picked. Statement shaped like `PICK_DUE_ENTRIES` on `family_tasks JOIN families JOIN users ON users.id = families.owner_id`; `EXISTS` a `plan` device of any joined member instead of the owner's; returns `id, family_id, name, kind, location, reminder_minutes, days_ahead, due_time` plus `families.name AS family_name`. Then one `pushToUsers(pool, joinedIds, "plan", lang => TEXTS.familyEntry(row, lang))` per row.

- [ ] **Step 1: Failing test** `"a family entry's reminder reaches every joined member once"`: owner + member with `plan` devices, an invited one with a device; entry due today, `due_time` = now + 1 min in the owner's zone, `reminders: [1]` → within 2 s owner and member each get exactly 1 push containing the entry name, invited 0 (Review Focus 2); after 1 s still 1.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**, call it in `startPushSchedule` after `pushDueEntries`.
- [ ] **Step 4: Run** + the existing reminder push tests → PASS.
- [ ] **Step 5: Commit (BE)** `feat(push): family reminders reach every member`

### Task 7: Statistics count session and family work

**Files:**
- Modify: `BE/index.js` `GET /api/stats` (~5409)
- Test: `BE/scripts/test/api.test.mjs` next to `"statistics for a period: event time per type, focus and ticked-off tasks"` (~358)

**Interfaces:**
- Response adds `together: { teamMs: number, places: [{ kind, id, name, emoji: string|null, color: string|null, done: number, events: number }], done: [{ id, name, completedAt, where: { kind, id, name } }] }`; `tasksDone` and `events` (`ms`, `count`, `days`, `eventTypes` "no type" bucket) include counted entries.
- Counted: session/family **tasks** with `done` and (`done_by = me` or `assignee_id = me`), `completed_at` in the period (my zone); session/family **events** with `done` and (`added_by = me` or `assignee_id = me`), day `due` in the period, time = `duration_minutes`. `teamMs` = `sum(shared_time_days.time_ms)` of mine in the period.

- [ ] **Step 1: Failing test** `"session and family work counts in my statistics"`: I tick a family task and a session task, a family task assigned to me is ticked by somebody else, a 90-min family event I added yesterday, one ticked by somebody else not assigned to me → `tasksDone` +3, `events.ms` +5 400 000, `together.places` both places with right `done`/`events`, `together.done` 3 rows with `where.kind`; the other person's tick not counted for me.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** as extra CTEs in the existing query (`shared_done`, `shared_events`) unioned into `events` / the task count, and a second query for `together`.
- [ ] **Step 4: Run** + existing stats tests + `limits.test.mjs` → PASS.
- [ ] **Step 5: Commit (BE)** `feat(stats): count work in sessions and families`
- [ ] **Step 6: Full BE suite** `npm test` → all pass.

### Task 8: Family page — events, kind switch, reminders

**Files:**
- Modify: `FE/src/components/family/FamilyPage.jsx` (`Upcoming` ~305–417)
- Modify: `FE/src/components/task/TaskEditDialog.jsx` (handlers path ~81), `FE/src/components/calendar/TaskEditor.jsx` (prop), `FE/src/components/task/TaskOptionsFields.jsx` (prop)
- Modify: `FE/src/features/calendar/sources.js` (family source passes `allowEvents` + `remindsAll`)
- Modify: `FE/src/i18n/translations.js`
- Test: `FE/src/__tests__/family.test.jsx`

**Interfaces:**
- `TaskEditor` / `TaskOptionsFields` new prop `remindsAll = false`: with `personal={false}` shows only the reminder toggles (no mail, no repeating) and under them the hint `remindsAllHint`; `onSave` then includes `reminders` (`[]` without a day). `TaskEditDialog handlers` accepts `allowEvents` and `remindsAll` and passes them on.
- Texts: `remindsAllHint` de `Erinnert alle Mitglieder.` / en `Reminds every member.`

- [ ] **Step 1: Failing tests** in `describe('Quidey Family')`:
  - `'an entry can be an event; events have no tick'`: switch to Event (reuse `KindFields` labels) → POST body `{ name, due, due_time, kind: 'event' }`; an event row renders without the "Mark done" button.
  - `'the editor sets reminders for everybody'`: open an entry with a day, turn on "Am Tag" → PATCH body has `reminders: [0]`; hint "Reminds every member." visible.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/family.test.jsx` → FAIL.
- [ ] **Step 3: Implement.** `Upcoming` holds `kind` state (default `'task'`), sends `kind` only when `'event'`; event rows show the clock icon instead of the check (as `task/TodayEvents.jsx`); the dialog gets `handlers={{ …, allowEvents: true, remindsAll: true }}`; same in `sources.js` for the family calendar. The day-less `FamilyList` unchanged.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(family): events and reminders for every member`

### Task 9: "Aus meinen Aufgaben" — move into the family; sessions take own events

**Files:**
- Create: `FE/src/components/family/MoveMyTasks.jsx`
- Modify: `FE/src/features/family/family.js`, `FE/src/components/family/FamilyPage.jsx` (render the card), `FE/src/components/together/ShareMyTasks.jsx`, `FE/src/i18n/translations.js`
- Test: `FE/src/__tests__/family.test.jsx`, `FE/src/__tests__/together.test.js` (or the test file that covers `ShareMyTasks`; find it with `grep -l ShareMyTasks src/__tests__`)

**Interfaces:**
- `moveToFamily(familyId, taskId, extra = {})` → `apiFetch` POST `{ taskId, ...extra }`, resolves to the family; the component then dispatches the existing tasks reload thunk (the one `useLiveLists` uses on `tasks:changed`).
- `familyErrorText` maps `TASK_REPEATS`, `TASK_SHARED`, `TASK_DONE`.
- Texts (de / en): `familyMoveTitle` `Aus meinen Aufgaben` / `From my tasks`; `familyMoveBtn` `In die Family verschieben` / `Move into the family`; `familyMoveConfirmTitle` `„{name}“ verschieben?` / `Move “{name}”?`; `familyMoveConfirm` `Es verschwindet aus deiner Liste. Gruppen, Sammlungen, Notizen dazu und die Aufteilung der Fokuszeit gehen dabei verloren.` / `It leaves your list. Its groups, collections, notes and focus time split are lost.`; `familyMoveEmpty` `Nichts zum Verschieben.` / `Nothing to move.`; `toast_movedToFamily` `In die Family verschoben` / `Moved into the family`; errors `errTaskRepeats` `Wiederholende Aufgaben bleiben bei dir.` / `Repeating tasks stay with you.`, `errTaskShared` `Geteilte Aufgaben bleiben bei dir.` / `Shared tasks stay with you.`, `errTaskDone` `Schon erledigt.` / `Already done.`.

- [ ] **Step 1: Failing tests:**
  - `'my open tasks and coming events move into the family after a confirmation'`: store has an open task, a coming event, a repeating task, a shared task, a done task → the card lists only the first two; click move → sheet with the confirmation text → confirm → POST `{ taskId }` (+ `group_id` when a sub-group is shown), tasks reloaded, toast.
  - In the ShareMyTasks test: a coming own event is listed with an "Event" tag and shares with `{ taskId }`; a past event is not listed.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Filter: `!done && !repeat && !(sharedWith?.length) && isOwner !== false && (kind !== 'event' || dateKey(due) >= today)`; confirmation as a sheet with `useSheet` and `btnYes`/`btnNo`; `ShareMyTasks` filter becomes `!task.done && (task.kind !== 'event' || <coming>)`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(family): move own tasks and events into a family; sessions take own events`

### Task 10: Inbox notices and the push switch

**Files:**
- Modify: `FE/src/features/inbox/inbox.js` (`noticeView`), `FE/src/components/Inbox.jsx:328-331` (replace a notice with the same id), `FE/src/features/pwa/push.js:37` (`PUSH_KINDS`), `FE/src/i18n/translations.js`
- Test: `FE/src/__tests__/inbox.test.jsx`, `FE/src/__tests__/push.test.jsx`

**Interfaces:**
- `noticeView(t, notice)` for `entries_added`: title `fill(t(count > 1 ? 'noticeEntriesAdded' : 'noticeEntryAdded'), { name: displayName(by), task: notice.title, count })`, body `fill(t('noticeTaskAssignedIn'), { session: notice.body })`, to `/family/<placeId>` or `/together/<placeId>`; `task_assigned` with `data.familyId` → to `/family/<familyId>`.
- `PUSH_KINDS = ['plan', 'digest', 'messages', 'social', 'groups']`.
- Texts: `noticeEntryAdded` `{name} hat „{task}“ eingetragen` / `{name} added "{task}"`; `noticeEntriesAdded` `{name} hat {count} Einträge eingetragen` / `{name} added {count} entries`; `pushKind_groups` `Familien und Sitzungen` / `Families and sessions`; `pushKindHint_groups` `Neue Einträge von anderen und Nachrichten im Chat` / `New entries by others and chat messages`.

- [ ] **Step 1: Failing tests:** `noticeView` for both new shapes (one, several, session, family assignment); Inbox: a second `notification:new` with the same id and `count 2` replaces the row's text, no duplicate; Settings push section shows "Families and sessions" and sends `kinds.groups: false` when switched off.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (`setNotices(prev => !prev ? prev : prev.some(n => n.id === notice.id) ? prev.map(n => n.id === notice.id ? notice : n) : [notice, ...prev])`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(inbox): notices about family and session entries; push kind groups`

### Task 11: Statistics — "In Sitzungen & Familien"

**Files:**
- Create: `FE/src/components/stats/TogetherStats.jsx`
- Modify: `FE/src/components/Stats.jsx` (overview, after the groups card ~160), `FE/src/components/CompletedTasks.jsx` (second section), `FE/src/components/stats/Stats.module.css`, `FE/src/i18n/translations.js`
- Test: `FE/src/__tests__/events.test.jsx` (where `/api/stats` is mocked)

**Interfaces:**
- `<TogetherStats together={stats.together} />` — nothing when `teamMs === 0 && places.length === 0`; a team-time tile and one linked row per place (`/family/<id>` / `/together/<id>`) with done / events.
- `CompletedTasks` takes `together` (prop, from the same stats request; Stats passes it) and renders `together.done` under a heading, each row with `where.name`.
- Texts: `statsTogether` `In Sitzungen & Familien` / `In sessions & families`; `statTeamTime` `Teamzeit` / `Team time`; `statTogetherDone` `{count} erledigt` / `{count} done`; `statTogetherEvents` `{count} Events` / `{count} events`.

- [ ] **Step 1: Failing tests:** with `together` in the mocked stats → section heading, team time, both places as links with their counts; empty `together` → no section; the Erledigt tab lists a family entry with its family's name.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (reuse the tile / card classes in `Stats.module.css`; durations with the helper the other tiles use).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(stats): work in sessions and families`

### Task 12: Privacy text, docs, full verification

**Files:**
- Modify: `FE/src/legal/LegalPage.jsx` (push section of the privacy policy, de + en)
- Create: `FE/docs/notifications.md` (the table "Notification overview" from the spec, as it is after this change)
- Modify: `FE/CLAUDE.md` (families: events, reminders to all, moving; push kinds incl. `groups`; `/stats` together; backend migration list 040), `BE/utils/push.js` header comment (kind `groups`)

- [ ] **Step 1:** Privacy: add that pushes of the kind "Familien und Sitzungen" and family reminders carry the names and texts that other members of my families / sessions wrote; and that `done_by` / `completed_at` of shared entries are stored for the statistics (who ticked off an entry is visible to the members).
- [ ] **Step 2:** Write `docs/notifications.md` and the CLAUDE.md lines.
- [ ] **Step 3: Verify** — FE `npm test` and `npm run lint` all green; BE `npm test` all green. Record the output.
- [ ] **Step 4: Commit** FE `docs: notifications overview, privacy and CLAUDE.md for family events and group notices`; BE `docs(push): kind groups`.
