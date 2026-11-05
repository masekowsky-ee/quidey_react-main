# Study goals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Testers organise study by subjects → goals (exams, assignments, presentations) → parts, and Quidey plans study sessions (ordinary tasks) for all active goals together, proposes re-plans with a preview, notifies when they fall behind, and estimates how long parts take (history, pages, AI, defaults).

**Architecture:** Three pure backend modules carry the logic and are tested in isolation (`utils/studyPlanner.js`, `utils/studyStatus.js`, `utils/studyEstimate.js`, plus `utils/repeats.js`). A new Express router `study.js` (mounted under `/api/tester/study`) loads data, calls them and writes only rows with `goal_part_id`. The app gets a `study` slice, the "Lernen" pages, a create sheet, a re-plan preview sheet and small hooks into task rows, Home, calendar, focus and settings.

**Tech Stack:** Node/Express 5 + PostgreSQL (`node:test`), `@anthropic-ai/sdk` (new BE dependency), React 19 + Redux + Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-study-goals-design.md`

Repos: **BE** = `C:\Users\eesge\quidey\quidey_react-backend`, **FE** = `C:\Users\eesge\quidey\quidey_react-main`,
**LP** = `C:\Users\eesge\quidey\quidey_landing`. FE is on branch `refactor` with many unrelated uncommitted
changes: every commit adds **only the files the task touched** (`git add <paths>`, never `git add -A`).
The same rule holds in BE and LP.

## Global Constraints

- Migration `migrations/041_study_goals.sql`, header style of 040 (`\set ON_ERROR_STOP on`, `IF NOT EXISTS`), the same statements appended to `schema.sql` under `-- 041: study goals (see migrations/041_study_goals.sql)` (the tests build their DB from `schema.sql`).
- Every study route lives under `/api/tester/study/...` (already behind `authenticateToken, requireTester`, `index.js:271`). Every route checks ownership by `user_id`; another user's id → **404**.
- **The planner only writes tasks with `goal_part_id IS NOT NULL` whose goal belongs to the user.** No study route writes any other task.
- Planned sessions: `kind = 'task'`, `name` = part name, `color` = subject colour, `duration_minutes` = session minutes, `due_time` null in `days` mode.
- Defaults/limits: `study_session_minutes` 45 (15–180), `study_daily_max_minutes` 180 (15–720), estimates clamped 15–1200, leftover chunk < 15 min merged, event buffer 10 min, defaults exam 120 / assignment 180 / presentation 90 / other 120, review = 15 % of the other estimates clamped 60–240, history/pages need ≥ 3 finished parts.
- Missed: `slots` 60 min after the planned end; `days` once the day is over. Behind threshold = `sessionMinutes`.
- Push kind `study`: TTL 3 h, at most once per user per day, only 08:00–19:00 in `users.timezone`.
- AI: model from `STUDY_AI_MODEL` (default `claude-haiku-5-5`), key `ANTHROPIC_API_KEY`, timeout 8 s, ≤ 40 parts per request, **20 requests per user per day** via `express-rate-limit` keyed by user id (24 h window, in memory, resets on restart — spec §4). Sent: part names, subject name, kind, days until due — nothing else.
- Weekdays 1–7, 1 = Monday. Dates `YYYY-MM-DD`, times `HH:MM`, all in the user's timezone.
- All UI texts de + en in a new `src/i18n/studyTexts.js`, merged in `translations.js:2343` like `notesTexts`. Terms: Fach/Fächer, Ziel, Klausur/Abgabe/Referat/Sonstiges, Thema/Themen, Schritt/Schritte, Lernsitzung, Wiederholung, Lernzeiten. Sheets use `useSheet`; no accent on buttons/nav; everything usable at motion "minimal".
- BE single test: `node --test --test-concurrency=1 --test-name-pattern="<name>" scripts/test/<file>.test.mjs`; full: `npm test`. FE: `npx vitest run <file>`; full: `npm test` + `npm run lint`.

## Review Focus

1. **Exam due tomorrow, or in the past by the time the preview is applied** — a goal with no planning days must produce a shortfall equal to its remaining minutes and zero sessions, never a session on or after the due date. Test in Task 3.
2. **Several windows on one weekday and an event spanning midnight-free gaps exactly** — a session must fit fully inside one window, honouring the 10-min buffer on both sides of every event; a gap of exactly `sessionMinutes` fits. Test in Task 3.
3. **A session ticked off from the phone while the preview is open on the laptop** — apply must answer 409 with a fresh preview and change nothing. Test in Task 8.
4. **Dragging a planned session in the calendar to another day** — it gets `plan_pinned = true` and survives the next re-plan untouched. Test in Task 8.
5. **AI returns garbage or an index out of range** — invalid entries fall back per part (pages/history/default), the response always has one estimate per part. Test in Task 6.

---

## Backend

### Task 1: Migration 041

**Files:**
- Create: `BE/migrations/041_study_goals.sql`
- Modify: `BE/schema.sql` (append the 041 section)
- Test: `BE/scripts/test/api.test.mjs` (new test near the other schema tests)

**Interfaces:**
- Produces tables `subjects`, `goals`, `goal_parts`, `study_windows` and columns `tasks.goal_part_id`, `tasks.plan_pinned`, `users.study_session_minutes`, `users.study_daily_max_minutes`, `users.study_ai_auto`, `push_subscriptions.study`, plus `goals.freed_minutes integer NOT NULL DEFAULT 0` (minutes of sessions dropped because a part got ahead; reset to 0 when a plan is applied) — exactly as spec §1 (with the review fix: weekday 1–7, `push_subscriptions.study boolean NOT NULL DEFAULT true`). Also `CHECK (start_time < end_time)` on `study_windows`, checks on every enum-like text column, index `tasks_goal_part (goal_part_id) WHERE goal_part_id IS NOT NULL`, `goals_user_status (user_id, status)`, `goal_parts_goal (goal_id)`.

- [ ] **Step 1: Write the failing test** `test("study tables and columns exist", …)`: via `information_schema.columns` assert the four tables exist with their spec columns, `tasks` has `goal_part_id, plan_pinned`, `users` has the three `study_*` columns, `push_subscriptions` has `study`; insert a goal with `kind = 'quiz'` → rejects (check constraint).
- [ ] **Step 2: Run it** — `--test-name-pattern="study tables"` → FAIL.
- [ ] **Step 3: Write the migration and append it to `schema.sql`.** Header comment lists each table/column with one line of meaning, like 036.
- [ ] **Step 4: Run it + `scripts/test/migrations.test.mjs`** → PASS.
- [ ] **Step 5: Commit (BE)** `feat(db): 041 study goals (subjects, goals, parts, windows, planned sessions)`

### Task 2: Repeat projection on the backend

**Files:**
- Create: `BE/utils/repeats.js`
- Create: `BE/scripts/test/repeats.test.mjs`
- Create: `BE/scripts/test/fixtures/repeats.json` (shared fixtures)
- Test (FE parity): `FE/src/__tests__/repeatsParity.test.js` reading the same JSON through a relative path `../../../quidey_react-backend/scripts/test/fixtures/repeats.json`; skip with `test.skipIf(!existsSync(path))` when BE isn't beside FE.

**Interfaces:**
- Produces `repeatDate(start: 'YYYY-MM-DD', repeat: 'daily'|'weekly'|'monthly'|'yearly', n: number) → 'YYYY-MM-DD'` and `projectRepeats(tasks: TaskRow[], until: 'YYYY-MM-DD') → Array<TaskRow & { due }>` with the semantics of `FE/src/features/calendar/calendar.js:122-160` (honours `repeat_left`, `repeat_skip`, month-end clamping as FE does).

- [ ] **Step 1: Write fixtures** (≥ 8 cases: weekly, monthly on the 31st, yearly on 29 Feb, `repeat_left` 2, `repeat_skip` one date, daily, no repeat, `until` before start) each with `{ tasks, until, expected: [{ id, due }] }` — expected values produced by running the FE `projectRepeats` once.
- [ ] **Step 2: Write `repeats.test.mjs`** iterating the fixtures and `assert.deepEqual` on `{id, due}` pairs; FE parity test does the same against `calendar.js`.
- [ ] **Step 3: Run BE test** → FAIL (module missing).
- [ ] **Step 4: Port the two functions to `utils/repeats.js`** (CommonJS, no FE imports).
- [ ] **Step 5: Run BE test and the FE parity test** → PASS.
- [ ] **Step 6: Commit (BE)** `feat: repeat projection on the server (same dates as the app)`; **commit (FE)** `test: repeat projection parity with the server`.

### Task 3: Planner core — one goal

**Files:**
- Create: `BE/utils/studyPlanner.js`
- Create: `BE/scripts/test/studyPlanner.test.mjs`

**Interfaces:**
- Produces:
```js
plan({
  today: 'YYYY-MM-DD', nowMinutes: number,            // minutes since local midnight
  goals: [{ id, kind, due: 'YYYY-MM-DD', planMode: 'slots'|'days',
            parts: [{ id, position, role: 'part'|'review', remaining: number }] }],
  windows: [{ weekday: 1..7, start: 'HH:MM', end: 'HH:MM' }],
  sessionMinutes, dailyMaxMinutes,
  busy: [{ date, start: 'HH:MM', minutes }],          // timed events, repeats already projected
  kept: [{ goalId, partId, date, time: 'HH:MM'|null, minutes }],
}) → { sessions: [{ goalId, partId, date, time: 'HH:MM'|null, minutes }], shortfall: { [goalId]: number } }
```
  Also exported for tests/other modules: `chunk(minutes, sessionMinutes) → number[]`, `planningDays(goal, today, nowMinutes, windows) → string[]`, `freeGaps(date, windows, busy, keptOnDay) → [{ start, end }]` (minutes).

- [ ] **Step 1: Write failing tests** (one goal only):
  - `chunk(100, 45)` → `[45, 55]` (leftover 10 < 15 merged); `chunk(105, 45)` → `[45, 45, 15]`; `chunk(0, 45)` → `[]`.
  - `planningDays`: starts today; starts tomorrow when today's windows are over (`slots`) or `nowMinutes ≥ 19*60` (`days`); ends the day before `due`; `due` = tomorrow → `[today]` (if still open); `due` ≤ today → `[]`.
  - Spreading: 1 goal, 6 sessions, 6 days → one session per day; 3 sessions over 6 days → days 0, 2, 4 (even spacing `floor(k·days/n)`).
  - Daily max 90, session 45: never more than 2 sessions a day.
  - `slots`: window Mon 15:00–19:00, event 16:00–17:00 → sessions at 15:00 (fits 15:00–15:45, buffer to 15:50 ≤ 15:50) and 17:10; a gap of exactly `sessionMinutes` after buffers fits; two windows on one weekday are both used; no session crosses a window end.
  - `days`: `time` is null; only the daily max limits.
  - Kept sessions: their minutes count against the day's max and their slot is busy; they never appear in the output.
  - Part order: sessions are assigned to parts in `position` order.
  - Shortfall: remaining larger than capacity → planned what fits, `shortfall[goalId]` = the rest; due tomorrow with nothing left today → zero sessions, full shortfall (Review Focus 1).
  - Determinism: the same input twice → `deepEqual` outputs.
- [ ] **Step 2: Run** `node --test scripts/test/studyPlanner.test.mjs` → FAIL.
- [ ] **Step 3: Implement** the single-goal path of `plan` and the three helpers. Times as minutes internally; `HH:MM` only at the edges.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (BE)** `feat: study planner for one goal (days, capacity, slots, shortfall)`

### Task 4: Planner — all goals together, review blocks

**Files:**
- Modify: `BE/utils/studyPlanner.js`
- Modify: `BE/scripts/test/studyPlanner.test.mjs`

**Interfaces:**
- Consumes/produces the same `plan()` signature as Task 3 (no change for callers).

Algorithm (spec §2 steps 4–7), to be implemented in this order:
```
1. reserve review parts: on the goal's last planning day; if its chunks > 1, split over the last 2 days
2. feasibility, latest due → earliest: capacity(before D) vs Σ remaining of goals due ≤ D;
   when short, cut from the latest-due goals first → shortfall[goalId]; reduce their remaining
