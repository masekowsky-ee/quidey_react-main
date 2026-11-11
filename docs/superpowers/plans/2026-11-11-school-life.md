# Lernen as school life: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lernen shows subjects with their open work and graded finished work, two plain-average grades per subject, and Untis fills in subjects, exams and homework suggestions.

**Architecture:** Grades hang on existing `goals` (stored as points 0-15). The backend (`api-pro`, branch `pro-features`) gets migration 051, grade/average/suggestion routes in `study.js` and `untis.js`; the web app (`web-pro`) gets the UI. Untis sync creates subjects, exam goals and homework suggestions; AI only estimates minutes.

**Tech Stack:** Express 5 + pg + node:test (backend, `npm test`); React 19 + Redux + CSS Modules + Vitest (web, `npx vitest run src`, `npx eslint src`).

**Spec:** `docs/superpowers/specs/2026-11-11-school-life-design.md`

## Global Constraints

- Grades are stored as **points 0-15** (`numeric(4,2)`); marks convert by points = 17 - 3 * mark, clamped 0-15; shown back as mark = (17 - points) / 3, rounded to 0.1.
- Averages are plain means; two numbers per subject: **Klausuren** (kind `exam`) and **Sonstige** (assignment, presentation, other). No weights, no combined grade.
- A grade is allowed only on a goal with status `done`; grades are never sent to the AI.
- Untis: only login mode, only `*.webuntis.com` over https; the AI estimate sees only homework text, subject name and days until due.
- Migration numbers: this is 051 (main has 046/047, mine 048-050). Add every table to `schema.sql` at the end; run on the real server with `sudo quidey-migrate`.
- Every new text de + en (`src/i18n/studyTexts.js`, `flowTexts.js`); every new feature gets a tip in `src/features/tips/tips.js` + `tip_<id>_title/_text`; privacy text in `src/legal/LegalPage.jsx` § 5; CLAUDE.md updated; commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Backend tests pin the quota env (`QUOTA_SCAN`, `QUOTA_AI_LINE`) and use `AI_FAKE`; never real AI calls.

## Review Focus

- A grade on a goal that is not done: refused (400 `GOAL_NOT_DONE`).
- Out-of-range grade (points 16, mark 0 or 7, non-number): refused (400 `BAD_GRADE`).
- A subject with no graded work: average `null` (shown as an en dash), never `NaN` or 0.
- Untis sync run twice: no duplicate subjects, exams or suggestions; a goal or suggestion the user deleted does not come back.
- An Untis subject whose name matches an existing subject (any case): reused, not duplicated.
- AI failure or no key: suggestion made with `estimate_minutes` null, sync still succeeds.

---

### Task 1: Migration 051 and grade data model (backend)

**Files:**
- Create: `migrations/051_school_life.sql`
- Modify: `schema.sql` (051 block at the end)
- Test: `scripts/test/api.test.mjs`

**Interfaces:**
- Produces: columns `goals.grade numeric(4,2)`, `goals.graded_at timestamptz`, `users.grade_scale text` (`points|marks`, default `points`), `subjects.untis_name text`; tables `untis_exams(user_id, untis_id, goal_id null, created_at, unique(user_id, untis_id))` and `untis_homework_suggestions(id, user_id, untis_homework_id, subject_id, text, remark, due, due_time, estimate_minutes, estimate_source, state, unique(user_id, untis_homework_id))`, `state` check `open|taken|dismissed`, `estimate_source` check `ai|default`.

- [ ] **Step 1:** Write migration with `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`, CHECKs `grade BETWEEN 0 AND 15`, copy the 051 block into `schema.sql` after the Untis tables.
- [ ] **Step 2:** Apply to dev DB `quidey_db` (`psql`, add the `schema_migrations` row like 048-050); run `npm test`.
- [ ] **Step 3:** Commit `feat(db): migration 051 for grades and Untis school data`.

### Task 2: Grade routes and averages (backend)

**Files:**
- Create: `utils/grades.js` (`toPoints(value, scale)`, `fromPoints(points, scale)`, `average(points[])`)
- Modify: `study.js` (`PATCH /goals/:id`, `GET /subjects`, `PUT /settings`, `GET /settings`)
- Test: `scripts/test/grades.test.mjs`, `scripts/test/api.test.mjs`

