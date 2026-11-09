# Family events, moving own entries into families, group notifications, stats — design

Date: 2026-11-05 · Status: approved in chat (spec waiting for review)

## Goal

1. Families get **events** (like shared sessions have): they need a day and are done once over.
2. **Own tasks and events can be moved into a family** (they leave my list). Shared sessions keep
   copying, and now take own events too.
3. **Reminders on family entries reach every member.**
4. People are **notified when somebody else adds an entry** to a family or session they are in;
   also when they are given a family entry, and on family / session chat messages.
5. **Statistics count what I do in sessions and families**, plus a block of its own.
6. **One overview of every notification** (`docs/notifications.md`, see the last section).

## Decisions (from the chat)

| Question | Decision |
|---|---|
| Channel for "somebody added an entry" | Inbox notice + push of a **new kind `groups`** ("Familien & Sitzungen"), own switch per device; bursts bundled |
| Own task/event → family | **Move**: the family gets it with all details and reminders, my task is deleted |
| Own task/event → session | Stays a **copy** (as today); own events now allowed too |
| Family reminders | To **every joined member**, once per reminder time, in the **family owner's time zone** and all-day time (variant A) |
| Gaps closed in this change | Family assignment → notice + push (`social`); family / session chat → push (`groups`) |
| Stats | Session/family work **counts in** "Erledigt" and events, **plus** a block "In Sitzungen & Familien" |

Out of scope: XP / challenges / streaks from session or family entries (unchanged), repeating
family entries, per-member time zones for family reminders, mails for family reminders, Android
alarm-clock ringing of family reminders, in-app (non-push) toasts for family reminders.

## Backend (`quidey_react-backend`)

### Migration `040_family_events_groups_push.sql`

- `family_tasks`:
  - `kind text NOT NULL DEFAULT 'task'` + check `kind IN ('task','event')` + check
    `kind <> 'event' OR due IS NOT NULL` (same as `shared_session_tasks`).
  - `reminders integer[] NOT NULL DEFAULT '{}'` (minutes before the start, 0–10080, at most 5,
    same check as `tasks.reminders`), `push_sent_for timestamptz`.
  - `done_by integer REFERENCES users ON DELETE SET NULL`, `completed_at timestamptz`.
- `shared_session_tasks`: `done_by integer REFERENCES users ON DELETE SET NULL`,
  `completed_at timestamptz`.
- `push_subscriptions.groups boolean NOT NULL DEFAULT true` (existing devices get it on).
- Indexes: `family_tasks (due) WHERE kind = 'event' AND NOT done`; `family_tasks (done_by,
  completed_at)`; `shared_session_tasks (done_by, completed_at)`.
- `schema.sql` regenerated.

Old rows have no `done_by` / `completed_at`: they don't show up in the statistics (nothing is
guessed backwards).

### Family events

- `FAMILY_TASK_FIELDS = { ...SHARED_TASK_FIELDS, kind, reminders }` on `POST` / `PATCH
  /api/families/:id/tasks[/:taskId]`. An event needs `due` (`invalidInput "due"`); `done` on an
  event alone answers 400 `EVENT_NOT_DONE_BY_HAND` (as for sessions).
- `syncFamilyEvents(where, params, notify = true)`: like `syncSessionEvents`, with the family
  owner's time zone (`EVENT_END_SQL`), sets `done` (and `completed_at` = the end) once over and
  back when moved into the future; `notifyFamily` for changed families. Runs on `GET` of the
  family, after each save of an event, and in the minute schedule (next to the session one).
- A family entry's reminders are only kept while it has a day (taking the day away clears them);
  moving it (`due` / `due_time` changed) resets `push_sent_for` so it reminds again.
- `loadFamily` returns `kind`, `reminders`, `doneBy`, `completedAt` per entry.

### Moving own entries into a family

`POST /api/families/:id/tasks { taskId }` (every joined member):

- My own task (`tasks.user_id = me`), open, not repeating (`repeat` null), not shared with anybody
  (`task_shares` empty). Else 404 `TASK_NOT_FOUND` (not mine), 400 `TASK_REPEATS`,
  `TASK_SHARED`, `TASK_DONE`.
- In one transaction: `INSERT INTO family_tasks` with name, description, due, due_time, prio,
  duration, location, link, details, colour (`COALESCE(tasks.color, event_types.color)`), kind,
  reminders; `added_by` = me; optional `group_id` (sub-group) and `assignee_id` from the body;
  then `DELETE FROM tasks`. Answers the family (201); `tasks:changed` to me, `notifyFamily`.
