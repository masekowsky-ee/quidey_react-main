# Assistant in the study area: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Max assistant can read and change everything in Lernen (subjects, goals, topics, grades, study settings), also in existing subjects and goals, with the same confirm/undo rules as for tasks.

**Architecture:** Three read tools run on the server; `study_create`, `study_update`, `study_delete`, `study_replan` are proposal tools that end the loop and come back as actions (like `create_entry`). The server validates them and checks ownership; the app applies them through the existing thunks in `features/study/study.js`.

**Tech Stack:** Backend: Node, Express, pg, `node --test` (`quidey_react-backend`, branch `main`). Frontend: React, Redux, vitest (`quidey_react-main`, branch `master`).

**Spec:** `docs/superpowers/specs/2026-11-22-assistant-study-area-design.md` (this repo). Existing code: `quidey_react-backend/utils/assistant.js`, `quidey_react-backend/study.js`, `src/features/assistant/applyAction.js`, `src/components/assistant/AssistantSheet.jsx`.

## Global Constraints

- Write tools never write on the server; reads only on the user's own rows.
- New things apply at once with Undo; changes and deletions need the confirm card; re-plan only opens the preview.
- Ids come only from tool results; every id (subject, goal, part, and `subjectId`/`goalId` inside creates and updates) is checked to belong to the user before an action leaves the server; a bad one is dropped and counted (`text.dropped`).
- Cards for changes and deletions show the app's OWN copy of the thing, never the model's `summary`.
- Per-message bounds unchanged: `CALLS_MAX` 6, `LOOKUPS_MAX` 3 per turn, 60 000 input tokens, 60 s.
- Ranges as in `study.js`: name ≤ 200 (subject ≤ 60), estimate 15–1200 min, `sessionMinutes` 15–180, `dailyMaxMinutes` 15–720, kinds `exam|assignment|presentation|other`, goal status `active|done|archived`, colors `red orange yellow green teal blue violet pink`.
- Max-only: the route's existing access check stays; no new route.
- German and English texts in `src/i18n/de/base.js` and `src/i18n/en/base.js`, same keys in both.

## Action contract (both sides rely on this)

Fields not given are omitted (never `null`) in an action; `changes` holds only what changes.

```
{ type:'study_create', target:'subject', name, emoji?, color? }
{ type:'study_create', target:'goal', subjectId? | subjectName?, name, kind, due, dueTime?, parts:[{ name, estimateMinutes }] }
{ type:'study_create', target:'part', goalId, name, estimateMinutes }
{ type:'study_update', target:'subject', id, changes:{ name?, emoji?, color?, archived? } }
{ type:'study_update', target:'goal', id, changes:{ name?, kind?, due?, dueTime?, subjectId?, studyFrom?, studyTo?, status?, grade? } }
{ type:'study_update', target:'part', id, changes:{ name?, estimateMinutes?, done? } }
{ type:'study_update', target:'settings', changes:{ sessionMinutes?, dailyMaxMinutes?, windows?, gradeScale? } }
{ type:'study_delete', target:'subject'|'goal'|'part', id }
{ type:'study_replan' }
```

`windows` is `[{ weekday:1-7, start:'HH:MM', end:'HH:MM' }]`, `grade` a number in the user's scale, `done` a boolean. A goal create has exactly one of `subjectId` / `subjectName`; with `subjectName` the app makes the subject first (or reuses an unarchived one of that name).

## Review Focus

- A goal created with a due date in the past: the route answers `due_in_past`; the card says so and stays retryable (Task 4).
- A subject whose name exists: route answers `subject_exists`; the card shows an error, nothing is duplicated (Task 4).
- Free-plan limit on subjects or goals: the route refuses; the card shows the refusal, no crash (Task 4).
- Delete of a goal with planned sessions: the card asks keep or remove before deleting (Task 4).
- Ids of another user's goal or part, or an id of the wrong kind (a goal id given as `target:'part'`): dropped, message says something couldn't be done (Task 2).
- Two updates to the same id in one turn: merged into one card; a delete wins over updates (Task 3).
- A goal that is only a date (`parts: []`): `planMode 'none'` and no parts; a goal with topics but zero estimates is invalid (Task 2).