3. for each day ascending:
     open = goals with remaining > 0 and this day in planningDays
     pace(g) = remaining(g) / days left for g (incl. today)
     order open by (due asc, pace desc, id asc)
     round-robin: each goal in order takes one chunk if capacity (and a free gap for slots) allows;
       repeat rounds while any goal still needs ≥ its pace for today and capacity remains
4. within a goal, chunks go to parts in position order
```

- [ ] **Step 1: Write failing tests:**
  - Two exams, due day 5 and day 10, enough capacity → every session of each is before its own due; on shared days the earlier-due goal's session comes first.
  - Three goals, capacity of 3 sessions/day → a day holds one session of each goal, not three of one ("Mathe · Bio · Statistik").
  - Overlapping deadlines with too little capacity → the earlier goal gets fully planned, the later one gets the shortfall.
  - Review part of an exam: lands on the last planning day (≤ 1 chunk) or the last 2 days (> 1 chunk); never on the due day.
  - Kept sessions of goal A reduce capacity for goal B on that day.
  - Mixed modes: a `days` goal and a `slots` goal on the same day share the daily max; only the `slots` one needs a gap.
  - Determinism with several goals.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the multi-goal allocation; the single-goal tests from Task 3 must keep passing unchanged.
- [ ] **Step 4: Run the whole file** → PASS.
- [ ] **Step 5: Commit (BE)** `feat: study planner plans all goals together (earliest due first, one per goal per round, review blocks)`

### Task 5: Credit, status and push decision

**Files:**
- Create: `BE/utils/studyStatus.js`
- Create: `BE/scripts/test/studyStatus.test.mjs`

**Interfaces:**
- Produces (pure):
  - `sessionCredit({ focusMs, done, minutes }) → number` = `max(focusMs/60000, done ? minutes : 0)`.
  - `partProgress(part: { estimate, doneAt }, sessions) → { credit, remaining }` (`remaining` 0 when `doneAt`).
  - `isMissed(session: { date, time, minutes, done, focusMs }, { today, nowMinutes, planMode }) → boolean`.
  - `isReplaceable(session: { date, time, done, focusMs, pinned }, { today, nowMinutes }) → boolean` (spec §3: unpinned, not done, no focus, future).
  - `goalStatus({ goal, parts, sessions, busy }, ctx: { today, nowMinutes, sessionMinutes }) → { behindMinutes, conflictTaskIds: number[], aheadPartIds: number[] }` where `behindMinutes = Σ_parts max(0, Σ minutes of missed sessions − credit)`, reported only when ≥ `sessionMinutes`, else 0.
  - `shouldNotify({ deficit, notifiedMinutes, sentToday, nowMinutes, sessionMinutes }) → boolean`: true iff `!sentToday && 8*60 ≤ nowMinutes < 19*60 && deficit ≥ sessionMinutes && deficit ≥ notifiedMinutes + sessionMinutes`.
  - `pushText(goalsBehind: [{ name, behindMinutes }], language) → { title, body }` — de `"Statistik II liegt 1,5 h zurück – Plan anpassen?"` / `"2 Ziele liegen zurück – Plan anpassen?"`, en `"Statistik II is 1.5 h behind – adjust the plan?"` / `"2 goals are behind – adjust the plan?"`.

- [ ] **Step 1: Write failing tests:** credit (focus 30 min + ticked 45 → 45; focus 50 + not ticked → 50; neither → 0); `isMissed` slots at planned end + 59 min → false, + 60 → true; days: today → false, yesterday → true; done or with focus → never missed; behind 44 min with session 45 → 0, 45 → 45; conflict when an event overlaps a replaceable `slots` session; `aheadPartIds` when credit ≥ estimate; `shouldNotify` at 07:59 / 19:00 → false, 08:00 → true, `sentToday` → false, grown by less than one session → false; both push texts in de/en with the German decimal comma.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (BE)** `feat: study progress, missed/behind/ahead status and push rules`

### Task 6: Estimates

**Files:**
- Create: `BE/utils/studyEstimate.js`
- Create: `BE/scripts/test/studyEstimate.test.mjs`
- Modify: `BE/package.json` (`@anthropic-ai/sdk`), `BE/.env.example` (`ANTHROPIC_API_KEY=`, `STUDY_AI_MODEL=claude-haiku-5-5`)

**Interfaces:**
- Produces:
  - `pageCount(name: string) → number | null` — matches `S. 120–160`, `S.120-160`, `p. 12-30`, `pp. 12–30`, `Seiten 5 bis 40`, `pages 5 to 40`; the count is `end − start` (120–160 → 40, as the spec's "aus 40 Seiten").
  - `estimateParts({ parts: [{ name, kind }], subjectId, kind, history: { sameSubjectKind: number[], sameKind: number[], minutesPerPage: number[] }, ai: Array<number|null> | null }) → [{ minutes, source: 'history'|'pages'|'ai'|'default' }]` — the order of spec §4; medians; ≥ 3 samples; clamp 15–1200.
  - `reviewMinutes(otherEstimates: number[]) → number` — 15 %, clamped 60–240.
  - `askAi({ client, model, subjectName, kind, daysUntilDue, parts: string[], timeoutMs = 8000 }) → Promise<Array<number|null>>` — one entry per part; any error/timeout → all `null`; entries with a bad index or non-number → `null`.
  - `makeAiClient() → client | null` (null without `ANTHROPIC_API_KEY`).
- **Before writing `askAi`, invoke the `claude-api` skill** for the SDK's structured-output call; request JSON `{ estimates: [{ index, minutes }] }`. The prompt contains only the four allowed fields.

- [ ] **Step 1: Write failing tests:** every page form; no page range → null; history beats pages beats AI beats default; history needs 3 samples (2 → falls through); same-subject-kind beats same-kind; median of `[60, 90, 300]` = 90; clamp 5 → 15, 5000 → 1200; review of `[120, 120, 120]` → 60, of 20 × 120 → 240; `askAi` with a fake client that throws → all null, that sleeps 9 s → all null after ~8 s (use `timeoutMs: 50` in the test), that returns `{ estimates: [{ index: 7, minutes: 90 }, { index: 0, minutes: "x" }] }` for 2 parts → `[null, null]` (Review Focus 5).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: `npm install @anthropic-ai/sdk`, implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (BE)** `feat: study estimates (history, pages, AI, defaults)`

### Task 7: Router — subjects, goals, parts, settings

**Files:**
- Create: `BE/study.js` (Express `Router`, CommonJS, `module.exports = (deps) => router` with `{ pool, realtime }`)
- Modify: `BE/index.js` — mount after line 271: `app.use("/api/tester/study", require("./study")({ pool, realtime }));`
- Test: `BE/scripts/test/api.test.mjs` new `describe("study goals", …)`

**Interfaces:**
- Produces routes (all under `/api/tester/study`), JSON in camelCase:
  - `GET /subjects` → `[{ id, name, emoji, color, archived, nextGoal: { id, name, kind, due, progress, behindMinutes } | null }]`; `POST /subjects { name, emoji?, color? }`; `PATCH /subjects/:id { name?, emoji?, color?, archived? }`; `DELETE /subjects/:id` (cascades goals; deletes their **future** sessions first).
  - `GET /goals?subject=` → list; `GET /goals/:id` → `{ id, subjectId, kind, name, due, dueTime, planMode, status, parts: [{ id, name, position, estimateMinutes, estimateSource, role, doneAt, credit, remaining }], sessions: [{ taskId, partId, due, dueTime, minutes, done, focusMs, pinned }] }`; `POST /goals { subjectId, kind, name, due, dueTime?, planMode, parts: [{ name, estimateMinutes, estimateSource }] }` (adds the review part for `exam`); `PATCH /goals/:id`; `DELETE /goals/:id?sessions=delete|keep`.
  - `POST /goals/:id/parts`, `PATCH /parts/:id { name?, estimateMinutes?, doneAt? }` (setting `doneAt` sets `actual_minutes` = credit, deletes the part's replaceable sessions and adds their minutes to `goals.freed_minutes` — spec "ahead"), `DELETE /parts/:id`, `PUT /goals/:id/parts/order { ids: number[] }`.
  - `GET /settings` → `{ windows, sessionMinutes, dailyMaxMinutes, aiAuto, aiAvailable }`; `PUT /settings` (replaces windows).
  - Errors: `400 { code }` with `due_in_past`, `no_parts`, `invalid_window`, `invalid_input`; `404` for anything not mine.
- Consumes `partProgress` (Task 5) for `credit`/`remaining`, `reviewMinutes` (Task 6), `makeAiClient` (Task 6, only for `aiAvailable`).

- [ ] **Step 1: Write failing tests:** a non-tester gets 403 `TESTER_REQUIRED`; create subject → goal (exam with 3 parts) → `GET /goals/:id` has 4 parts (review last, role `review`); duplicate subject name in other case → 400; another user's subject/goal/part ids → 404 on every route; `due` yesterday → 400 `due_in_past`; no parts → 400 `no_parts`; window 18:00–17:00 → 400 `invalid_window`; `DELETE /goals/:id?sessions=keep` leaves its future tasks with `goal_part_id` null; `?sessions=delete` removes future ones, keeps past ones (as plain tasks); marking a part done sets `actual_minutes` and removes its replaceable sessions.
- [ ] **Step 2: Run** `--test-name-pattern="study goals"` → FAIL.
- [ ] **Step 3: Implement `study.js` + the mount.** Validation helpers reused from `index.js` where exported; otherwise small local ones in `study.js`.
- [ ] **Step 4: Run** → PASS; also the full `npm test`.
- [ ] **Step 5: Commit (BE)** `feat: study routes for subjects, goals, parts and settings (testers)`

### Task 8: Router — plan preview, apply, now, unpin; task rows know their goal

**Files:**
- Create: `BE/utils/studyLoad.js` (loads one user's planner input from the DB)
- Modify: `BE/study.js`
- Modify: `BE/index.js` — `TASK_SELECT` (adds the study fields to every task row), `app.put("/api/tasks/:id")` (~2428: pinning)
- Test: `BE/scripts/test/api.test.mjs` (`describe("study plan", …)`)

**Interfaces:**
- Produces:
  - `loadPlanInput(db, userId) → Promise<{ input: PlanInput, sessions: SessionRow[] }>` — today/nowMinutes from `users.timezone`; active goals with `remaining` per part; busy = timed events from today to the latest due (repeats via `utils/repeats.js`, `kind = 'event'`, plus timed tasks without `goal_part_id`); `kept` = sessions not `isReplaceable` and not `isMissed`.
  - `inputHash(input) → string` (sha256 hex of a stable JSON).
  - `GET /plan` → `{ inputHash, shortfall, goals: [{ goalId, name, summary: { moved, added, dropped, unchanged }, changes: [{ type: 'moved'|'new'|'dropped', partName, from?: { date, time }, to?: { date, time }, minutes }] }] }`. Matching old→new: same part, in date order.
  - `POST /replan { inputHash }` → 409 `{ code: 'plan_changed', preview }` when stale; else one transaction: delete replaceable + missed sessions (`goal_part_id IS NOT NULL` and goal of this user), insert the new ones, set `freed_minutes = 0` on all active goals; `realtime.toUser(userId, 'tasks:changed', {})`; → `{ ok: true }`.
  - `POST /parts/:id/now` → creates a pinned session (today, `slots`: time = now rounded down to 5 min; `days`: null; `sessionMinutes`) → `{ task }`.
  - `POST /sessions/:taskId/unpin` → `{ ok: true }`.
  - Every task row from `TASK_SELECT` gains `goal_part_id`, `plan_pinned`, and `study: { goalId, goalName, partName, subjectName, subjectEmoji, subjectColor } | null` (LEFT JOINs; null for ordinary tasks).
  - `PUT /api/tasks/:id`: when the row has `goal_part_id` and `due`, `due_time` or `duration_minutes` changes → `plan_pinned = true` (same UPDATE).

- [ ] **Step 1: Write failing tests:** a goal with 3 parts → `GET /plan` lists only `new` changes → `POST /replan` creates tasks with `goal_part_id`, the subject's colour and `duration_minutes` = 45; my ordinary tasks are untouched (count + updated_at); a second goal with an earlier due → its preview also moves the first goal's sessions; ticking a session after `GET /plan` then `POST /replan` with the old hash → 409, no rows changed (Review Focus 3); `PUT /api/tasks/:id` moving a session to another day → `plan_pinned` true, and after another replan it is still on that day (Review Focus 4); `POST /sessions/:id/unpin` on a normal task → 404; `parts/:id/now` returns a pinned task for today; `GET /api/tasks` rows of sessions carry `study.subjectName`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `studyLoad.js`, the routes, the `TASK_SELECT` join and the pinning.**
- [ ] **Step 4: Run** → PASS; full `npm test`.
- [ ] **Step 5: Commit (BE)** `feat: study plan preview and apply (all or nothing, 409 when stale), pinning, "Jetzt lernen"`

### Task 9: Router — status and AI estimate

**Files:**
- Modify: `BE/study.js`
- Test: `BE/scripts/test/api.test.mjs`

**Interfaces:**
- Produces:
  - `GET /status` → `{ goals: [{ goalId, name, behindMinutes, conflictTaskIds, freedMinutes }], notifiedMinutes: { [goalId]: n }, aiAvailable }`. `freedMinutes` = `goals.freed_minutes`. Before answering, parts whose credit reached their estimate (`aheadPartIds`) get their replaceable sessions deleted and the minutes added to `freed_minutes` (a GET with this side effect follows `GET /api/tasks`, which ticks off ended events).
  - `POST /goals/:id/dismiss` ("So lassen") → sets `behind_notified_minutes` = current deficit.
  - `POST /estimate { subjectId?, subjectName, kind, due, parts: string[] }` → `{ estimates: [{ minutes, source }], aiUsed: boolean, aiFailed: boolean }`. Uses history from the DB, `askAi` only when the request has `ai: true` or the user's `study_ai_auto`; ≤ 40 parts else 400; rate limit 20/day/user (`express-rate-limit`, `keyGenerator: req => String(req.user.userId)`, `windowMs: 24h`) applied to AI use only — over the cap answers estimates without AI and `aiFailed: true`.
- The test server has no `ANTHROPIC_API_KEY` → `aiAvailable: false`, estimates fall back. AI behaviour itself is covered by Task 6's unit tests.

- [ ] **Step 1: Write failing tests:** a part whose focus time reached its estimate loses its future sessions on `GET /status` and the goal shows `freedMinutes` = their minutes, reset to 0 after `POST /replan`; behind shows after a missed session (insert a past session directly via `sql`); `dismiss` hides it until it grows; estimate with 3 finished Mathe exam parts of 90/100/200 min → new Mathe exam part 100 min, source `history`; `"Kapitel 4, S. 120–160"` with 3 finished paged parts at 2 min/page → 80 min, source `pages`; nothing known → 120, `default`; 41 parts → 400; `aiAvailable` false.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (BE)** `feat: study status (behind, conflict, freed time) and estimates endpoint`

### Task 10: Push kind `study`

**Files:**
- Modify: `BE/utils/push.js` (`KINDS`, `TTL`, `TEXTS.study`, `pushStudyBehind`, call in `startPushSchedule`, export)
- Modify: `FE/docs/notifications.md` (new row for `study`)
- Test: `BE/scripts/test/api.test.mjs`

**Interfaces:**
- Consumes `loadPlanInput` (Task 8), `goalStatus`, `shouldNotify`, `pushText` (Task 5).
- Produces `pushStudyBehind(pool, now = new Date()) → Promise<number>` (users notified). Picks testers with active goals; per user one push (kind `study`, URL `/study?replan=1`) when any goal `shouldNotify`; then sets `behind_notified_minutes` = deficit and `behind_notified_on` = local today for those goals. A goal with deficit 0 gets `behind_notified_minutes = 0`. "Sent today" = any of the user's goals has `behind_notified_on` = local today.

- [ ] **Step 1: Write failing tests** (calling the exported function with a fixed `now`): 09:00 local with a missed session → 1 push logged (`[DEV] Push to user …`), second call same day → 0; 07:30 → 0; deficit grew by one session the next day → 1; `push_subscriptions.study = false` → not delivered to that device; `PUT /api/push/subscription` accepts `kinds.study`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; add the `study` row to `docs/notifications.md` (when, to whom, kind, text, where it leads).
- [ ] **Step 4: Run** → PASS; full `npm test`.
- [ ] **Step 5: Commit (BE)** `feat: push kind study (behind on a goal, once a day 08–19)`; **commit (FE)** `docs: study notification`.

## App

### Task 11: Study slice, texts, settings section, push kind

**Files:**
- Create: `FE/src/features/study/study.js` (slice + thunks + selectors), `FE/src/i18n/studyTexts.js`
- Create: `FE/src/components/study/StudySettings.jsx` (+ `Study.module.css`, shared by all study components)
- Modify: `FE/src/features/rootReducer.js` (`study`), `FE/src/i18n/translations.js` (import + merge at 2343), `FE/src/features/pwa/push.js:38` (`'study'` in `PUSH_KINDS`), `FE/src/features/native/nativePush.js:21` (channel `study: { de: 'Lernen', en: 'Studying', importance: 3 }`), `FE/src/i18n/translations.js` (`pushKind_study`, `pushKindHint_study`), `FE/src/components/Settings.jsx` (section "Lernen" in area Planen, testers only, id `study`)
- Test: `FE/src/__tests__/study.test.jsx`

**Interfaces:**
- Produces (slice `study`, state `{ subjects: [], goals: {} /* by id */, settings: null, status: null, preview: null }`):
  `fetchSubjects()`, `saveSubject(id|null, data)`, `deleteSubject(id)`, `fetchGoal(id)`, `fetchGoals(subjectId)`, `createGoal(data)`, `updateGoal(id, change)`, `deleteGoal(id, sessions)`, `updatePart(id, change)`, `addPart(goalId, data)`, `deletePart(id)`, `reorderParts(goalId, ids)`, `fetchStudySettings()`, `saveStudySettings(data)`, `fetchStudyStatus()`, `fetchPlanPreview()`, `applyPlan(inputHash)` (on 409 stores the fresh preview and rejects with `code: 'plan_changed'`), `dismissBehind(goalId)`, `estimateParts(data)`, `studyNow(partId)`, `unpinSession(taskId)`; selectors `selectSubjects`, `selectGoal(id)`, `selectStudyStatus`, `selectPlanPreview`. All under `/api/tester/study`. After `applyPlan`, `studyNow`, `unpinSession` dispatch the existing task reload.
- `StudySettings`: per weekday rows (Mo–So) with 0..n windows (add/remove, time inputs), session length (15–180), daily max (15–720), "KI-Schätzungen automatisch" (only when `aiAvailable`) with the note *"Sendet nur die Namen deiner Themen, das Fach, die Art und die Tage bis zum Termin an Anthropic."*, saved with one "Speichern".

- [ ] **Step 1: Write failing tests:** the reducer stores subjects/goals; `applyPlan` with a mocked 409 puts the fresh preview into state and rejects; Settings shows "Lernen" for a tester and not for a non-tester; adding a window and saving PUTs `{ windows: [{ weekday: 1, start: '15:00', end: '19:00' }], … }`; the AI switch is hidden when `aiAvailable` is false; the push list in Settings shows "Lernen".
- [ ] **Step 2: Run** `npx vitest run src/__tests__/study.test.jsx` → FAIL.
- [ ] **Step 3: Implement.** Copy de/en keys for everything in this task to `studyTexts.js`.
- [ ] **Step 4: Run it + the i18n completeness test** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(study): slice, texts, Settings → Lernen, push kind study`