- What goes away with the task (the app says so before): its groups / collections, its own
  notes (`notes.task_id`), the per-task split of focus time (`session_tasks`; the sessions and
  their totals stay, so focus statistics don't change), copies in sessions lose their link
  (`source_task_id` SET NULL).

### Shared sessions: own events

`POST /api/shared-sessions/:id/tasks { taskId }` already copies `kind`; nothing changes on the
server. Only the app's `ShareMyTasks` lists events (future ones) too.

### Done by / completed at

Both `PATCH` routes (session + family) set `done_by = me, completed_at = now()` when a task turns
done and clear both when it is opened again. Events: `completed_at` = their end, `done_by` stays
null (nobody ticks them).

### Notifications

New push kind `groups` (`KINDS`, `TTL` 24 h, `PUT /api/push/subscription` takes it, `GET` answers
it; the app's settings row). New `PUSH_TEXTS`:

- `entriesAdded({ from, place, count, name, url, tag })` — "Ann hat „Essay“ in „WG“ eingetragen"
  / "Ann hat 4 Einträge in „WG“ eingetragen"; tag `entries-family-<id>` / `entries-session-<id>`
  (a newer one replaces the older on the device), `renotify: true`.
- `familyAssigned({ from, name, family, familyId })` — like `taskAssigned`, url `/family/<id>`,
  tag `assigned-family-<id>`.
- `chat({ from, place, body, url, tag })` — title "<who> · <place>", body clipped to 180, tag
  `chat-family-<id>` / `chat-session-<id>`, `renotify: true`.
- `familyEntry(entry)` — the reminder text, as `entry` with the family's name in front of the
  location, url `/family/<id>`, tag `family-task-<id>`.

`utils/groupNotices.js` (new, so `index.js` doesn't grow):

- `noticeEntryAdded(pool, { place: 'family'|'session', placeId, byId, entryId, name })`: to every
  **joined** member except `byId`. Per member: an unread notice of kind `entries_added` with the
  same `data.place`, `data.placeId`, `data.by.id` and `created_at` within 30 minutes is
  **updated** (`data.count + 1`, `title` = the latest name, `created_at = now()`), else a new one
  is inserted (`data = { place, placeId, by, count: 1, entryId }`, `body` = family/session name).
  Live: `notification:new` with the row (the app replaces a notice with the same id). Push
  `groups` with `entriesAdded` (count from the notice).
- Called after: family entry added (new or moved), session entry added (new or copied).
  Not for repeats the server creates, not for the server ticking events off.
- `noticeFamilyAssigned(pool, familyId, entryId, name, byId, assigneeId)`: like
  `noticeTaskAssigned` (kind `task_assigned`, `data.familyId` instead of `sessionId`), push
  `social`. On `POST` / `PATCH` of a family entry when `assignee_id` is set to somebody other
  than me and changed.
- Chat: after a family message (`POST …/families/:id/messages`) and a session chat message
  (`session:event` of type `chat`), push `groups` with `chat` to every joined member except the
  writer. No inbox notice.

### Family reminders

`pushFamilyEntries(pool)` in `utils/push.js`, in `startPushSchedule` after `pushDueEntries`:
the same picking statement shape as `PICK_DUE_ENTRIES` on `family_tasks` (owner's time zone and
`allday_reminder_time` via `families.owner_id`, `FOR UPDATE SKIP LOCKED`, `push_sent_for`, late
limit 1 h, open tasks or events), then `pushToUsers` (`plan`) to every joined member of that
family with app access. Only families where any member has a device with `plan`.

### Statistics

`GET /api/stats?from&to`, in my time zone:

- `tasksDone` also counts session and family tasks with `done_by = me` **or** (`assignee_id = me`
  and done), `completed_at` in the period (each entry once).
- `events` (time + count per day, chart) also counts session and family events that are over in
  the period and were added by me or are assigned to me (`duration_minutes` as their time).
  They have no event type: they go under "Ohne Typ" in the bars per type.
- New `together`:
  `{ teamMs, places: [{ kind: 'session'|'family', id, name, emoji?, color?, done, events }] }`
  — `teamMs` = my team stopwatch time in the period (`shared_time_days`); `places` = sessions and
  families with at least one of my counted entries in the period, by `done + events`, top 8.
  Sessions I left / families I'm no longer in still count (entries stay), shown by name.
- The free plan's 7-day limit applies as today.
- `together.done`: the counted tasks done in the period, newest first, at most 50:
  `[{ id, name, completedAt, where: { kind, id, name } }]`. The "Erledigt" tab's list is built in
  the app from my own tasks (`state.task.tasks`); this is its second part.

### Tests (`scripts/test/api.test.mjs`)

Family event needs a day, is ticked off by the server once over, can't be ticked by hand; moving
an own task (details + reminders arrive, task gone, refused for repeating / shared / foreign /
done); a family reminder reaches every joined member, once; entry added → notice to the others,
not to me, bundled within 30 min, push `groups`; family assignment notice; chat push not to the
writer; `push_subscriptions.groups` read / written; stats count `done_by` / assignee entries and
`together`.

## Frontend (`quidey_react-main`)

- **Family page** (`FamilyPage.jsx`): `Upcoming`'s add form gets the kind switch
  (Aufgabe / Event, `KindFields` style); events show no check (a clock icon like `TodayEvents`)
  and leave "Demnächst" once the server has ticked them off, like done tasks. The editor
  (`TaskEditDialog handlers={…}`) gets `allowEvents` and the reminder toggles (`reminders`, the
  family's owner time zone noted under them: "Erinnert alle Mitglieder"). The list (no day) stays
  tasks only.
- **"Aus meinen Aufgaben"** card on the family page (`family/MoveMyTasks.jsx`, like
  `ShareMyTasks`): my open, non-repeating, not shared tasks and future events; "In die Family
  verschieben" → a confirmation sheet (`useSheet`) saying it leaves my list (and that its groups,
  collections, notes and per-task focus split go) → `moveToFamily(familyId, taskId, { group_id })`
  in `features/family/family.js`, then reloads my tasks. Repeating / shared ones are left out of
  the list.
- **Calendar** (`features/calendar/sources.js`): the family calendar passes `kind` and
  `reminders`, `allowEvents` for family sources; events there behave like session events.
- **Sessions**: `ShareMyTasks` lists future own events too (with a small "Event" tag).
- **Inbox** (`features/inbox/inbox.js` `noticeView`): `entries_added` ("Ann hat „Essay“ in „WG“
  eingetragen" / "… 4 Einträge …", to `/family/<id>` or `/together/<id>`), `task_assigned` with
  `data.familyId` (to `/family/<id>`). `useInboxRealtime` replaces a notice with the same id
  instead of adding it twice.
- **Settings → App → Benachrichtigungen**: fifth kind "Familien & Sitzungen" (`push.js` kinds,
  texts).
- **Statistics** (`/stats`): "Erledigt" and the event tiles include the counted entries (from the
  API, no client change beyond labels); new section "In Sitzungen & Familien" in the overview
  (`stats/TogetherStats.jsx`: team time tile, a row per place with done / events, linked); the
  "Erledigt" tab (`CompletedTasks.jsx`) gets a second section "In Sitzungen & Familien" from
  `together.done` (for the period picked on the overview: this week by default), each with where
  it was done.
- Texts in `translations.js` / `focusTexts.js` (de + en).
- Tests: kind switch + event row in the family page, the move card (left-out cases, confirm,
  request), `noticeView` for the new kinds, the settings row, `TogetherStats`.

## Legal

Privacy policy, push section: pushes now also carry names and texts other members of my families /
sessions wrote (entries, chat). Update the text in the same change (`LegalPage.jsx`).

## Docs

`CLAUDE.md` (families, push kinds, stats) and a new **`docs/notifications.md`**: the overview
below, kept up to date with every change to notifications.

## Notification overview (after this change)

Push kinds are switched per device in Settings → App → Benachrichtigungen. Nobody is told about
what they did themselves. While the web app is in the foreground the service worker shows no push
(the test push and Safari always show).

| When | Who | How | Kind / switch |
|---|---|---|---|
| A reminder time of my own task / event (minutes before; all-day ones at my all-day time) | me | push; in the app a toast + sound (only a toast while push is on) | `plan` |
| … same, with "Erinnerung per Mail" on the task | me (owner only) | mail | per task |
| A reminder time of a **family** entry (owner's time zone) **(new)** | every joined member | push | `plan` |
| My focus countdown / Pomodoro phase ends | me | push (server-side, also with the phone off), in the app sound + toast | `plan` |
| A routine's time | me | push + in-app toast | `plan` |
| Testers' reminders | me | push (not to devices that ring them), Android: alarm clock; open web app: full-page alert | `plan` |
| Morning, 07:30–11:00 local, something open today | me | push "Dein Tag" | `digest` |
| A direct message | the friend | push, inbox live + sound | `messages` |
| Friend request | the person asked | push | `social` |
| Invite to a session / family | the invited | push | `social` |
| A task shared with me | me | push, inbox (requests) | `social` |
| Given a session task | the assignee | inbox notice + push | `social` |
| Given a **family** entry **(new)** | the assignee | inbox notice + push | `social` |
| Admin broadcast | everybody / testers | inbox notice + push | `social` |
| New beta request | admins | push | `social` |
| Somebody else adds an entry to my family / session (new, moved or copied) **(new)** | the other joined members | inbox notice (bundled per person and place for 30 min) + push | `groups` |
| A message in my family's / session's chat **(new)** | the other joined members | push (one per chat, replaced) | `groups` |
| Cheered in the feed | me | in-app toast | — |
| Streak extended / milestone, level up, challenge done | me | in-app toast (+ confetti) | — |
| Streak still open after 18:00 | me | in-app toast, once a day | — |
| Push offer after the first task, install / rating questions | me | in-app dialog, once | — |