**Interfaces:**
- Produces: `toPoints(value: number, scale: 'points'|'marks'): number | null` (null when out of range), `fromPoints(points: number, scale): number` (rounded to 0.1), `average(points: number[]): number | null`; `PATCH /goals/:id { grade: number|null }` interpreted in the user's `grade_scale`; `GET /subjects` items gain `exam: { avg, n }`, `other: { avg, n }` (avg in the user's scale, null when n is 0); `GET|PUT /settings` carry `gradeScale`; goal objects carry `grade` (in the user's scale) and `gradedAt`.

- [ ] **Step 1:** Unit tests: `toPoints(1,'marks') === 14`, `toPoints(6,'marks') === 0`, `toPoints(7,'marks') === null`, `toPoints(16,'points') === null`, `fromPoints(11,'marks') === 2`, `average([]) === null`, `average([10,12]) === 11`.
- [ ] **Step 2:** API tests: grade on an active goal -> 400 `GOAL_NOT_DONE`; on a done goal 200 and `GET /subjects` shows exam avg; kinds split (exam vs assignment); clearing with `null`; switching `gradeScale` to marks re-expresses the same stored points; no graded work -> `avg: null`.
- [ ] **Step 3:** Run the tests, see them fail. Implement `utils/grades.js` and the routes (averages by one grouped SQL over `goals` joined to `subjects`).
- [ ] **Step 4:** `npm test` passes; commit `feat(study): grades and per-subject averages`.

### Task 3: Untis subjects and exams in sync (backend)

**Files:**
- Modify: `utils/untis.js` (add `fetchExams(creds, fromIso, toIso)`), `untis.js` (`sync()`), `scripts/test/fakeUntis.mjs`
- Test: `scripts/test/api.test.mjs`

**Interfaces:**
- Consumes: `subjects` table, `goals`, `untis_exams` from Task 1.
- Produces: `fetchExams(...) -> [{ id, subject, subjectLong, date, startTime }]`; after a login-mode sync every Untis subject (long name from the lessons, else short) exists as a `subjects` row with `untis_name` set and a colour (first of the eight not in use, else cycling in order); each Untis exam without an `untis_exams` row becomes an `exam` goal named `<subjectLong>: Klausur` (`plan_mode` `days`, status `active`) and gets an `untis_exams` row; an exam the user already entered (same subject, same due date, kind `exam`) is linked to its row instead of duplicated.

- [ ] **Step 1:** Extend the fake server with an exams endpoint (one exam tomorrow for subject D); tests: first sync creates subjects M, E, D with distinct colours and one exam goal; second sync adds nothing; a goal deleted by the user is not re-created; a pre-existing subject "mathematik" (lowercase) is reused; a manually entered exam on the same day is not duplicated.
- [ ] **Step 2:** Run, fail. Implement `fetchExams` (REST `exams` like the open-source client; failures logged, sync continues) and the sync step inside `untis.js`.
- [ ] **Step 3:** `npm test`; commit `feat(untis): subjects and exams from the timetable`.

### Task 4: Homework suggestions with AI estimate (backend)

**Files:**
- Modify: `untis.js` (replace `homeworkToTasks` use: write suggestions), `utils/ai.js` (job `homeworkMinutes`), `scripts/test/api.test.mjs`
- Test: `scripts/test/api.test.mjs`

**Interfaces:**
- Produces: sync inserts an `open` row in `untis_homework_suggestions` per not-completed, not-past homework (once per `untis_homework_id`, never again once `taken` or `dismissed`); `GET /api/untis/suggestions -> [{ id, subjectId, subjectName, text, remark, due, dueTime, estimateMinutes, estimateSource }]`; `POST /api/untis/suggestions/:id/take { minutes?: number }` creates the task through the same insert as before (name `<Fach>: Hausaufgabe`, description text+remark, `duration_minutes` = minutes) and sets `taken`; `POST .../:id/dismiss`; `utils/ai.js` `estimateHomeworkMinutes({ text, subject, daysUntilDue }) -> number | null` (15-240, `AI_FAKE` answer in tests, null without key or on failure). The estimate runs during sync only when the account may use AI (Pro or tester or admin and a key); `homework_to_tasks` now means "suggest".

- [ ] **Step 1:** Tests: sync creates one suggestion (hw 501), none for the completed 502; second sync no duplicate; `take` creates a task with the minutes and the suggestion is `taken`; `dismiss` then resync: stays dismissed; with `AI_FAKE` the suggestion has `estimateSource: 'ai'`; with the fake failing ("AI_FAIL" text) the suggestion exists with null minutes and sync returns 200; the switch off creates no suggestions.
- [ ] **Step 2:** Run, fail. Implement; keep old `untis_homework_tasks` rows untouched.
- [ ] **Step 3:** `npm test`; commit `feat(untis): homework becomes suggestions with an AI time estimate`.

### Task 5: Grade entry and subject screens (web)

**Files:**
- Create: `src/features/study/grades.js` (same conversion helpers as the backend: `toPoints`, `fromPoints`, `formatGrade(value, scale)`), `src/components/study/GradeSheet.jsx`
- Modify: `src/features/study/study.js` (thunks `saveGrade(goalId, grade)`, `saveGradeScale(scale)`), `src/components/study/SubjectList.jsx`, `SubjectView.jsx`, `GoalView.jsx`, `StudySettings.jsx`, `src/i18n/studyTexts.js`
- Test: `src/__tests__/studyGrades.test.jsx`

**Interfaces:**
- Consumes: Task 2's API (`grade`, `exam`, `other`, `gradeScale`).
- Produces: subject list rows show colour, open count, "Klausuren Ø" and "Sonstige Ø" (en dash for null); subject page lists open work then finished work with its grade; ticking a goal done opens `GradeSheet` ("Note eintragen", skippable); finished rows open it again to edit or clear; Settings → Lernen has a points/marks switch.

- [ ] **Step 1:** Tests: averages render in the chosen scale (marks `2,3`, points `11,0`) and "–" without grades; finishing a goal offers the sheet and "Überspringen" saves nothing; saving sends the typed value; invalid value shows an error and sends nothing; the scale switch calls `PUT /settings` and re-renders.
- [ ] **Step 2:** Run, fail. Implement.
- [ ] **Step 3:** vitest + eslint clean; commit `feat(study): grades and averages in Lernen`.

### Task 6: Suggestions UI and Untis settings (web)

**Files:**
- Create: `src/components/study/HomeworkSuggestions.jsx`
- Modify: `src/features/untis/untis.js` (`fetchSuggestions`, `takeSuggestion(id, minutes)`, `dismissSuggestion(id)`), `src/components/untis/UntisSettings.jsx` (switch text "Hausaufgaben vorschlagen"), `SubjectList.jsx` / `SubjectView.jsx` (mount the card), `src/i18n/flowTexts.js`, `src/features/tips/tips.js`
- Test: `src/__tests__/homeworkSuggestions.test.jsx`, `src/__tests__/untis.test.jsx`

**Interfaces:**
- Consumes: Task 4's suggestion routes.
- Produces: a card on Lernen and on the subject's page listing suggestions: text, due, minutes field prefilled with the estimate and labelled "KI-Schätzung" when `estimateSource === 'ai'`, buttons "Als Aufgabe übernehmen" (`take`) and "Verwerfen" (`dismiss`); empty list renders nothing; tips `grades` and `homeworkSuggestions`.

- [ ] **Step 1:** Tests: card shows an estimate with the AI label; taking sends the edited minutes; dismissing removes the row; no suggestions renders nothing; the Untis switch label is "Hausaufgaben vorschlagen".
- [ ] **Step 2:** Run, fail. Implement; update the existing homework-switch test text.
- [ ] **Step 3:** vitest + eslint clean; commit `feat(study): homework suggestions in Lernen`.

### Task 7: Docs, privacy, verification

**Files:**
- Modify: `src/legal/LegalPage.jsx` (§ 5 grades + homework estimate), `CLAUDE.md` (Lernen school life, migration 051, routes, tips)

- [ ] **Step 1:** Privacy line: grades are stored on the account, never sent to the AI; homework text, subject and due date go to Anthropic only for a time estimate with AI access.
- [ ] **Step 2:** CLAUDE.md sections for the data model, routes, UI and "run migration 051 on the real server".
- [ ] **Step 3:** `npx vitest run src`, `npx eslint src`, backend `npm test` all green; screenshot check of Lernen against the scratch stack (fake Untis) in light and dark, phone and desktop.
- [ ] **Step 4:** Commit `docs: Lernen as school life`.
