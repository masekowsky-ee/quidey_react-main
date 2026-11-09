# Study goals: subjects, exams/assignments, auto-planned study sessions — design

Date: 2026-11-05 · Status: approved in chat (spec waiting for review)

Sub-project **A** of four (A: workflow structure, B: "where am I at" overview, C: motivation and
challenges tied to goals, D: social goals). B–D build on this one and get their own specs.

## Goal

Students organise their study life by **subjects** (Mathe, Bio, Statistik II). Inside a subject they
have **goals** with a date: exams, assignments, presentations. A goal is broken into **parts**
(topics for exams, steps for assignments), each with an estimate. Quidey **plans study sessions**
for all active goals together, spreads them over the days before each date, and **proposes a new
plan** when the student falls behind, gets ahead or changes something. Nothing in the calendar
moves without the student's OK.

Success: a student adds "Klausur Statistik II, 12 Feb, 8 topics" in under a minute, gets a sensible
plan into their calendar, studies sessions from Home with the focus timer, and is told (calmly) when
the plan no longer fits.

## Decisions (from the chat)

| Question | Decision |
|---|---|
| Main unit | **Subjects** as containers, **goals** (exams/deadlines) inside them |
| How much Quidey plans | Quidey **plans and keeps re-planning** |
| How a re-plan reaches the user | As a **proposal with a preview**; nothing moves until confirmed |
| How concrete a session is | **Exact time slot** by default (`slots`), per goal switchable to **day only** (`days`) |
| How much study a goal needs | Quidey **proposes an estimate per part**, the user adjusts; exams get a review block |
| When a session / part counts as done | Session: ticked **or** its focus minutes reached. "Behind" is measured **per part** (planned vs. credited minutes). A part is done when marked done; its remaining sessions are dropped |
| Kinds of goals | **One generic goal type**, shown as kinds (Klausur, Abgabe, Referat, Sonstiges) that set icon, wording and the review block |
| Architecture | **Sessions are ordinary `tasks` rows** (A) with **hard boundaries** (C): the planner only ever touches its own rows, separate modules |
| Several goals | Planned **together**, not one at a time (earliest deadline first, spread across goals) |
| Falling behind | Home card **plus a push notification** (new kind `study`), at most once a day, **08:00–19:00** local time |
| Estimates | History → pages in the name → **AI** → defaults. AI on tap (**"✨ Schätzen lassen"**) and optionally automatic (setting, off by default). The privacy principle is changed for this |

Rollout: **testers first** (`TesterOnly` / `hasTesterAccess`), like collections.

## 1. Data model

Migration `quidey_react-backend/migrations/041_study_goals.sql` (existing style: comment header,
`\set ON_ERROR_STOP on`, `IF NOT EXISTS`), also added to `schema.sql`.

### New tables

- **`subjects`**: `id serial PK, user_id → users ON DELETE CASCADE, name text (1–60), emoji text,
  color text (task colours or null), archived boolean DEFAULT false, created_at`.
  Unique index on `(user_id, lower(name))`. Archiving hides a subject and everything in it, keeps the data.
- **`goals`**: `id serial PK, user_id → users ON DELETE CASCADE, subject_id → subjects ON DELETE CASCADE,
  kind text ('exam'|'assignment'|'presentation'|'other'), name text (1–200), due date NOT NULL,
  due_time time (optional), plan_mode text ('slots'|'days') DEFAULT 'slots',
  status text ('active'|'done'|'archived') DEFAULT 'active',
  behind_notified_minutes integer DEFAULT 0, behind_notified_on date,
  freed_minutes integer NOT NULL DEFAULT 0, created_at`.
  `freed_minutes`: minutes of sessions dropped because a part got ahead (marked done, or its focus time
  reached the estimate). It feeds the "*x h frei geworden*" card so the card survives a reload, and is
  reset to 0 when a plan is applied.
- **`goal_parts`**: `id serial PK, goal_id → goals ON DELETE CASCADE, name text (1–200),
  position integer, estimate_minutes integer (15–1200), estimate_source text
  ('history'|'pages'|'ai'|'default'|'manual'), role text ('part'|'review') DEFAULT 'part',
  done_at timestamptz, actual_minutes integer`.
- **`study_windows`**: `id serial PK, user_id → users ON DELETE CASCADE, weekday smallint (1–7, 1 = Monday, as in the testers' reminders),
  start_time time, end_time time` with `start_time < end_time`. Several windows per weekday are allowed.

### New columns on existing tables

- `tasks.goal_part_id integer → goal_parts(id) ON DELETE SET NULL`: marks a task as a **planned session**.
  Partial index `WHERE goal_part_id IS NOT NULL`.
