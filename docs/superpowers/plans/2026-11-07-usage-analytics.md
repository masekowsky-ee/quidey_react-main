# Anonymous usage statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consent-based anonymous usage totals (when / which features / how much / rough who), an admin "Nutzung" tab with .xlsx / CSV export, a fuller admin Users tab with export, and legal + landing texts that match.

**Architecture:** The server keeps only hourly totals (`usage_hourly`, `usage_people`) and short-lived dedupe marks (`usage_seen`, ≤ 8 days). Tasks created / done and focus time are counted inside the existing routes; page views, active minutes and other actions arrive batched from the app via `POST /api/usage`. Nothing is counted unless `users.usage_consent = 'granted'`. Admin views and exports are computed from the totals.

**Tech Stack:** Express 5 + pg (backend, `node --test` against a throwaway Postgres), React 19 + Vite + Redux + Vitest (web), Astro (landing), `write-excel-file@4.1.1` (lazy, browser build).

**Spec:** `docs/superpowers/specs/2026-11-07-usage-analytics-design.md` (read it; this plan argues from it).

## Global Constraints

- Branch `usage-statistics` in each repo, created from the current branch (backend `google-signin-fcm`, web `refactor`, landing `pro-and-android`).
- Consent version is `1`; `usage_consent` ∈ `'granted' | 'denied' | NULL`.
- Platforms exactly `web | pwa | android`; languages `de | en`; plans `free | tester | pro`; timezone fallback `Europe/Berlin`.
- Metric whitelist (spec § 2) lives only in backend `utils/usage.js` (`METRICS`, `CLIENT_METRICS`, `SERVER_METRICS`); `view:<area>` areas = the names `screenName()` returns plus `notes`, `study`.
- Never store or export content, names in analytics, ids in metric names, `password_hash`, `token_version`, `google_sub`.
- `usage_seen` deleted: hour marks 26 h after the hour starts, day marks 2 days after, week marks 8 days after. Totals kept without limit.
- Real numbers everywhere; no small-number suppression.
- German-first copy; every new translation key exists in `de` and `en`.
- Landing short notes: exactly "Kostenlos in der Beta. Ohne Werbung." / "Free during the beta. No ads."
- `LEGAL_VERSION_DATE` = `'07.11.2026 (anonyme Nutzungsstatistik mit Einwilligung)'`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A user who withdraws consent while events are queued in the app: nothing of that queue may be counted (client clears the queue, server re-checks consent per batch). → test in Task 3 and Task 6.
2. Timezone edges: a user in `America/New_York` acting at 01:30 UTC is counted at their local hour / weekday and local day, not the server's. → test in Task 2.
3. Counting failures must not break the user's request (DB error in `countUsage` during `PUT /api/tasks/:id`). → test in Task 3.
4. A big export range (12 months / "Alles"): the raw endpoint caps at 200 000 rows with `USAGE_RANGE_TOO_BIG`, and the UI says to narrow the range instead of hanging. → tests in Task 4 and Task 9.
5. CSV opened in German Excel: BOM, `;`, decimal comma, a value containing `;` or `"` stays one cell. → test in Task 8.

---

## Backend (`quidey_react-backend`)

### Task 1: Migration 044 and schema

**Files:**
- Create: `migrations/044_usage_statistics.sql`
- Modify: `schema.sql` (users columns; three new tables + PKs, as the dump formats them), `scripts/db-app-role.sql` (SELECT/INSERT/UPDATE/DELETE on the new tables)
- Test: `scripts/test/migrations.test.mjs`

**Interfaces:**
- Produces: columns `users.usage_consent`, `users.usage_consent_at`, `users.usage_consent_version`; tables `usage_hourly`, `usage_seen`, `usage_people` exactly as spec § 2 (plus index `usage_seen (user_id)` for withdrawal, and `usage_hourly (hour)`).

