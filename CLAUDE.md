# Quidey — project overview

Quidey is a calm planner for students: tasks, a focus timer, a calendar, and friends you study
with live. German-first (de default, en available), currently a **closed beta** — only users
with `is_pro` get into the app. Public site: **quidey.com**.

Two repositories, side by side on this machine:

| Repo | Path | GitHub |
|---|---|---|
| Frontend (this one) | `C:\Users\eesge\quidey_react-main` | masekowsky-ee/quidey_react-main |
| Backend | `C:\Users\eesge\quidey_react-backend` | masekowsky-ee/quidey_react-backend |

`README.md` is still the untouched Vite template; this file is the real description.

## Frontend stack

- React 19 + Vite 8, plain JavaScript (no TypeScript), CSS Modules (most modules
  `composes:` shared classes from `src/components/ui.module.css`), Inter via `@fontsource-variable`.
- State: Redux (`configureStore` + classic reducers/action types + thunks), slices in
  `src/features/rootReducer.js`: `task`, `session`, `auth`, `settings`, `friends`, `together`,
  `toast`, `inbox`.
- Routing: react-router-dom 7 (`BrowserRouter` in `src/main.jsx`).
- Animation: `motion` (Framer Motion) with three user-chosen levels `minimal | normal | extreme`
  (`src/features/settings/motion.js`, `MOTION` presets, confetti `burst`). Remotion
  (`@remotion/player`) renders the intro (`src/components/intro/`) and the landing hero loop.
- Realtime: `socket.io-client` (`src/features/realtime/socket.js`, `useRealtime(event, handler)`),
  loaded with a dynamic import only once signed in.
- Code splitting: every page except Home is `lazy()` in `App.jsx` (`PAGES`), preloaded when the
  app is idle (`preloadPages`); `LegalFooter` lives in its own file so the legal texts stay
  lazy. `vite.config.js` puts react / router / state / motion in their own long-cached chunks.
- i18n: `src/i18n/translations.js` (de/en dictionaries) + `useTranslation()` → `t(key)`.
  Landing page copy lives separately in `src/components/landing/landingCopy.js`.
- Tests: Vitest + jsdom + Testing Library, all in `src/__tests__/` (`npm test`).
  Lint: ESLint 10 flat config (`npm run lint`).

## How the app is gated (`src/App.jsx`)

Order of checks on every render:
1. `/verify-email` → `VerifyEmail` (works signed in or out).
2. Legal paths (`/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/kontakt`, see
   `src/legal/paths.js`) → `LegalPage`, always public.
3. Not signed in → `Landing` (marketing page with sign-in / sign-up).
4. Signed in, access not checked yet → `AccessPending`; not pro → `/beta` (`BetaGate`, user can
   request beta access).
5. Pro → full app: `Header`, `Menu`, `Toaster`, `Tutorial`, animated page routes.

App also: re-checks access on a `PRO_REQUIRED` API error or a refused socket
(`REALTIME_REJECTED`); signs out on `TOKEN_REVOKED`/`TOKEN_INVALID`; opens the Socket.IO
connection while allowed and reloads lists on its signals (`useLiveLists`, `useInboxRealtime`,
debounced via `useRealtimeRefresh`). Polling is only a safety net (`useSafetyPoll`): every 60 s
(an open shared session 30 s) and on focus while the socket is down, but only every 5 min (60 s)
while it's connected. The stopwatch reports every 30 s (`REPORT_EVERY_MS`); others' running
time is counted on locally (`othersRunningMs`). Runs task reminders
(`src/features/tasks/reminders.js`) and the team stopwatch reporter (`useWorkReporter`).

## Pages / features

- `/` Home — layout `solo` (task list + focus/timer area: `TaskContainer`, `TimerContainer`,
  `WorkingContainer`, `WeekDaysContainer`) or `team` (`TeamHome`), switchable in settings.
- `/calendar` — month / week / agenda views, drag tasks between days, keyboard grid,
  `TaskEditor` (times, reminders, repeat weekly/monthly/yearly, notes, groups/labels, sharing).
- `/history` — past focus sessions and completed tasks, CSV export.
- `/profile`, `/settings` — profile, password, "sign out everywhere", delete account; language,
  theme (dark/light/system), accent colour (green, ocean, violet, sunset (default), rose, gold —
  also recolours the favicon), motion level, home layout.
- `/social` — friends and friend requests.
- `/together`, `/together/:id` — shared live study sessions: members, shared task list, a
  stopwatch counting for everyone, activity feed, session chat (realtime).
- `/inbox` — direct messages between friends + notifications/admin broadcasts (realtime).
- `/feedback` — feedback form (mailed to the owner).
- `/admin` — only for `isAdmin`: overview, beta requests (approve/decline), users (pro/admin
  toggles), broadcasts, admin action log.
- `/fun` — hidden mini-games (word guess, scramble, sequence, stats), reached only via the
  daily line in the header.
- Task sharing: send a task to a friend (`task_shares`), accepted shares appear in their list.
- Task colours: `tasks.color` (8 names, `src/features/tasks/taskColors.js`); rows and chips set
  `data-task-color`, the tones live in `index.css` as `--task-color` per theme.

Client-side storage: only `localStorage` (no cookies): `token` (JWT), `language`, `accent`,
`theme`, `motion`, `homeLayout`, `calendarView`, `teamSessionId`. `public/theme-init.js` applies
the theme before React loads.

