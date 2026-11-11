# Lernen as school life: subjects, grades, Untis (design)

Branch `pro-features` (web + backend + android untouched). Date 2026-11-11.

## Goal
Lernen is structured like school: all subjects, in each the work to do, and once a piece of work is
finished a written grade can be entered. Each subject gets an exam grade and a grade for all other
work. With Untis linked, subjects, exams and homework arrive by themselves.

## Decisions (agreed)
- Grade scale per account: `points` (0-15) or `marks` (1-6, 1 best). Picked once (Settings -> Lernen).
- Averages: plain mean of the graded work. Two numbers per subject: **Klausuren** (kind `exam`) and
  **Sonstige** (assignment, presentation, other). No weights, no combined grade.
- Homework from Untis becomes a **suggestion** the user confirms, not a task by itself.
- With AI access (Pro) the suggestion carries an estimated working time; without it, none/default.
- Grades never go to the AI.

## Data (backend migration 051)
- `goals.grade numeric(4,2) NULL` (stored as points 0-15; marks converted: points = round(17 - 3*mark, 2)
  is NOT used - see conversion below), `goals.graded_at timestamptz NULL`.
- `users.grade_scale text NOT NULL DEFAULT 'points' CHECK IN ('points','marks')`.
- `subjects.untis_name text NULL` (the Untis subject long name; unique per user with the subject; a subject
  made by Untis is `untis_name` set, matched later by lower(name) = lower(untis_name) before creating one).
- `untis_exams` (user_id, untis_id, goal_id, created_at, unique(user_id, untis_id)): remembers which Untis
  exam became which goal (never again after the user deletes the goal).
- `untis_homework_suggestions` (id, user_id, untis_homework_id unique per user, subject_id, text, remark,
  due date, due_time, estimate_minutes NULL, estimate_source NULL, state `open|taken|dismissed`).
  Replaces the automatic `untis_homework_tasks` behaviour (the table stays for rows already made).
- Conversion: the grade is stored in **points** so averages are one mean. marks -> points with the German
  table (1 = 15..13 ... use mark m -> points = 15 - (m-1)*3 clamped, 1+ not modelled); shown back by the
  inverse, rounded to 0.1 (marks) / 0.1 (points).

## API (behind requirePro, `/api/tester/study`)
- `PATCH /goals/:id { grade }` (null clears; only for a goal with status `done`; 0-15 points or 1-6 marks as
  sent with `scale`), `GET /subjects` also answers `exam { avg, n }`, `other { avg, n }` per subject.
- `PUT /settings { gradeScale }`.
- `GET /untis/suggestions`, `POST /untis/suggestions/:id/take { minutes? }` (makes the task through the usual
  task creation), `POST .../dismiss`.
- Untis `sync()` (login mode): create subjects (colour = first of the eight not in use, then the saved
  palette cycles), create exam goals from Untis exams not yet in `untis_exams`, create homework suggestions;
  with `QUOTA`-free AI access (`ANTHROPIC_API_KEY` set and the user Pro/tester) estimate each suggestion's
  minutes through `utils/ai.js` (homework text + subject + days until due only), failing quietly to null.

## Frontend
- Lernen opens on the subject list: colour, open work count, **Klausuren** and **Sonstige** averages.
- Subject page: open work first, finished work below with its grade; finishing a goal offers
  "Note eintragen" (skippable); a graded row can be edited.
- Settings -> Lernen: grade scale; Untis setting "Hausaufgaben vorschlagen" replaces "als Aufgaben anlegen".
- Suggestions card on Lernen and the subject page: "Als Aufgabe übernehmen" (minutes field prefilled with
  the estimate, marked "KI-Schätzung" when AI), "Verwerfen".
- Texts de/en, a feature tip for the grades and the suggestions, privacy § 5 line on grades and the
  homework estimate, CLAUDE.md, tests for every route and screen.

## Risks
- WebUntis exam data (`exams` REST endpoint) known from the open-source client; only the fake server tests it.
- Homework suggestions replace automatic tasks: existing `homework_to_tasks` rows are migrated to the
  new switch (on = suggest).

## Order of work
1. Migration 051 + grade API + averages (tests). 2. Lernen UI (list, subject page, grade entry, scale).
3. Untis sync: subjects + colours, exams (fake server). 4. Suggestions (API, UI, AI estimate). 5. Docs,
   privacy, tips.
