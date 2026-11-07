# Anonymous usage statistics, admin "Nutzung" tab, fuller admin Users tab — design

Date: 2026-11-07 · Repos: `quidey_react-backend`, `quidey_react-main` (this spec), `quidey_landing`;
`quidey_android` takes the web part over with `git pull web <branch>` and adds nothing of its own.

## 1. Goal

Find out **when** people use Quidey, **which** features they use, **how much** (focus minutes, tasks,
time in the app) and **roughly who** (platform, language, plan), to improve the app and grow it. Admins see
it in a new tab and export it to Excel / CSV. Also: the admin Users tab shows everything an account has,
and the privacy policy, terms and landing page say what is now true.

### What the owner decided

- **Anonymous totals only** ("so many people complete tasks at this time"). No per-user trail is kept.
  A per-user mode may come later; it would be consent **version 2**, asked separately.
- **Consent first**, asked once per account with a card; "No" is as easy as "Yes"; the app works the same
  either way (Art. 7(4) GDPR: no coupling). Changeable any time in Settings.
- All four kinds of question: when, which features, how much, rough who.
- Totals are kept **without a time limit**.
- Small numbers are shown **as they are** (no "<3" suppression).
- Export **.xlsx and CSV**.
- Users tab "full name" = the **display name as it is**; no new name field.
- Landing page short notes say only **"Ohne Werbung." / "No ads."**

### Not in scope

Per-user analytics, A/B testing, funnels, retention cohorts, anything on the landing page itself
(it keeps collecting nothing), changes to the Android Firebase opt-in.

## 2. Data model (backend migration `044_usage_statistics.sql`)

```sql
ALTER TABLE users
  ADD COLUMN usage_consent text CHECK (usage_consent IN ('granted', 'denied')),  -- NULL = not asked yet
  ADD COLUMN usage_consent_at timestamptz,
  ADD COLUMN usage_consent_version smallint;

-- the only analytics data that stays: totals, no user id
CREATE TABLE usage_hourly (
  hour        timestamptz NOT NULL,   -- UTC, truncated to the hour
  local_hour  smallint    NOT NULL CHECK (local_hour BETWEEN 0 AND 23),   -- in the person's timezone
  weekday     smallint    NOT NULL CHECK (weekday BETWEEN 1 AND 7),       -- ISO, 1 = Monday, local
  metric      text        NOT NULL CHECK (metric ~ '^[a-z0-9_:]{1,48}$'),
  platform    text        NOT NULL CHECK (platform IN ('web', 'pwa', 'android')),
  language    text        NOT NULL CHECK (language IN ('de', 'en')),
  plan        text        NOT NULL CHECK (plan IN ('free', 'tester', 'pro')),
  events      integer     NOT NULL DEFAULT 0,
  people      integer     NOT NULL DEFAULT 0,  -- distinct people in this hour for this row's dimensions
  value_sum   bigint      NOT NULL DEFAULT 0,  -- e.g. focus seconds, active minutes
  PRIMARY KEY (hour, local_hour, weekday, metric, platform, language, plan)
);

-- short-lived "already counted" marks so people are distinct; deleted when their period is over
CREATE TABLE usage_seen (
  scope     text        NOT NULL CHECK (scope IN ('hour', 'day', 'week')),
  period    timestamptz NOT NULL,   -- start of the hour / local day / ISO week
  metric    text        NOT NULL,   -- '*' = "active at all"
  user_id   integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (scope, period, metric, user_id)
);

-- distinct people per day and week (across all hours), also totals only
CREATE TABLE usage_people (
  scope    text        NOT NULL CHECK (scope IN ('day', 'week')),
  period   date        NOT NULL,
  metric   text        NOT NULL,
  platform text NOT NULL, language text NOT NULL, plan text NOT NULL,
  people   integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, period, metric, platform, language, plan)
);
```

The `schema.sql` dump and the migration test (`scripts/test/migrations.test.mjs`) are updated to match.
The app DB role (`scripts/db-app-role.sql`) gets the rights on the new tables.

### Dimensions

- **platform** is sent by the app: `android` (Capacitor), `pwa` (installed web app, `display-mode: standalone`),
  otherwise `web`. The server only accepts those three.
- **language** is the account's `users.language`, else `de`.
- **plan** is worked out on the server: `pro` (is_pro or a paid pro_until in the future), else `tester`
  (is_tester or is_admin), else `free`.
- **local_hour / weekday** come from `users.timezone` (fallback `Europe/Berlin`).

### Metrics (closed list in `utils/usage.js`, anything else is dropped)