### Task 12: Study pages

**Files:**
- Create: `FE/src/components/study/StudyPage.jsx` (route switch for the three views), `SubjectList.jsx`, `SubjectView.jsx`, `GoalView.jsx`, `GoalProgress.jsx` (bar + "6,5 von 16 h")
- Modify: `FE/src/App.jsx` (lazy `StudyPage`, routes `/study`, `/study/:subjectId`, `/study/goals/:id` in `TesterOnly` like `/collections`, line ~329), `FE/src/components/Menu.jsx:161` (tester entry "Lernen", icon `book` — add to `icons.jsx` if missing), `FE/src/features/tester/feedback.js:15` (`{ id: 'study', to: '/study', testerOnly: true, since: '2026-11-05' }` + `testerFeature_study`/`testerFeatureHint_study` in `testerTexts.js`), `FE/src/components/PageSkeletons.jsx` if routes need a skeleton (a column is fine)
- Test: `FE/src/__tests__/studyPages.test.jsx`

**Interfaces:**
- Consumes Task 11's thunks/selectors.
- Produces `<GoalProgress credit estimate />` (reused in Task 14) and `formatHours(minutes, language) → '6,5 h' | '6.5 h'` in `features/study/study.js`.

- [ ] **Step 1: Write failing tests:** `/study` lists subjects with the next goal, "in 12 Tagen" and ⚠ when `behindMinutes > 0`; "+ Fach" creates one; archived subjects sit in a collapsed group; `/study/:id` lists goals by date; `/study/goals/:id` shows parts with "Thema 3 · 1,5 / 3 h", the done checkbox calls `updatePart(id, { doneAt })`, the stepper changes the estimate in 15-min steps and shows source "manuell"; "Jetzt lernen" calls `studyNow` then `startFocus` with the returned task; delete asks "Künftige Lernsitzungen löschen / als normale Aufgaben behalten"; a non-tester on `/study` is redirected to `/`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Skeletons while loading (CLAUDE.md "Loading = skeletons").
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(study): subjects, subject and goal pages (testers)`

### Task 13: Create sheet and plan preview

**Files:**
- Create: `FE/src/components/study/GoalSheet.jsx` (3 steps), `FE/src/components/study/PlanPreview.jsx` (sheet), `FE/src/features/study/parseParts.js`
- Modify: `FE/src/components/study/StudyPage.jsx` (`?replan=1` opens `PlanPreview`; "+ Ziel"; "Neu planen" on `GoalView`)
- Test: `FE/src/__tests__/studySheets.test.jsx`

**Interfaces:**
- Produces `parseParts(text: string) → string[]` (one per non-empty trimmed line, leading `-`, `*`, `•`, `1.` removed, max 40, each ≤ 200 chars); `<PlanPreview onDone? />`; `<GoalSheet subjectId? onClose />`.
- Flow: step 1 (kind, name, subject or inline new, date, optional time, mode) → step 2 (paste parts → `estimateParts` → each row: name, stepper, source line "aus deinem Verlauf"/"aus 40 Seiten"/"KI-Schätzung"/"Standardwert"/"manuell"; ✨ button when `aiAvailable`; review row for exams, removable; on `aiFailed` the notice *"KI-Schätzung gerade nicht verfügbar"*) → `createGoal` → step 3 shows `PlanPreview`. In `slots` mode with no windows, step 3 shows *"Lege zuerst Lernzeiten fest"* with a link to `/settings#study` instead.
- `PlanPreview`: shortfall banner per goal (*"Es fehlen 3 h bis zur Klausur: mehr Lernzeiten freigeben oder Themen kürzer schätzen?"*), groups per goal with the summary line and rows *"Di 16:00 → Do 17:00"*, *"neu: Fr 15:00"*, *"entfällt"*; **Übernehmen** → `applyPlan`; on `plan_changed` it re-renders the fresh preview with a line *"Der Plan hat sich gerade geändert – hier ist der neue Vorschlag."*; **Abbrechen** closes.