---

## Backend (repo `quidey_react-backend`, branch `main`)

### Task 1: Read tools

**Files:**
- Create: `utils/assistantStudy.js`
- Modify: `utils/assistant.js` (`toolList`, `READ_TOOLS`, `readTool`, the header comment)
- Test: `scripts/test/assistant-study.test.mjs` (same harness as `scripts/test/assistant.test.mjs`: scripted fake model, throwaway DB; copy its setup, do not import it)

**Interfaces:**
- Produces in `utils/assistantStudy.js`: `readStudy(name, input, { db, userId }) → Promise<object | { error }>` for `"study_overview" | "study_goal" | "study_settings"`, `STUDY_READ_TOOLS: string[]`, `studyReadTools(tool): Tool[]` (builds the three tool definitions with the `tool` helper from `assistant.js`).
- `study_overview` result: `{ subjects: [{ id, name, emoji, archived, examAverage, otherAverage, goals: [{ id, name, kind, due, dueTime, planMode, partCount, partsDone }] }], more? }` (active goals only, at most 30 subjects and 8 goals per subject, `more: true` when cut). Averages in the user's grade scale, `null` when none.
- `study_goal({ id })` result: `{ id, subjectId, name, kind, due, dueTime, status, grade, studyFrom, studyTo, parts: [{ id, name, estimateMinutes, done, role, position }] }`, or `{ error: "no such goal" }` for an id that isn't the user's.
- `study_settings()` result: `{ sessionMinutes, dailyMaxMinutes, windows, gradeScale }`.

- [ ] **Step 1: Write failing tests** in `assistant-study.test.mjs`: (a) `study_overview` returns the user's subject with its active goal and part counts, and not another user's subject; (b) `study_goal` for an own goal lists parts with `done`, for another user's goal returns an error tool result (the model gets `is_error`); (c) `study_settings` returns the stored values; (d) with 40 subjects the overview has 30 and `more: true`.
- [ ] **Step 2: Run** `node --test scripts/test/assistant-study.test.mjs`. Expected: FAIL (tools unknown).
- [ ] **Step 3: Implement** `readStudy` with direct SQL on `subjects`, `goals`, `goal_parts`, `study_windows` and the user's settings columns (`study_session_minutes`, `study_daily_max_minutes`, `grade_scale`); reuse `fromPoints`/`average` from `utils/grades.js` for grades as `GET /subjects` does. Register the three tools in `toolList()`, add their names to `READ_TOOLS`, and call `readStudy` from `readTool` for them.
- [ ] **Step 4: Run** the new test and `scripts/test/assistant.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(assistant): read tools for the study area`.

### Task 2: Study proposal tools, validation, ownership

**Files:**
- Modify: `utils/assistantStudy.js`, `utils/assistant.js` (`toolList`, `WRITE_TOOLS`, `proposal`, `proposals`, `listOf`, `systemPrompt`, header comment)
- Test: `scripts/test/assistant-study.test.mjs`

**Interfaces:**
- Consumes: Task 1's module and the action contract above.
- Produces: `studyProposalTools(tool): Tool[]` (`study_create`, `study_update`, `study_delete`, `study_replan`; strict schemas, all fields present, optional ones `nullable`), `studyProposal(name, input, { check }) → action | null` (shape and range validation as the routes do; null fields dropped), and `async function ownedStudyIds(actions, { db, userId }) → Set<string>` returning keys like `subject:3`, `goal:7`, `part:12` that the user owns; `proposals()` keeps an action only when every id it carries (`id` by its `target`, plus `subjectId`, `goalId`) is in the set.