| metric | from | value_sum |
|---|---|---|
| `app_open` | client, once per app start / return after 30 min away | — |
| `active_minute` | client, one per minute the page is visible and was used in that minute | minutes |
| `view:<area>` | client, on navigation, same names as `screenName()` (home, calendar, focus, stats, notes, study, routines, routine_run, community_*, session, family, inbox, profile, user_profile, settings, fun, pro, admin, tester, other) | — |
| `task_created` | **server**, `POST /api/tasks` and the shared / family task creation routes | — |
| `task_done` | **server**, where a task becomes done (own, shared session, family) | — |
| `focus_start` | client (`startFocus`), param mode kept out (metric only) | — |
| `focus_done` | **server**, when a focus session is saved | focus seconds |
| `group_created`, `friend_request_sent`, `friend_added`, `shared_session_created`, `family_created` | client, existing `noteAction` names | — |
| `routine_run`, `note_written`, `study_plan_applied`, `reminder_created` | client, at those actions | — |

Never: content, names, ids, free text, URLs with ids.

## 3. Counting (backend)

`utils/usage.js` exports `countUsage(db, userId, metric, { value = 0, platform }, at = now)`:

1. Read the account's `usage_consent`, `timezone`, `language`, plan flags (cached per user in memory for
   60 s, dropped when the consent changes). Not `granted` → return, nothing happens.
2. In one transaction: insert `usage_seen` marks for (hour, metric), (local day, metric), (ISO week, metric)
   and the same three with metric `*` with `ON CONFLICT DO NOTHING RETURNING`; upsert the `usage_hourly`
   row (`events + 1`, `value_sum + value`, `people + 1` only when the hour mark was new); upsert
   `usage_people` day / week rows (+1 only when that mark was new). The `*` marks feed the metric
   `active` (any activity) in `usage_people` and `usage_hourly`.
3. Errors are logged and swallowed: counting never breaks the request that triggered it.

**Server-side counts** (`task_created`, `task_done`, `focus_done`) are called after the route's own
commit, with the platform taken from the request header `X-Quidey-Platform` (validated, default `web`).