- `tasks.plan_pinned boolean NOT NULL DEFAULT false`: the user changed it; the planner keeps it.
- `push_subscriptions.study boolean NOT NULL DEFAULT true`: the per-device switch for the new push kind.
- `users.study_session_minutes integer DEFAULT 45` (15–180), `users.study_daily_max_minutes integer
  DEFAULT 180` (15–720), `users.study_ai_auto boolean DEFAULT false`.

Planned sessions are `kind = 'task'` rows with `due`, `due_time` (null in `days` mode),
`duration_minutes`, `name` = the part's name and `color` = the subject's colour.

### Credit (how progress is counted)

Per session: `credit = max(focus_ms / 60000, done ? duration_minutes : 0)`, with `focus_ms` = the sum of
`session_tasks.time_ms` for that task. A part's credit is the sum over its existing sessions. A part with `done_at` counts as finished whatever its credit;
`actual_minutes` is set to its credit at that moment.

`remaining(part) = done_at ? 0 : max(0, estimate_minutes − credit)`.

### Deleting

- **Goal:** the user picks *delete future sessions* or *keep them as ordinary tasks*. Kept sessions get
  `goal_part_id = null` (via `ON DELETE SET NULL`). Past sessions always stay as ordinary tasks.
- **A single planned session, by hand:** deleted like any task. Its focus time is lost from `session_tasks`
  (existing behaviour), so its credit is lost too. The part's remaining minutes grow and the next plan
  covers them.
- **Subject with goals:** a confirmation names how many goals go with it; future sessions are deleted.

## 2. Planner

`quidey_react-backend/utils/studyPlanner.js`: a **pure function**, no DB access, no `Date.now()`.

```
plan({ today, now, timezone, goals, windows, sessionMinutes, dailyMaxMinutes, busy, kept })
  → { sessions: [{ goalId, partId, date, time | null, minutes }], shortfall: { [goalId]: minutes } }
```

### Inputs

- `goals`: all goals with `status = 'active'`, each with its parts and their `remaining` minutes.
- `windows`, `sessionMinutes`, `dailyMaxMinutes`: the user's study settings.
- `busy`: the user's events with a time and duration in the planning range, **with repeats projected**.
  The repeat projection is ported from `src/features/calendar/calendar.js` (`repeatDate`,
  `projectRepeats`) into `utils/repeats.js`, honouring `repeat_left` and `repeat_skip`.
- `kept`: sessions the planner must not move: pinned, done, with focus time, or in the past (see §3).
  They count toward each day's capacity and their slots are busy.

### Steps

1. **Days per goal:** from today (tomorrow if today's windows are over, or in `days` mode after 19:00)
   to the day before the goal's `due`.
2. **Capacity per day:** `dailyMaxMinutes` minus kept study minutes that day. In `slots` mode also
   limited to the free time inside that weekday's windows, minus busy items with a **10-minute buffer**
   on each side.
3. **Sessions:** each part's remaining minutes are cut into chunks of `sessionMinutes`; a leftover under
   15 minutes is merged into the previous chunk.
4. **Review blocks first:** each exam's `review` part goes on its last 1–2 days before `due`.
5. **Feasibility, backwards:** for each deadline (latest to earliest), compare the remaining minutes of
   all goals due by then with the capacity before it. Where it doesn't fit, earlier-due goals keep their
   minutes; the rest becomes that goal's `shortfall`.
6. **Fill day by day:** for each day, every goal still open gets a target pace
   (`remaining / days left until its due`). The day's capacity goes to goals by urgency (earliest `due`,
   then highest pace), in whole sessions, **one session per goal per round** before any goal gets a
   second session that day.
7. **Within a goal:** the sessions it gets are filled with its parts **in `position` order**.
8. **Times (`slots` only):** each session takes the earliest free gap in that day's windows that fits.
   In `days` mode `time` is null.

The planner **never overbooks** beyond `dailyMaxMinutes` or outside windows. It is **deterministic**:
ties are broken by goal id, then part position.

## 3. Re-planning

### What a re-plan may replace

Replaceable sessions: `goal_part_id IS NOT NULL`, `NOT plan_pinned`, `NOT done`, no focus time, and in
the future (`slots`: start after now; `days`: today or later). **Missed** past sessions with no focus
time are also removed when a re-plan is applied (their minutes are already in `remaining`). Until then
they show as overdue like any task.

### Triggers

Computed in `utils/studyStatus.js`, used by `GET /api/study/status` and the push schedule.