- [ ] **Step 1: Write failing tests**: (a) a `study_create` goal with `subjectId` of the user's subject and two parts comes back as one action matching the contract, with `null`s removed; (b) a goal create with `parts: []` is valid (date only), with a topic missing `estimateMinutes` or below 15 it is dropped; (c) a `study_update` part with `done: true` for an own part comes back; for another user's part it is dropped and the message mentions that something couldn't be done; (d) a goal id passed with `target:'part'` is dropped; (e) `study_update` settings with `sessionMinutes: 5` is dropped, with `60` kept; (f) `study_create` goal with both or neither of `subjectId`/`subjectName` is dropped; (g) `study_delete` of an own subject comes back; (h) `study_replan` comes back as `{ type:'study_replan' }`; (i) a message with an empty `changes` is dropped.
- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement** the tool definitions and validators in `assistantStudy.js` (limits from Global Constraints; `due`/`studyFrom`/`studyTo` through `check.validDate`, `dueTime` through `check.validTime`; color against the eight names; `windows` max 50 entries with `start < end`), add the four names to `WRITE_TOOLS`, route them in `proposal()` to `studyProposal`, and extend `proposals()` with the ownership check (one query per kind, only for ids present). `listOf` falls back to the action's `name`.
- [ ] **Step 4: Prompt**: add to `systemPrompt` a paragraph: Lernen has subjects, goals and topics; look them up with `study_overview`, `study_goal`, `study_settings` before changing anything; never guess an id; `study_create` is applied at once, `study_update`/`study_delete`/`study_replan` are confirmed or previewed by the user; ask with `ask_user` when a name matches more than one subject or goal. Add a test that the prompt names the four tools.
- [ ] **Step 5: Run** both assistant test files. Expected: PASS.
- [ ] **Step 6: Commit** `feat(assistant): propose study changes (create, update, delete, replan)`.

---

## Frontend (repo `quidey_react-main`, branch `master`)

### Task 3: Prepare and apply study actions

**Files:**
- Modify: `src/features/assistant/applyAction.js`
- Create: `src/features/assistant/studyActions.js` (applying and describing study actions, so `applyAction.js` stays small; it is imported by `applyAction.js`)
- Test: `src/__tests__/assistantStudy.test.jsx`

**Interfaces:**
- Consumes: the action contract; thunks `saveSubject`, `deleteSubject`, `createGoal`, `updateGoal`, `deleteGoal`, `addPart`, `updatePart`, `deletePart`, `saveStudySettings`, `fetchSubjects`, `fetchGoal`, `fetchPlanPreview` from `features/study/study.js`.
- Produces in `studyActions.js`:
  - `loadStudyContext(actions, dispatch) → Promise<void>`: fetches subjects and each referenced goal (`fetchSubjects`, `fetchGoal`) so the store has the app's own copy.
  - `describeStudy(action, study) → { kind: 'create'|'update'|'delete'|'replan', title: string, rows: [{ field, from, to }], sessions?: number } | null`; `null` when the thing isn't in `study` (store slice `state.study`).
  - `applyStudyAction(action, { dispatch, getState, navigate, sessions? }) → Promise<{ undo?, cancelled? }>`: create returns `undo` (delete again); update/delete run only after confirm; goal/subject delete passes `sessions: 'keep' | 'delete'`; `study_replan` calls `fetchPlanPreview()` then `navigate('/study?replan=1')` (use the route the existing "re-plan" button opens; find it in `src/components/study`).
- `prepareActions(actions, tasks, study)` in `applyAction.js` gets a third argument and returns study cards `{ type, action, study: describeStudy(...) }`; unknown id counts in `missing`; two updates on the same `target:id` merge, a delete wins over updates of the same id.