- [ ] **Step 1:** In `migrations.test.mjs`, add a test following the file's pattern: applying 044 on the previous schema yields the three tables and columns; a second run is a no-op (use `IF NOT EXISTS` throughout); inserting `usage_consent = 'maybe'` fails the CHECK.
- [ ] **Step 2:** Run `npm test -- --test-name-pattern=044` → FAIL (file missing).
- [ ] **Step 3:** Write the migration (header comment in the style of 043: what and why), update `schema.sql` and `db-app-role.sql`.
- [ ] **Step 4:** Run `npm test` → all PASS (api tests build their DB from `schema.sql`, so they prove the dump is valid).
- [ ] **Step 5:** Commit `feat(usage): migration 044, consent columns and usage tables`.

### Task 2: Counting core `utils/usage.js`

**Files:**
- Create: `utils/usage.js`
- Test: `scripts/test/usage.test.mjs` (unit tests with their own throwaway DB from `schema.sql`; copy the DB setup / teardown lines from `api.test.mjs`, no server)

**Interfaces:**
- Produces:
  - `METRICS: Set<string>`, `SERVER_METRICS = new Set(['task_created','task_done','focus_done'])`, `CLIENT_METRICS` (the rest), `isMetric(name) -> boolean` (accepts `view:<area>` for whitelisted areas).
  - `planOf(row) -> 'free'|'tester'|'pro'` (row has `is_pro, pro_until, is_tester, is_admin`; reuse `hasPro` from `utils/access`).
  - `cleanPlatform(value) -> 'web'|'pwa'|'android'` (anything else → `'web'`).
  - `localParts(date, timeZone) -> { localHour, weekday, day: 'YYYY-MM-DD', weekStart: 'YYYY-MM-DD' }` via `Intl.DateTimeFormat` (ISO weekday, week starts Monday); invalid zone → `Europe/Berlin`.
  - `async countUsage(db, userId, metric, { value = 0, platform = 'web', at = new Date() } = {}) -> boolean` (true when counted). Reads the account (60 s in-memory cache), returns false unless `usage_consent = 'granted'` and `isMetric(metric)`. One transaction: `usage_seen` inserts for (hour|day|week × metric and `*`) with `ON CONFLICT DO NOTHING RETURNING`, upsert `usage_hourly` for `metric` and, when the `*` hour mark is new, for `active`; upsert `usage_people` day/week rows for `metric` and `active` when their marks were new. Catches and logs every error, returns false.
  - `forgetUsageAccount(userId)` drops the cache entry.
  - `async cleanupUsage(db, now = new Date()) -> number` deletes ended marks (Global Constraints).
  - `async withdrawUsage(db, userId)` deletes the user's `usage_seen` rows and calls `forgetUsageAccount`.

- [ ] **Step 1: Write the failing tests** in `usage.test.mjs`:
  - `no consent → nothing stored`: `countUsage(db, u, 'task_done')` returns false; `usage_hourly` empty.
  - `same person twice in one hour`: two calls → `usage_hourly` row for `task_done` has `events = 2, people = 1`; row `active` has `people = 1`.
  - `next hour counts the person again`: `at` +1 h → second hourly row `people = 1`; `usage_people` day row `task_done` people = 1 (not 2).
  - `two people`: day row people = 2.
  - `value is summed`: two `focus_done` with value 600 and 900 → `value_sum = 1500`.
  - `local time`: user timezone `America/New_York`, `at = 2026-11-10T01:30:00Z` → `local_hour = 20`, `weekday = 1` (Monday 9 Nov), `usage_people` day `2026-11-09`.
  - `dimensions`: tester with `language = 'en'`, platform `'pwa'` → row has `plan 'tester', language 'en', platform 'pwa'`; `planOf` for paid `pro_until` in the future → `'pro'`.
  - `unknown metric` → false; `view:calendar` true; `view:u/anna` false.
  - `cleanup`: marks for an hour 3 h ago deleted, current hour kept; day marks 3 days ago deleted; week marks 9 days ago deleted, 6 days ago kept.
  - `withdraw`: after `withdrawUsage`, no `usage_seen` rows for that user.