| Trigger | Condition | Shown as |
|---|---|---|
| **Behind** | For a part: planned minutes of its sessions that are *missed* minus its credit ≥ `sessionMinutes` | Home card + push |
| **Conflict** (`slots`) | An event overlaps a replaceable session | Home card |
| **Ahead** | A part is marked done or its credit reaches its estimate | Its replaceable sessions are deleted right away; Home card "*x h frei geworden – Plan anpassen?*" |
| **Setup changed** | Goal created, parts/estimates/date/mode edited, windows/session length/daily max changed | The preview opens directly as part of saving |

**Missed:** `days` mode, a session whose day is over; `slots` mode, a session **1 hour after its
planned end**. In both, only if not done and no focus time.

### Home card

*"Plan anpassen? Statistik II liegt 1,5 h zurück."* (several goals: *"2 Ziele liegen zurück"*). Actions:
**Ansehen** (opens the preview), **Später** (hidden until tomorrow, stored on the device),
**So lassen** (sets `behind_notified_minutes` to the current deficit; hidden until it grows by
another `sessionMinutes`).

### Push notification (kind `study`)

- New kind `study` in `utils/push.js` (`KINDS`, `TTL` 3 h, `TEXTS` de/en), with its own switch per
  device like the other kinds; on for anyone with push enabled.
- `pushStudyBehind(pool)` runs in `startPushSchedule`. Sends **at most once per user per day**, only
  between **08:00 and 19:00** in the user's `timezone`.
- Only when a goal **becomes** behind or its deficit grew by ≥ `sessionMinutes` since
  `behind_notified_minutes`. Sending sets `behind_notified_minutes` and `behind_notified_on`. A deficit
  of 0 resets `behind_notified_minutes` to 0.
- Text: *"Statistik II liegt 1,5 h zurück – Plan anpassen?"* / *"2 Ziele liegen zurück – Plan anpassen?"*;
  the URL opens `/study?replan=1`, which opens the preview.
- `docs/notifications.md` gets the new kind.

### Preview and apply

- `GET /api/study/plan` → `{ changes, shortfall, inputHash }`. `changes` is grouped by goal: per session
  *moved* (old → new), *new*, *dropped*; plus a one-line summary per goal
  (*"4 Sitzungen verschoben · 1 neu"*, *"unverändert"*).
- `POST /api/study/replan { inputHash }`: the server recomputes. A different hash → `409` with the
  fresh preview. Otherwise, in **one transaction**: delete replaceable and missed sessions of all active
  goals, insert the new ones. Then a realtime update to the user's other devices (existing Socket.IO).
- **All or nothing**; there is no partial apply.
- The same preview is used when creating a goal and for **"Neu planen"** on a goal.

### Pinning

`PUT /api/tasks/:id` (existing route) sets `plan_pinned = true` when the task has a `goal_part_id`
and `due`, `due_time` or `duration_minutes` changes. This covers dragging in the calendar.
`POST /api/study/sessions/:id/unpin` gives the session back to the planner.

## 4. Estimates

`quidey_react-backend/utils/studyEstimate.js`. Order for each part without a manual estimate:

1. **History:** median `actual_minutes` of the user's finished `part`-role parts with the **same subject
   and kind** (≥ 3), otherwise the **same kind** (≥ 3). Source `history`.
2. **Pages:** the name contains a page range (`S. 120–160`, `S.120-160`, `p. 12-30`, `pp. 12–30`,
   `Seiten 5 bis 40`, `pages 5 to 40`) and the user has ≥ 3 finished parts with a page range →
   pages × median minutes per page. Source `pages`.
3. **AI:** when `users.study_ai_auto` is on, or on a tap of **"✨ Schätzen lassen"** (which can also
   re-estimate all parts). Source `ai`.
4. **Defaults:** exam 120, assignment 180, presentation 90, other 120 minutes. Source `default`.

Review part: 15 % of the goal's other estimates, at least 60 and at most 240 minutes.
Every estimate is clamped to 15–1200 minutes. Editing it with the stepper sets source `manual`.
The UI shows the source under each estimate: *"aus deinem Verlauf"*, *"aus 40 Seiten"*,
*"KI-Schätzung"*, *"Standardwert"*.

### AI call

- `POST /api/study/estimate { subjectName, kind, daysUntilDue, parts: [name] }` →
  `{ estimates: [{ index, minutes }] }`.
- The backend calls the **Claude API** with a small model, `STUDY_AI_MODEL` in `.env` (default
  `claude-haiku-5-5`), key `ANTHROPIC_API_KEY`, using structured JSON output.
- **Sent:** part names, subject name, kind, days until the date. **Never sent:** the user's name,
  email, ids, notes or any other data.