- [ ] **Step 1: Write failing tests:** `parseParts` on a pasted syllabus (bullets, numbers, blank lines, 45 lines → 40); the sheet walks 3 steps and calls `createGoal` with parts + sources; ✨ calls `estimateParts` with `ai: true` and updates sources to "KI-Schätzung"; removing the review row drops it from the payload; the preview groups by goal and Übernehmen calls `applyPlan(inputHash)`; a 409 shows the changed-plan line and the new rows; `slots` + no windows shows the settings link.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `useSheet` / `FormSheet` patterns from `QuickAdd.jsx`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit (FE)** `feat(study): create-goal sheet with estimates and the plan preview`

### Task 14: Hooks into existing views

**Files:**
- Create: `FE/src/components/study/ReplanCard.jsx`, `FE/src/components/study/SessionMarker.jsx`
- Modify: `FE/src/components/task/TaskRow.jsx` (marker under the name + "Wieder dem Plan überlassen" in row actions when `plan_pinned`), `FE/src/components/home/Today.jsx` or `Home.jsx` (`ReplanCard` above today's tasks, testers only), the calendar's task chip (subject colour + `book` icon when `task.study`), `FE/src/components/focus/FocusTimer.jsx` (subject · part line when the focus task has `study`)
- Test: `FE/src/__tests__/studyHooks.test.jsx`

**Interfaces:**
- Consumes `task.study`, `task.plan_pinned` (Task 8), `fetchStudyStatus`, `dismissBehind`, `unpinSession` (Task 11), `PlanPreview` (Task 13).
- `ReplanCard`: shows when any goal has `behindMinutes`, `conflictTaskIds` or `freedMinutes`. Text: one goal *"Plan anpassen? Statistik II liegt 1,5 h zurück."*, several *"Plan anpassen? 2 Ziele liegen zurück."*, freed *"1,5 h frei geworden – Plan anpassen?"*, conflict *"Ein Termin überschneidet sich mit einer Lernsitzung – Plan anpassen?"*. Actions **Ansehen** (opens `PlanPreview`), **Später** (localStorage `studyLater` = today; hidden until tomorrow — add `studyLater` to the CLAUDE.md storage list in Task 15), **So lassen** (`dismissBehind` for each behind goal).
- `SessionMarker`: *"{emoji} {subject} · {part}"* with `data-task-color` = subject colour, 📌 when pinned.

- [ ] **Step 1: Write failing tests:** a task row with `study` shows the marker; a pinned one offers "Wieder dem Plan überlassen" and calls `unpinSession`; an ordinary task shows neither; `ReplanCard` texts for one/several/freed/conflict; Später hides it until the date changes (fake timers); So lassen calls `dismissBehind`; non-testers never see the card; the focus timer shows "Statistik II · Thema 3" for a session.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; full `npm test` + `npm run lint`.
- [ ] **Step 5: Commit (FE)** `feat(study): sessions in task rows, Home card, calendar and focus timer`

### Task 15: Privacy, product and docs

**Files:**
- Modify: `FE/PRODUCT.md` (principle 3 → spec §4 wording verbatim; "Positioning" privacy line and "Brand Commitments" privacy line to match), `FE/src/legal/owner.js` (Anthropic as processor, name and postal address taken from Anthropic's legal pages at implementation time, in the same shape as `mailProvider`), `FE/src/legal/LegalPage.jsx` (de/en privacy: new section "KI-Schätzungen" — provider, purpose, the four data fields, legal basis Art. 6 (1) a DSGVO consent (the tap / the switch), transfer to the USA with its safeguard; push section gains kind `study`), `LP/src/copy.js` (search "Dritt"/"third" and every "keine Drittanbieter"-style line; reword to "keine Werbung, kein Tracking; externe Dienste nur, wenn du sie auslöst"), `FE/CLAUDE.md` (feature entry for `/study`, push kind `study`, localStorage `studyLater`), `BE` notes in `FE/CLAUDE.md` backend section (migration 041, `study.js`, `ANTHROPIC_API_KEY`, `STUDY_AI_MODEL`)
- Test: existing legal/i18n tests (`npm test`)

- [ ] **Step 1: Write the failing test** in `FE/src/__tests__/legal.test.jsx` (or the existing legal test file): the privacy page (de and en) mentions "Anthropic" and the push kind for studying.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Edit the texts** listed above. **Stop and ask the user to review the legal wording before committing** (spec §4 "Legal review gate"); commit only after their OK.
- [ ] **Step 4: Run FE `npm test`, LP `npm run build`** → PASS / builds.
- [ ] **Step 5: Commit (FE)** `docs(legal): AI estimates and study notifications; product principle on external services`; **commit (LP)** `copy: privacy wording with optional external services`.

---

## Self-review notes

- Spec §1 → Task 1 (+ deletes in Task 7); §2 → Tasks 2–4; §3 → Tasks 5, 8, 9, 10, 13, 14; §4 → Tasks 6, 9, 13, 15; §5 → Tasks 11–14; §6 → Tasks 7–9; §7 → Tasks 7–9, 13; §8 → each task's tests; §9 → Tasks 1, 6, 10, 12, 15.
- The spec now records the rate limiter (§4), `goals.freed_minutes` (§1), the legal review gate (§4) and the five edge cases ("Edge cases the tests must pin" = Review Focus).