**Client beacon**: `POST /api/usage` `{ platform, events: [{ metric, at, value? }] }`, signed in, at
most 200 events per call, `at` within the last 24 h and not in the future (else dropped), metrics outside
the list dropped, `active_minute` at most one per user per minute (server keeps the last minute per user in
memory). Rate limit: the global `/api` limiter plus 30 calls / 10 min per user. Answers `204` always (also
without consent, so the client needn't know). Server-side metrics sent by the client are ignored.

**Cleanup**: an interval job (hourly, like the other jobs in index.js) deletes `usage_seen` rows whose
period ended (hour marks after 2 h, day marks after 2 days, week marks after 8 days).

**Consent**:
- `PUT /api/profile/usage-consent` `{ granted: boolean }` → sets `usage_consent`, `_at = now()`,
  `_version = 1`; on `false` also `DELETE FROM usage_seen WHERE user_id = $1`. Answers the new state.
- The existing "who am I" / access response carries `usageConsent: { choice, at, version }`.
- Deleting an account removes its marks (FK cascade); totals stay (anonymous).

## 4. Client (quidey_react-main)

- `src/features/usage/usage.js`: `track(metric, value?)` queues events in memory (and in sessionStorage
  so a reload doesn't lose them, at most 500); flushes every 60 s, on `visibilitychange` → hidden (with
  `fetch(..., { keepalive: true })`, the token header can't go in `sendBeacon`), and on sign-out (then
  clears). Only queues while `usageConsent.choice === 'granted'`; switching it off empties the queue.
  `platform()` from `isNativeApp()` / `matchMedia('(display-mode: standalone)')`. The API helper sends
  `X-Quidey-Platform` on every request.
- Active minutes: a tracker in App counts a minute when the page is visible and saw pointer / key / scroll
  input in that minute.
- **One call site per action**: `trackScreen` and `trackEvent` in `features/native/analytics.js` stay the
  Firebase side; a new `features/usage/track.js` `trackAction(name)` / `trackView(pathname)` calls both
  (each with its own consent). Existing call sites switch to it; `screenName()` is reused.
- **Consent card** (`components/onboarding/OnboardingPrompts.jsx`, a new `UsageQuestion`, after the
  other prompts and the tour, 1.5 s after the app is there, like `AnalyticsQuestion`):
  title "Hilf mit, Quidey besser zu machen", text "Quidey zählt anonym mit, wann und welche Bereiche
  genutzt werden, z. B. ‚120 Leute haben heute um 20 Uhr Aufgaben erledigt'. Nie wer, nie deine Inhalte.
  Du kannst es jederzeit in den Einstellungen ändern.", buttons "Ja, mitzählen" / "Nein" (same style),
  line "Später fragen · Datenschutz". Closing = ask again next start. Shown while `usageConsent.choice`
  is null. English texts in translations.js. On Android, if both questions are due, this one comes first.
- **Settings → Datenschutz** (new section, `/settings#privacy`): row "Anonyme Nutzungsstatistik" with
  on/off and the line "Zugestimmt am …" / "Abgelehnt am …" / "Noch nicht gefragt", link to the privacy
  policy section. Visible on every platform. The Android "Nutzungsdaten" (Firebase) section stays as it is.

## 5. Admin → "Nutzung" tab (new, `components/admin/AdminUsage.jsx`)

Added to `TABS` in Admin.jsx after "overview". Backend: `GET /api/admin/usage?from=&to=&platform=&language=&plan=`
(admins only, range at most 5 years, dates as local `YYYY-MM-DD`) returns one object with:

- `summary`: active people today, average active people per day in the range, the busiest day in the
  range (date + people), active people this ISO week (from `usage_people` week rows), total focus hours,
  consent counts from `users` (granted / denied / not asked). Distinct people across a free range can't
  be known from totals, so the UI never claims "N different people in this range".
- Sums of hourly `people` are "person-hours", sums of daily `people` are "person-days"; the UI labels them so.
- `heatmap`: weekday × local_hour → people (sum of hourly `people`) and events, for metric `active`,
  `task_done`, `focus_start` (switch in the UI).
- `daily`: per day: active people, tasks created, tasks done, focus minutes, average active minutes per
  active person; weekly active people.
- `features`: per `view:*` and action metric: people (daily-distinct summed = "person-days", labelled),
  events, events per person-day, a 14-point sparkline.
- `splits`: per platform / language / plan: person-days and events.

UI: range control (7 / 30 / 90 days / 12 months / Alles / custom from–to), three filter selects, the
summary row (same `.stats` style as the overview), heatmap (a CSS grid with token colours, numbers in each
cell on hover / focus and in an accessible table), daily lines (inline SVG, no chart library), feature
table, splits. A note: "Nur Summen von Leuten, die zugestimmt haben. Keine Personen, keine Inhalte."
Skeletons while loading, as the other tabs. Real numbers everywhere, no suppression.

**Export** (buttons "Excel (.xlsx)" and "CSV" in the tab's head), built in the browser from the same
response plus `GET /api/admin/usage/raw?from=&to=&…` (the `usage_hourly` rows of the range, at most
200 000 rows, else a message to narrow the range):
- `.xlsx` via `write-excel-file` (dynamic `import()` on click, so it is its own chunk): sheets
  "Übersicht", "Tageszeiten", "Täglich", "Bereiche", "Aufteilung", "Rohdaten"; dates as dates, numbers as
  numbers, a header row, column widths. File `quidey-nutzung_<from>_<to>.xlsx`.
- CSV: a small menu with one file per sheet; UTF-8 with BOM, `;` separator, `,` decimal in German
  (`.` in English), quoted fields. File `quidey-nutzung-<sheet>_<from>_<to>.csv`.

## 6. Admin → Users tab

- Backend: `ADMIN_USER_SELECT` / `toAdminUser` add `birthDate`, `emailVerified`, `termsAcceptedAt`,
  `privacyAcceptedAt`, `language`, `timezone`, `signIn` (`password` | `google` | `both` from
  `has_password` / `google_sub`), `level`, `isOwner`, `usageConsent` {choice, at, version}.
  Never `password_hash`, `token_version`, `google_sub` itself.
- `GET /api/admin/users?q=&sort=newest|oldest|name&page=&pageSize=` (pageSize ≤ 100, default 50)
  answers `{ users, total }` (the old array shape stays for one release when no `page` is sent, so an
  older app keeps working).
- `GET /api/admin/users/export` → all users (no limit) with the fields above; writes
  `admin_actions` `export_users` (target: the admin themself, so the column isn't empty).
- UI: each row shows the display name in full, `@username` in full (wraps, no ellipsis), email with a
  verified mark, created date, role chips; the toggles stay. A click / Enter on the row opens a detail
  panel (a sheet via `useSheet`) with every field in a definition list: ID, Anmeldung, E-Mail (+ bestätigt),
  Erstellt (date + time), Nutzungsbedingungen / Datenschutz akzeptiert am, Sprache, Zeitzone, Geburtsdatum,
  Level, Pro (Geschenk / bezahlt bis), Rollen, Beta-Anfrage (status, reason, dates), Nutzungsstatistik
  (Ja / Nein / nicht gefragt + date), Profilbild. Sort select, "N Konten", "Mehr laden" paging, export
  buttons (.xlsx / CSV, same helpers as § 5). Admin action log text `adminAction_export_users`.

## 7. Legal texts and landing page

Privacy policy (`src/legal/LegalPage.jsx`, German; the English note in the same file where there is one):
- § 2 bullet "Es gibt keine Werbung und keine Cookies. Im Browser gibt es kein Tracking und keine
  Analyse-Tools; …" → "Es gibt keine Werbung und keine Cookies. Mit deiner Einwilligung zählt Quidey anonym
  mit, wann und welche Bereiche genutzt werden: nur Summen, ohne Bezug zu dir, auf dem eigenen Server
  (Abschnitt N). In der Android-App nutze ich zusätzlich Google Analytics für Firebase, nur wenn du
  einwilligst (Abschnitt 3)."
- New section "Anonyme Nutzungsstatistik (nur mit Einwilligung)" after the section on the API server:
  purpose; what is counted (the metric list in plain words); dimensions (platform, language, plan, hour and
  weekday in your timezone); how: the app sends these events with your account to the Quidey server, which
  adds them to totals and stores no events; to count people only once it keeps a mark "already counted" per
  hour / day / week with your user id, deleted at the latest 8 days later; the totals have no reference to
  a person and are kept without a time limit; no third parties, no cookies; legal basis Art. 6(1)(a) GDPR
  and § 25(1) TDDDG; asked once, both answers equal, change any time in Settings → Datenschutz; withdrawal
  stops counting at once and deletes your marks; totals already added can't be traced to you and stay;
  the app works the same without consent. Section numbers after it move up (`privacyNo`).
- § "Speicherung auf deinem Gerät": add the queue of not-yet-sent events (sessionStorage, only with
  consent, at most until sent).
- § "Speicherdauer": marks ≤ 8 days, totals anonymous without limit, consent record as long as the account.
- `LEGAL_VERSION_DATE` → "07.11.2026 (anonyme Nutzungsstatistik mit Einwilligung)".
- Legal tests pin the new sentences (as `legal` tests do now).

Terms (same file): one sentence in the part on the service: the statistics are optional and the app's
functions don't depend on them.

Landing page (`quidey_landing`), every occurrence, DE and EN:
- `src/copy.js` notes: "Kostenlos in der Beta. Ohne Werbung, ohne Tracking." → "Kostenlos in der Beta.
  Ohne Werbung."; "Free during the beta. No ads, no tracking." → "Free during the beta. No ads."
- FAQ "Was passiert mit meinen Daten?" / "What happens to my data?": drop "kein Tracking" / "no tracking";
  add one sentence: "Mit deinem Ja zählt Quidey anonym mit, wann und welche Bereiche genutzt werden, nur
  als Summen." / "If you say yes, Quidey counts anonymously when and which parts get used, only as totals."
- `src/posts/hilfe/datenschutz-daten.md` (and an English counterpart if one exists): description and
  summary the same way.
- A last `grep -ri "tracking"` over both repos' texts finds no promise left that isn't true.

## 8. Testing

Backend (`node --test`, `scripts/test/`):
- without consent `POST /api/usage` answers 204 and stores nothing; with consent rows appear;
- the same person twice in an hour: events 2, people 1; next hour people 1 again; day / week people distinct;
- server-side `task_done` / `focus_done` counted once, with value;
- unknown metrics, future / old `at`, oversized batches dropped; client-sent server metrics ignored;
- withdrawal deletes marks; cleanup deletes ended periods; account deletion cascades;
- admin endpoints 403 for non-admins; usage response shape; raw row cap; users paging / sort / total;
  export fields contain no hash / token; export logged in `admin_actions`;
- migration test: 044 applies on the current schema.

Frontend (Vitest):
- consent card shows while not asked, both answers call the API, closing asks again next start;
- Settings switch reflects and changes the choice;
- `track` queues only with consent, flushes, empties on withdrawal / sign-out;
- AdminUsage renders the response, range / filter change refetches, export builds the six sheets
  (write-excel-file mocked) and CSVs with BOM / separators;
- Users tab: full names unshortened, detail sheet lists every field, paging, export;
- legal: pinned sentences; `translations` de / en have the same keys.

Landing: `npm run build` passes; the existing copy checks (if any) are updated.

## 9. Order of work and branches

The repos are on feature branches today (backend `google-signin-fcm`, web `refactor`, landing
`pro-and-android`). Work goes on a new branch per repo, `usage-statistics`, from the current branch.
Order: backend (migration, counting, endpoints, tests) → web (client tracking, consent, Settings, admin
tabs, legal, tests) → landing copy → Android `git pull web usage-statistics` and a build check.
Deploy order: migration first, then backend, then web, then landing; the privacy policy goes live with
the web app, before any counting can start (counting needs a consent given in that web app).