- **Limits:** 20 AI estimate requests per user per day, counted with the server's existing rate limiter
  (`express-rate-limit`, keyed by user id, 24 h window). The count lives in memory and resets when the
  server restarts; that is accepted. (`utils/limits.js` holds the free plan's limits, not daily counters.)
  Over the cap, estimates are answered without AI. At most 40 parts per request.
- **Timeout 8 s.** Any error or timeout → fall back to steps 1/2/4 and show
  *"KI-Schätzung gerade nicht verfügbar"*. Creating a goal never fails because of the AI.
- Without `ANTHROPIC_API_KEY` the button and the setting are hidden (`GET /api/study/status` reports
  `aiAvailable`).

### Privacy changes (same change)

- `PRODUCT.md`, principle 3, becomes: *"Privacy stays a promise. No ads or tracking, data hosted in
  Germany. External services only when you trigger or switch them on (AI estimates), and only with
  the data they need."* The "Brand Commitments" and "Positioning" lines are adjusted to match.
- `src/legal/owner.js`: Anthropic added to the processors.
- Datenschutzerklärung (`src/legal/`, de/en): a section on AI estimates (provider Anthropic, purpose,
  exactly which data, legal basis consent, transfer to Anthropic in the USA and its safeguards), and the push
  kind `study`.
- `quidey_landing/src/copy.js` and any other "no third parties" wording on the landing page: adjusted.
- `CLAUDE.md` of the web and backend repos: the new module and env variables.

## 5. User interface

All new text in `src/i18n/translations.js`, de and en. German terms: **Fach / Fächer**, **Ziel**,
**Klausur / Abgabe / Referat / Sonstiges**, **Thema / Themen** (exams), **Schritt / Schritte**
(others), **Lernsitzung**, **Wiederholung**, **Lernzeiten**.

### New area "Lernen" (`src/features/study/`, testers only)

- Routes in `src/App.jsx` wrapped in `TesterOnly`, plus a nav entry for testers.
- **`/study`:** subject cards (emoji, name, colour, the next goal with countdown and progress bar,
  ⚠ when behind), "+ Fach", archived subjects collapsed.
- **`/study/:subjectId`:** goals by date with kind icon, countdown, *"6,5 von 16 h"*, behind badge;
  done/archived collapsed. Edit / archive / delete subject.
- **`/study/goals/:id`:** parts with progress (*"Thema 3 · 1,5 / 3 h"*), done checkbox, estimate
  stepper with source line, drag to reorder; **"Jetzt lernen"** per part creates a pinned session for
  now (`slots`: now, `days`: today, length `sessionMinutes`) and starts the focus timer on it.
  Upcoming sessions grouped by day. **"Neu planen"**. Settings: date/time, kind, mode, archive, delete.
- `?replan=1` on `/study` opens the preview.

### Creating a goal (sheet, 3 steps)

1. Kind, name, subject (or create one inline), date (+ optional time), mode.
2. Parts, **one per line** (pasting a list works), each with its estimate and source line;
   **"✨ Schätzen lassen"** when AI is available; the review block for exams (removable).
3. **Preview** (§3) → **Übernehmen** saves the goal and applies the plan.
   If `slots` mode and no study windows exist, step 3 links to Settings → Lernen instead.

### Settings → "Lernen"

Study windows per weekday (several per day, or none), session length, daily max,
"KI-Schätzungen automatisch" (with a one-line note on what is sent), and the `study` push switch next
to the other push kinds.

### Existing views

- **Task cards** (Home, lists): planned sessions show a marker *"Statistik II · Thema 3"* in the
  subject's colour, and 📌 when pinned with **"Wieder dem Plan überlassen"** in the row actions.
- **Home:** the re-plan card above today's tasks.
- **Calendar:** sessions in the subject's colour with a small book icon.
- **Focus timer:** shows subject and part while focusing on a session.
- Motion follows the user's level; everything works at "minimal".

## 6. API (new router `quidey_react-backend/study.js`, mounted from `index.js`)

While testers only, the routes live under **`/api/tester/study/...`** behind `requireTester`
(project convention, like `/api/tester/collections`); the table below writes them without the
`/tester` part. They move to `/api/study/...` when released. Every route checks ownership of every
subject/goal/part/task by `user_id`.

| Route | Purpose |
|---|---|
| `GET /api/study/subjects` · `POST` · `PATCH /:id` · `DELETE /:id` | Subjects |
| `GET /api/study/goals?subject=` · `GET /:id` · `POST` · `PATCH /:id` · `DELETE /:id?sessions=delete\|keep` | Goals with parts and progress |
| `POST /api/study/goals/:id/parts` · `PATCH /api/study/parts/:id` · `DELETE /api/study/parts/:id` · `PUT /api/study/goals/:id/parts/order` | Parts |
| `GET /api/study/settings` · `PUT /api/study/settings` | Windows, session length, daily max, AI auto |
| `GET /api/study/status` | Behind/conflict/ahead per goal, `aiAvailable` |
| `GET /api/study/plan` · `POST /api/study/replan` | Preview and apply (§3) |
| `POST /api/study/estimate` | Estimates (§4) |
| `POST /api/study/parts/:id/now` | "Jetzt lernen" |
| `POST /api/study/sessions/:id/unpin` | Unpin |

Creating a goal is `POST /api/study/goals` followed by the preview and `POST /api/study/replan`;
the goal exists before the plan is applied, so cancelling step 3 leaves a goal without sessions and
the "Neu planen" button.

All planner writes are filtered by `goal_part_id IS NOT NULL` and the goal's `user_id`; no study route
writes to a task without a `goal_part_id`.

## 7. Errors

- Planner: never throws on lack of capacity; reports `shortfall`. Invalid input → `400` with a reason
  key (`due_in_past`, `no_parts`, `no_windows`), caught in the sheet before saving.
- Stale preview → `409` + fresh preview. Apply is one transaction.
- Editing a session during a re-plan: the edit pins it, which changes the input hash → `409`.
- AI: falls back quietly (§4).
- Push: errors are logged and skipped like the existing push jobs.

## 8. Testing

Backend (`node --test`, `quidey_react-backend/scripts/test/`):

- `studyPlanner.test.mjs`: even spreading; several goals with overlapping deadlines (earliest first,
  one session per goal per round); review blocks; daily max; slots around events and **repeating
  events**; the 10-minute buffer; kept sessions untouched; shortfall per goal; leftover < 15 min merged;
  determinism.
- `repeats.test.mjs`: the same dates as the frontend's `projectRepeats` for shared fixtures.
- `studyStatus.test.mjs`: behind threshold, missed in `slots` after 1 h and in `days` after the day,
  conflict, ahead, "So lassen", push rules (once a day, 08–19 local, only new or grown).
- `studyEstimate.test.mjs`: the order history → pages → AI → default, page parsing for all listed
  forms, review size, clamping, AI timeout/error fallback with a mocked client.
- Routes: ownership (another user's ids → 404), `409` on a stale hash, apply is atomic,
  `plan_pinned` set by `PUT /api/tasks/:id`, delete-goal `keep`/`delete`, tester gate.

Frontend (Vitest + Testing Library, `src/__tests__/`):

- The create sheet: pasting parts, estimate sources, ✨ with mocked API, preview, apply.
- Home card actions (Ansehen / Später / So lassen), `?replan=1`.
- Session marker and unpin action on task cards.
- Settings → Lernen.
- The existing i18n completeness test covers the new keys.

## 9. Rollout

- Testers first; the gate is removed later in its own change.
- Migration `041` + `schema.sql`.
- Android: `git pull web`, no native changes; push kind `study` works through the existing FCM setup.
- Backend `.env.example`: `ANTHROPIC_API_KEY`, `STUDY_AI_MODEL`.

### Legal review gate

The AI part sends data to Anthropic in the USA. The privacy wording (Datenschutzerklärung,
`owner.js`, landing page copy) is written by the implementation, then **reviewed by the owner before
it is committed**. Nothing about AI estimates ships without that review.

## Edge cases the tests must pin

The spec's sections imply these; each has a test in the task that owns the code.

1. **Exam due tomorrow, or in the past by the time the preview is applied:** a goal with no planning
   days gets zero sessions and a shortfall equal to its remaining minutes. Never a session on or after
   the due date.
2. **Several windows on one weekday, gaps that fit exactly:** a session fits fully inside one window,
   with the 10-minute buffer on both sides of every event; a gap of exactly the session length fits.
3. **A session ticked off on the phone while the preview is open on the laptop:** applying answers
   `409` with a fresh preview and changes nothing.
4. **Dragging a planned session in the calendar to another day:** it is pinned and survives the next
   re-plan untouched.
5. **The AI returns nonsense or an index out of range:** invalid entries fall back per part (pages,
   history, default); the answer always has one estimate per part.

## Out of scope (later sub-projects or v2)

- **B:** an overview across subjects on Home, a weekly review, stats per subject.
- **C:** challenges, streaks and XP tied to goals.
- **D:** shared goals, study groups, accountability partners.
- Learning goals from a syllabus file or photo; repeating goals; sharing a goal's plan with friends;
  linking ordinary tasks to a subject without being a planned session; mails for falling behind.