- [ ] **Step 2:** `npm test -- scripts/test/usage.test.mjs` → FAIL (module missing).
- [ ] **Step 3:** Implement `utils/usage.js` with the signatures above.
- [ ] **Step 4:** Run the file → PASS.
- [ ] **Step 5:** Commit `feat(usage): counting core with distinct people per hour, day and week`.

### Task 3: Consent, beacon, server-side counts, cleanup job

**Files:**
- Modify: `index.js` (`/api/me` select + response; new `PUT /api/profile/usage-consent`; new `POST /api/usage`; calls in `POST /api/tasks`, `PUT /api/tasks/:id` where done flips to true, `POST /api/shared-sessions/:id/tasks`, `PATCH /api/shared-sessions/:id/tasks/:taskId`, the family task create / update routes, `POST /api/sessions`; hourly `setInterval(cleanupUsage)` next to the other jobs, `.unref()`)
- Test: `scripts/test/api.test.mjs` (new `describe("usage statistics")`)

**Interfaces:**
- Consumes: Task 2 exports.
- Produces:
  - `/api/me` adds `usageConsent: { choice: 'granted'|'denied'|null, at: ISO|null, version: number|null }`.
  - `PUT /api/profile/usage-consent` body `{ granted: boolean }` → 200 `{ choice, at, version: 1 }`; non-boolean → 400 `INVALID_INPUT`; `false` calls `withdrawUsage`; both call `forgetUsageAccount`.
  - `POST /api/usage` body `{ platform, events: [{ metric, at, value? }] }` → always 204 for a valid shape (400 `INVALID_INPUT` if `events` isn't an array or > 200). Drops: unknown metrics, `SERVER_METRICS`, `at` older than 24 h or > 60 s in the future, `active_minute` repeats within the same minute per user (in-memory map), `value` only kept for `active_minute` (=1). Per-user limiter 30 calls / 10 min (`express-rate-limit` keyed by `req.user.userId`). Mounted with `authenticateToken` but **without** `requirePro` (beta-gate users are app users too).
  - Server counts read the platform from header `X-Quidey-Platform` through `cleanPlatform`, run after the route's commit and are not awaited by the response (`countUsage(...).catch(() => {})`). `focus_done` value = `totalTime` seconds, only when `totalTime > 0`.

- [ ] **Step 1: Write the failing tests** (use `member()`, `call()`, `sql()`):
  - `/api/me` of a new account → `usageConsent.choice === null`.
  - `PUT /api/profile/usage-consent {granted:true}` → 200, `choice 'granted'`, `version 1`, `at` set; `{granted:'yes'}` → 400.
  - beacon without consent → 204 and `usage_hourly` empty.
  - beacon with consent `[{metric:'view:calendar'},{metric:'task_done'},{metric:'nope'}]` → rows for `view:calendar` and `active` only.
  - `active_minute` twice with the same minute → events 1.
  - `at` 2 days old dropped; 201 events → 400.
  - creating a task with consent → `task_created` events 1; marking it done via `PUT /api/tasks/:id` → `task_done` events 1; marking undone and done again → events 2, people 1.
  - `POST /api/sessions {totalTime: 1500, ...}` → `focus_done` value_sum 1500; header `X-Quidey-Platform: android` → platform `android`; header `evil` → `web`.
  - withdrawal: consent true, beacon, then `{granted:false}` → user's `usage_seen` rows 0; a following beacon stores nothing (Review Focus 1).
  - counting failure doesn't break the request: temporarily `ALTER TABLE usage_hourly RENAME TO usage_hourly_x`, `PUT /api/tasks/:id` done → 200; rename back (Review Focus 3).
  - deleting the account (existing delete route) removes its `usage_seen` rows, `usage_hourly` totals stay.
- [ ] **Step 2:** `npm test -- --test-name-pattern="usage statistics"` → FAIL.
- [ ] **Step 3:** Implement the routes and calls above.
- [ ] **Step 4:** `npm test` → all PASS (the whole suite: the route edits touch hot paths).
- [ ] **Step 5:** Commit `feat(usage): consent endpoint, usage beacon, server-side counts, cleanup job`.

### Task 4: Admin usage endpoints

**Files:**
- Modify: `index.js` (below `/api/admin/overview`); create `utils/usageReport.js` for the queries
- Test: `scripts/test/api.test.mjs` (`describe("admin usage")`)

**Interfaces:**
- Produces:
  - `GET /api/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD&platform=&language=&plan=` (filters optional, validated against the Global Constraints sets; `from ≤ to`, span ≤ 5 years, else 400 `INVALID_RANGE`). `from`/`to` are dates in `Europe/Berlin` for `hour` filtering. Answers:
    ```
    { range: {from,to},
      summary: { activeToday, avgActivePerDay, busiestDay: {date, people}|null, activeThisWeek, focusHours,
                 consent: { granted, denied, notAsked } },
      heatmap: { active|task_done|focus_start: [{ weekday, hour, people, events }] },
      daily: [{ date, active, tasksCreated, tasksDone, focusMinutes, activeMinutesPerPerson }],
      weekly: [{ weekStart, active }],
      features: [{ metric, personDays, events, perPersonDay, spark: number[14] }],
      splits: { platform|language|plan: [{ key, personDays, events }] } }
    ```
    Heatmap / features / splits sum `usage_hourly` / `usage_people` with the filters; `daily.active` from `usage_people` day rows metric `active`.
  - `GET /api/admin/usage/raw?…same` → `{ rows: [{ hour, localHour, weekday, metric, platform, language, plan, events, people, valueSum }] }`; over 200 000 rows → 400 `USAGE_RANGE_TOO_BIG`.
- [ ] **Step 1: Write the failing tests:** seed via `countUsage` for two consenting users across two days and two platforms, then: non-admin → 403 `ADMIN_REQUIRED`; `summary.consent` counts match `users`; `daily` has both dates with right `active`, `tasksDone`, `focusMinutes` (value_sum / 60, rounded to 1 decimal); `heatmap.task_done` cell for the seeded local hour has `people 2`; `platform=android` filter halves the numbers; `from > to` → 400 `INVALID_RANGE`; raw with `USAGE_RAW_MAX` env set to 3 → 400 `USAGE_RANGE_TOO_BIG` (read the cap from `limitFromEnv("USAGE_RAW_MAX", 200000)` so the test can lower it).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(admin): usage report and raw rows`.

### Task 5: Admin users — all fields, paging, export

**Files:**
- Modify: `index.js` (`ADMIN_USER_SELECT`, `toAdminUser`, `GET /api/admin/users`, new `GET /api/admin/users/export`)
- Test: `scripts/test/api.test.mjs` (extend the existing admin users tests)

**Interfaces:**
- Produces: `toAdminUser` adds `birthDate, emailVerified, termsAcceptedAt, privacyAcceptedAt, language, timezone, signIn ('password'|'google'|'both'), level, isOwner, usageConsent {choice, at, version}`.
  `GET /api/admin/users?q=&sort=newest|oldest|name&page=1&pageSize=50` → `{ users, total }` when `page` is given (pageSize 1–100); without `page` the old array (≤ 200, newest first). `name` sorts by `lower(coalesce(display_name, username))`.
  `GET /api/admin/users/export` → `{ users }` (all, newest first) and one `admin_actions` row `export_users` with target = the admin.
- [ ] **Step 1: Write the failing tests:** a user row has every new key; `signIn` is `google` for a Google-only account (existing google test helper) and `password` otherwise; no key matches `/hash|token|google_sub/i` (`JSON.stringify` check) in list and export; paging: 3 users, `pageSize=2&page=2` → 1 user, `total 3`; `sort=oldest` reverses; old call without `page` still returns an array; export logs `export_users`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(admin): every account field, paging, sorted list, user export`.

---

## Web app (`quidey_react-main`)

### Task 6: Client tracking and consent state

**Files:**
- Create: `src/features/usage/usage.js`, `src/features/usage/track.js`, `src/features/usage/useActiveMinutes.js`
- Modify: `src/features/helperFunction.js` (`apiFetch` sends `X-Quidey-Platform: platform()`), `src/features/auth/authReducer.js` (`access.usageConsent`, default `{ choice: null, at: null, version: null }`), `src/features/auth/authAction.js` (`setUsageConsent(granted)` thunk), `src/App.jsx` (`trackView` instead of `trackScreen`; mount `useActiveMinutes`; `track('app_open')` on start and after 30 min hidden), `src/features/onboarding/onboarding.js` + `src/features/session/sessionAction.js` (`trackAction` instead of `trackEvent`), call sites for `routine_run`, `note_written`, `study_plan_applied`, `reminder_created` (where those are saved successfully)
- Test: `src/__tests__/usage.test.js`

**Interfaces:**
- Consumes: Task 3 API.
- Produces:
  - `platform() -> 'android'|'pwa'|'web'` (usage.js).
  - `track(metric, value?)`, `flushUsage({ keepalive }?) -> Promise<void>`, `setUsageEnabled(bool)` (false empties queue + sessionStorage `usageQueue`), `resetUsage()` (tests). Queue ≤ 500, flush every 60 s, on `visibilitychange` hidden with `keepalive: true`, on `SIGNED_OUT_EVENT` cleared without sending.
  - `trackView(pathname)` → Firebase `trackScreen` + `track('view:' + screenName(pathname))`; `trackAction(name)` → Firebase `trackEvent` + `track(name)`.
  - `screenName()` (features/native/analytics.js) adds `notes` and `study` to `PAGES` (they are `other` today); the backend area list in Task 2 is exactly `screenName`'s possible results.
  - `setUsageConsent(granted)` thunk → `PUT /api/profile/usage-consent`, updates `access.usageConsent`, calls `setUsageEnabled`. `SET_ACCESS` also calls `setUsageEnabled(choice === 'granted')`.
  - `selectUsageConsent(state)`.
- [ ] **Step 1: Write the failing tests** (fake timers, mocked `fetch`): no consent → `track` queues nothing and no request after 60 s; consent → three `track`s flush as one `POST /api/usage` with `platform 'web'` and three events; `setUsageEnabled(false)` with a full queue → no request ever (Review Focus 1); hidden tab flushes with `keepalive: true`; `apiFetch` sends `X-Quidey-Platform`; `trackView('/u/anna')` queues `view:user_profile`; `setUsageConsent(true)` stores `access.usageConsent.choice === 'granted'`.
- [ ] **Step 2:** `npx vitest run src/__tests__/usage.test.js` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run lint` → PASS (analytics.test.jsx, onboarding.test.jsx must still pass after the call-site switch).
- [ ] **Step 5:** Commit `feat(usage): app side: queue, beacon, platform header, consent state`.

### Task 7: Consent card and Settings → Datenschutz

**Files:**
- Modify: `src/components/onboarding/OnboardingPrompts.jsx` (`UsageQuestion`, shown before `AnalyticsQuestion` when both are due), `src/components/Settings.jsx` (`SettingSection id="privacy"`, `UsageSetting` row), `src/i18n/translations.js`
- Test: `src/__tests__/onboarding.test.jsx`, `src/__tests__/preferences.test.jsx` (or a new `usageConsent.test.jsx`)

**Interfaces:**
- Consumes: `selectUsageConsent`, `setUsageConsent` (Task 6).
- Produces: translation keys `usageAskTitle`, `usageAskText`, `usageAskYes`, `usageAskNo`, `usageAskLater`, `usageAskPrivacy`, `privacySetting`, `privacySettingHint`, `usageRow`, `usageRowGranted` ("Zugestimmt am {date}"), `usageRowDenied` ("Abgelehnt am {date}"), `usageRowNotAsked`. German copy for the card is exactly the spec § 4 text; English: "Help make Quidey better" / "Quidey counts anonymously when and which parts get used, e.g. ‘120 people completed tasks at 8 pm today’. Never who, never your content. You can change this any time in Settings." / "Yes, count" / "No".
- Due rule: `choice === null && access.checked && !asking && !pushAsking && !tourOpen`, after `ANALYTICS_DELAY_MS`; closing sets a module-level `later` flag (asked again next start).
- [ ] **Step 1: Write the failing tests:** card appears for `choice null` after the delay; "Ja, mitzählen" and "Nein" have the same class and call `PUT /api/profile/usage-consent` with true / false; Escape closes and nothing is sent; not shown when `choice` is set; Settings row shows "Noch nicht gefragt" then flips to "Zugestimmt am …" after switching on; the privacy link goes to `/datenschutz#nutzungsstatistik`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test` + `npm run lint` → PASS (translations test checks de/en key parity).
- [ ] **Step 5:** Commit `feat(usage): consent card and Settings → Datenschutz`.

### Task 8: Export helpers

**Files:**
- Create: `src/features/admin/exportTable.js`
- Modify: `package.json` (`write-excel-file` `4.1.1` exact)
- Test: `src/__tests__/exportTable.test.js`

**Interfaces:**
- Produces:
  - Sheet model: `{ name: string, columns: [{ key, label, type: 'string'|'number'|'date'|'datetime'|'boolean', width? }], rows: object[] }`.
  - `toCsv(sheet, language) -> string`: BOM `﻿`, separator `;`, header = labels, decimal `,` for `de` and `.` for `en`, dates `YYYY-MM-DD`, datetimes `YYYY-MM-DD HH:mm` local, booleans `ja/nein` | `yes/no`, fields with `;`, `"`, CR or LF quoted with `"` doubled, line end `\r\n`.
  - `async downloadXlsx(sheets, fileName)`: `await import('write-excel-file/browser')` (check the package's README for the browser entry of v4 and the multi-sheet call), typed cells, header row bold, widths.
  - `downloadCsv(sheet, language, fileName)`: Blob `text/csv;charset=utf-8` + temporary `<a download>`.
- [ ] **Step 1: Write the failing tests:** `toCsv` starts with `﻿`; `de` 1.5 → `1,5`, `en` → `1.5`; a cell `a;"b"` → `"a;""b"""`; date column → `2026-11-07`; boolean `de` → `ja`; `downloadXlsx` with the module mocked (`vi.mock('write-excel-file/browser')`) is called once with six sheet names in order for the usage case (fixture of six sheets) and the given file name (Review Focus 5).
- [ ] **Step 2:** Run → FAIL. **Step 3:** `npm install write-excel-file@4.1.1 --save-exact`; implement. **Step 4:** Tests PASS; `npm run build` → `write-excel-file` lands in its own chunk (check `dist/assets` names / build output), main chunk size unchanged ±1 KB.
- [ ] **Step 5:** Commit `feat(admin): xlsx and csv export helpers`.

### Task 9: Admin → "Nutzung" tab

**Files:**
- Create: `src/components/admin/AdminUsage.jsx`, `src/components/admin/AdminUsage.module.css` (composes from `Admin.module.css` / `ui.module.css`), `src/features/admin/usageSheets.js` (report + raw → the six sheet models)
- Modify: `src/components/Admin.jsx` (`TABS` gets `'usage'` after `'overview'`, label key `adminUsage` "Nutzung" / "Usage"), `src/features/admin/adminAction.js` (`fetchAdminUsage(params)`, `fetchAdminUsageRaw(params)`), `src/i18n/translations.js`
- Test: `src/__tests__/adminUsage.test.jsx`

**Interfaces:**
- Consumes: Task 4 responses, Task 8 helpers.
- Produces: `usageSheets(report, raw, t) -> Sheet[]` named (de) "Übersicht", "Tageszeiten", "Täglich", "Bereiche", "Aufteilung", "Rohdaten" (en: "Summary", "Times of day", "Daily", "Features", "Splits", "Raw").
- UI per spec § 5: range buttons 7 / 30 / 90 / 365 days / Alles (`from = 2026-11-01`) / custom (two date inputs); filters platform / language / plan (`''` = all); summary stats; heatmap as a 7 × 24 CSS grid (weekday rows Mon–Sun, hour columns), cell background `color-mix` of an accent token by share of max, `title` + a visually hidden table with the numbers; metric switch active / task_done / focus_start; daily chart as inline SVG polyline(s) with axis labels; features table sorted by personDays desc; splits as three small tables; note text `adminUsageNote`. Labels say "Personentage" / "person-days" where sums of daily people are shown. Skeleton while loading. Export buttons: "Excel (.xlsx)" and "CSV" (a small menu of the six sheets); raw is fetched only on export; `USAGE_RANGE_TOO_BIG` → toast `adminError_USAGE_RANGE_TOO_BIG` "Zu viele Zeilen für die Rohdaten. Wähle einen kürzeren Zeitraum." (Review Focus 4).
- [ ] **Step 1: Write the failing tests** (mock `apiFetch` with a report fixture): tab "Nutzung" exists for admins; summary numbers rendered; changing range to 7 days refetches with `from` = today − 6; platform filter adds `platform=android`; heatmap renders 168 cells and the hidden table has the fixture's people number; feature rows sorted; Excel button calls `downloadXlsx` with six sheets and file name `quidey-nutzung_<from>_<to>.xlsx`; raw 400 `USAGE_RANGE_TOO_BIG` shows the toast and no download.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test` + `npm run lint` → PASS; check the tab in the running app (`npm run dev`, light and dark, 375 px wide: no horizontal page scroll, the heatmap scrolls inside its own box).
- [ ] **Step 5:** Commit `feat(admin): Nutzung tab with heatmap, daily, features, splits and export`.

### Task 10: Admin → Users tab, all fields

**Files:**
- Create: `src/components/admin/AdminUserDetail.jsx` (sheet via `useSheet`, `SheetGrabber` first)
- Modify: `src/components/Admin.jsx` (`UsersTab`, `Person`), `src/components/Admin.module.css` (no ellipsis on `.name` / `.meta` in the users list: `overflow-wrap: anywhere`), `src/features/admin/adminAction.js` (`fetchAdminUsers({ q, sort, page, pageSize })` → `{ users, total }`, `fetchAdminUsersExport()`), `src/i18n/translations.js` (`adminAction_export_users`, field labels)
- Test: `src/__tests__/admin.test.jsx`

**Interfaces:**
- Consumes: Task 5 API, Task 8 helpers.
- Produces: `userSheet(users, t) -> Sheet` (columns: ID, Anzeigename, Benutzername, E-Mail, E-Mail bestätigt, Erstellt, Anmeldung, Nutzungsbedingungen akzeptiert, Datenschutz akzeptiert, Sprache, Zeitzone, Geburtsdatum, Level, Pro (Geschenk), Pro bezahlt bis, Tester, Admin, Inhaber, Beta-Anfrage, Beta-Begründung, Nutzungsstatistik, Nutzungsstatistik am, Profilbild); file `quidey-konten_<YYYY-MM-DD>.xlsx|csv`.
- [ ] **Step 1: Write the failing tests:** a 40-character username renders in full (no truncation class, text equal); row click and Enter open the detail sheet listing every field label and value (e.g. "Anmeldung: Google", "Nutzungsstatistik: Ja · 07.11.2026"); sort select sends `sort=name`; "Mehr laden" requests `page=2` and appends; "N Konten" shows `total`; export calls `downloadXlsx` with one sheet whose columns include "Geburtsdatum" and never a key matching `/hash|token/`; toggles and avatar removal still work (existing tests).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm test` + `npm run lint` → PASS; check in the running app at 375 px and desktop.
- [ ] **Step 5:** Commit `feat(admin): users list with every field, detail sheet, paging, export`.

### Task 11: Privacy policy and terms

**Files:**
- Modify: `src/legal/LegalPage.jsx` (§ 2 bullet, new section with `id="nutzungsstatistik"` after the API-server paragraphs of § 3 as its own numbered section via `privacyNo`, § "Speicherung auf deinem Gerät", § "Speicherdauer", terms sentence, English note if the page has one for changed sections), `src/legal/owner.js` (`LEGAL_VERSION_DATE`)
- Test: `src/__tests__/legal.test.jsx`

**Interfaces:** exact sentences from spec § 7; the new section covers, in this order: purpose · what is counted (plain-word list of every metric in `METRICS`) · dimensions · how (events with the account to the Quidey server, only totals stored; "already counted" marks with user id deleted after at most 8 days) · totals anonymous, kept without a time limit · no third parties, no cookies · legal basis Art. 6 Abs. 1 lit. a DSGVO and § 25 Abs. 1 TDDDG · asked once, both answers equal, change in Einstellungen → Datenschutz · withdrawal stops at once, deletes marks, totals stay · the app works the same without consent.

- [ ] **Step 1: Write the failing tests:** the privacy page contains the new § 2 sentence, the heading "Anonyme Nutzungsstatistik (nur mit Einwilligung)", "höchstens 8 Tage", "ohne zeitliche Begrenzung", "Art. 6 Abs. 1 lit. a DSGVO", "Einstellungen → Datenschutz"; it no longer contains "Im Browser gibt es kein Tracking"; the terms contain the optional-statistics sentence; `LEGAL_VERSION_DATE` equals the Global Constraints value; section numbers stay consecutive (existing numbering test, extend if missing).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Edit the texts. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `docs(legal): anonymous usage statistics with consent`.

---

## Landing page (`quidey_landing`)

### Task 12: Landing copy

**Files:**
- Modify: `src/copy.js` (lines with "Ohne Werbung, ohne Tracking", "No ads, no tracking", the two data FAQ answers), `src/posts/hilfe/datenschutz-daten.md` (description + summary; an English counterpart if `grep -ril datenschutz src/posts` finds one)

- [ ] **Step 1:** Replace the texts with the spec § 7 wording (short notes exactly as in Global Constraints; FAQ: drop "kein Tracking" / "no tracking", add the one statistics sentence; help post: same).
- [ ] **Step 2:** `grep -rniE "tracking|kein tracking|no tracking" src` → no remaining promise of "no tracking" (UI words like "Time tracking" in other repos don't count).
- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4:** Commit `copy: anonymous statistics with consent; notes say only "Ohne Werbung"`.

## Android (`quidey_android`)

### Task 13: Take the web branch over

- [ ] **Step 1:** In `quidey_android` (it has uncommitted Android work — leave those files untouched; stash nothing without asking): `git fetch web usage-statistics` and merge it into a new branch `usage-statistics`.
- [ ] **Step 2:** `npm test` and `npm run build` → pass; `npx cap sync android` succeeds.
- [ ] **Step 3:** Commit the merge. Nothing Android-specific changes: the platform is `android` via `isNativeApp()`, the Firebase opt-in stays.

## Finish

- [ ] Run the full suites once more: backend `npm test`, web `npm test` + `npm run lint` + `npm run build`, landing `npm run build`.
- [ ] Use superpowers:finishing-a-development-branch per repo. Deploy order (spec § 9): migrations 044 + 045 → backend → web (with the new privacy policy) → landing.