- [ ] **Step 1: Write failing tests** (mock `apiFetch` like `assistant.test.jsx`): (a) create subject calls `POST /api/study/subjects`, undo calls `DELETE`; (b) create goal with `subjectName` of an existing unarchived subject reuses its id, with a new name creates the subject first, then the goal with `planMode` `'none'` when `parts` is empty and the goal sheet's default mode otherwise (find it in `GoalSheet.jsx`); (c) create part calls `POST /goals/:id/parts`; (d) update goal `status:'done', grade: 2` is one `PATCH /goals/:id` with both fields; (e) update part `done:true` sends `doneAt` truthy, `done:false` sends `doneAt: null`; (f) delete goal passes the chosen `sessions` mode; (g) settings update is one `PUT /settings`; (h) `prepareActions` merges two part updates, drops an unknown goal id into `missing`, lets a delete win.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/assistantStudy.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions; `describeStudy` builds `rows` from the stored copy and the changes (names as shown in the study UI, grade in the user's scale), `sessions` from the goal's planned-session count in the store when available. In `applyAction()` add the cases for the four types delegating to `applyStudyAction`.
- [ ] **Step 4: Run** the new file and `assistant.test.jsx`. Expected: PASS; also `npm run lint`.
- [ ] **Step 5: Commit** `feat(assistant): apply study actions through the study thunks`.

### Task 4: Cards, texts and the sheet

**Files:**
- Modify: `src/components/assistant/AssistantSheet.jsx` (call `loadStudyContext` before `prepareActions`; render study cards), `src/components/assistant/AssistantSheet.module.css` (only if the existing card classes don't fit), `src/i18n/de/base.js`, `src/i18n/en/base.js`
- Test: `src/__tests__/assistantStudy.test.jsx`

**Interfaces:**
- Consumes: Task 3. Card contract: create cards behave like `create_entry` (done at once, Undo button, status line); update/delete cards behave like the task cards (Confirm/Cancel); delete of a goal or subject with `sessions > 0` shows two buttons, "Keep sessions" and "Remove sessions", each confirming with that mode; `study_replan` card has one button like `study_plan` ("Plan ansehen"/"Open plan") and calls `applyStudyAction` then closes the sheet.
- Produces: i18n keys with prefix `assistantStudy` (title per target, `assistantStudyKeep`, `assistantStudyRemove`, status lines for done/undone), identical key sets in `de` and `en`.

- [ ] **Step 1: Write failing tests** in `assistantStudy.test.jsx` (render like `assistant.test.jsx`): (a) a reply with `study_create` part applies at once and shows Undo; clicking Undo calls the delete; (b) `study_update` goal due date shows from → to from the store copy and applies only after "Bestätigen"; (c) `study_delete` goal with 3 planned sessions shows both buttons and sends `?sessions=delete` for the second; (d) route errors show on the card and the card can be retried: `due_in_past`, `subject_exists`, and a free-plan limit error; (e) `study_replan` opens the preview route; (f) unknown goal id yields the existing "couldn't find" line.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** the card branch(es) in `ActionCard` (extract a `StudyCard` component in a new file `src/components/assistant/StudyCard.jsx` if `AssistantSheet.jsx` grows by more than about 80 lines), the i18n keys, and the `loadStudyContext` call. Error text on the card: the server's message, as for tasks.
- [ ] **Step 4: Run** `npx vitest run` (whole suite), `npm run lint`, `npm run build`. Expected: all green (1385+ tests before this work).
- [ ] **Step 5: Commit** `feat(assistant): study cards in the chat`.

### Task 5: Android sync and a real check

**Files:** none new.

- [ ] **Step 1:** In `quidey_android`, `git pull web master` (as after the untangle), run its lint and tests. Expected: green.
- [ ] **Step 2:** With the dev server and a Max test account, say in the chat: "Füge Kapitel 4 zu meiner Mathe-Klausur hinzu" and "Ich habe in Bio eine 2 bekommen"; confirm each card works and Undo works on the first. Report what was seen; if no Max account or phone is available, say it was not checked.
- [ ] **Step 3:** Update the launch checklist at the end of `docs/Implementation-Plan.md` (in `~/Quidey/docs`) with: backend `main` and frontend `master` pushed, no new migration.