## API access

`src/features/helperFunction.js`: `apiUrl(path)` prefixes `VITE_API_URL` (empty in dev);
`apiFetch` adds `Authorization: Bearer <token>` and turns error JSON `{error, code}` into an
`Error` with `status`/`code`. In dev, Vite (port 5173, `strictPort`) proxies `/api` and
`/socket.io` to `http://localhost:3000`.

## Backend (`../quidey_react-backend`)

- Node + Express 5, CommonJS, one big `index.js` (~3100 lines, all `/api/...` routes),
  `realtime.js` (Socket.IO server), `db.js` (pg pool), `utils/mailer.js` (nodemailer),
  `utils/verificationToken.js`.
- PostgreSQL 18 locally (`quidey_db`). Schema in `schema.sql` (regenerated from pg_dump, see
  memory), incremental `migrations/001…016` (015: performance indexes, 016: task colour +
  reminder mails). Tables: users, tasks, groups, task_groups, notes,
  sessions, session_tasks, session_shared_tasks, friendships, task_shares, shared_sessions,
  shared_session_members / _tasks / _events / _time, messages, notifications, broadcasts,
  beta_access_requests, admin_actions, email_verification_tokens.
- Auth: bcrypt passwords, JWT with `token_version` (revocable: password change / sign out
  everywhere bumps it), email verification required, terms acceptance stored,
  express-rate-limit on auth routes. `is_pro` gates all app routes; `is_admin` the admin routes;
  `is_owner` (migration 014) can only be set by a DB superuser and forces admin on.
  The account row behind each request is cached for 15 s (`loadAccount`); every in-app change
  of token version / pro / admin / account calls `forgetAccount`, so only CLI/psql changes wait.
- Socket.IO: authenticates with the same JWT; rooms `user:<id>` and `session:<id>`; events
  `message:new`, `inbox:read`, `notification:new`, `session:event` (chat, with data) and the
  data-less "load again" signals `session:changed`, `invites:changed`, `friends:changed`,
  `tasks:changed`. Plain time reports (`/activity` every 30 s, online window 75 s) send nothing unless what the
  others see changed (started / stopped / switched task).
- Mail via SMTP (Resend, `smtp.resend.com`): verification links, task reminders, contact form and
  feedback to `CONTACT_TO`. Without `SMTP_HOST` mails are only logged. All mails share one HTML
  layout (`utils/mailTemplate.js`: tables + inline styles; user text always through `escapeHtml`).
- Reminder mails: `utils/reminderMails.js` checks every minute (`REMINDER_CHECK_MS`) for open tasks
  with `reminder_email`, computes the start in `users.timezone` (sent by the app via
  `PUT /api/users/locale`, default Europe/Berlin) and mails the owner once per reminder time
  (`reminder_mailed_at`). Only the owner can switch it on.
- CLI: `npm run pro -- list|requests|grant|revoke|decline|admin|unadmin <username>`.
- Tests: `npm test` (`test/api.test.mjs`, node:test, creates/drops its own DB). Extend for every new route.
- Config via `.env` (see `.env.example`): `NODE_ENV`, `DB_*`, `JWT_SECRET` (≥32 chars), `PORT`,
  `CORS_ORIGINS`, `TRUST_PROXY`, `SMTP_*`, `MAIL_FROM`, `CONTACT_TO`, `FRONTEND_URL`.

## Deployment

**Frontend → Cloudflare Workers (static assets)**, configured in `wrangler.jsonc`: worker
`quideyreactmain`, serves `./dist`, SPA fallback (`not_found_handling: single-page-application`),
custom domain `quidey.com`. There is no deploy script in package.json; deploy is
`npm run build` then wrangler (`npx wrangler deploy`).
- The production API address comes from `.env.production.local` (`VITE_API_URL=https://…`,
  git-ignored, ends up public in the bundle — never a secret).
- `security-headers.js` is a Vite plugin that writes `dist/_headers` at build time: strict CSP
  (`script/style/font-src 'self'`, `connect-src` = self + the API origin + its `wss:`), HSTS,
  X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy, COOP, and a one-year immutable
  `Cache-Control` for the hashed files under `/assets/*`. Hence: no inline scripts or
  styles from external hosts, no CDN fonts; the build must use the real API URL or calls get blocked.

**Backend → STRATO server** (named as backend host in the privacy policy), planned setup per
`../quidey_react-backend/DEPLOYMENT-SECURITY.md`: Node as a non-root user under systemd/pm2,
listening on localhost behind Caddy/nginx with HTTPS (e.g. `api.quidey.com`), `TRUST_PROXY`
matching the proxy count (1, or 2 with Cloudflare in front), Postgres only on localhost with the
limited role `quidey_app` (`scripts/db-app-role.sql`), migrations run as `postgres`, regular
`pg_dump` backups, `CORS_ORIGINS=https://quidey.com`.

## Legal / GDPR

German law applies: Impressum (§ 5 DDG), Datenschutzerklärung (DSGVO), Nutzungsbedingungen,
contact form — all in `src/legal/LegalPage.jsx`, owner details and processors (Cloudflare,
STRATO, Resend) in `src/legal/owner.js`. Any feature touching personal data must update these
texts in the same change.

## Repo extras

`.claude/skills/`, `.agents/skills/`, `.taste-skill/` (design-review reports), `direction/`
(dark-theme design direction screens) are design tooling, not app code.
