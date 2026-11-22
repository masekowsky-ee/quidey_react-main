# Assistant in the study area: everything a user can do

Date: 2026-11-22. Builds on `2026-11-15-max-plan-ai-assistant-design.md` (the Max assistant, Haiku 5.5, tool loop, write tools only propose, the app applies them through its usual routes). Size: a project, but one feature in two places (backend `utils/assistant.js`, frontend `features/assistant`).

## Intent

A student should be able to tell the assistant anything they could do by hand in Lernen, also in subjects and goals that already exist: "add chapter 4 to my maths test", "move the history essay to Friday", "I got a 2 in biology", "no studying after 20:00".

Today the assistant knows only tasks and events. In Lernen it has exactly one tool, `study_plan`, which opens the "new goal" sheet with a draft. It can't see subjects, goals, topics or grades, and it can't add to an existing goal.

## Goals

- It can read the whole study area: subjects (with their next goal and grade averages), goals with their topics (parts), study settings.
- It can do what the UI does: create, change and delete subjects, goals and topics; mark topics done; mark a goal done and give a grade; change study settings (session length, daily maximum, study times, grade scale).
- Same safety rule as the rest of the assistant: nothing changes unseen.
  - New things apply at once and show an Undo button.
  - Changes and deletions show a card first and apply only after the user confirms (a goal or subject delete also says how many planned sessions go with it).
  - "Re-plan" never applies by itself; it opens the existing preview.
- The server re-checks every proposal; an id that isn't the user's own is dropped (as now).

## Non-goals and anti-goals

- No direct writes by the server. A "server writes, user sees afterwards" shortcut is out because it breaks the rule above.
- No new screens. Cards in the chat only.
- Nothing that isn't in the UI today (no bulk import, no new grade logic).
- Not a failure if: the assistant silently changes the plan, or the tool list grows so long that the model gets worse at the old tools.

## Approaches considered

1. One tool per action, about 15 new tools. Exact, but a long tool list costs tokens on every message and makes the model less accurate. Rejected.
2. **Few typed tools (chosen).** Three read tools and three write tools; a `target` field says what is meant. Short list, one shared card, strict validation stays.
3. Server writes directly. Simplest, but invisible changes. Rejected.

## Design

### Read tools (run on the server, on the user's own rows)

- `study_overview()`: subjects (id, name, emoji, archived, average exam grade and other grade, number of graded goals) each with its active goals (id, name, kind, due, dueTime, planMode, status, part count, parts done). Capped (like `SCHEDULE_ROWS_MAX`); `more: true` when cut.
- `study_goal({ id })`: one goal with its parts (id, name, estimate minutes, done, role, position), study window, grade if any.
- `study_settings()`: session minutes, daily maximum, study windows, grade scale.

Only what the model needs; no usage numbers or internal flags. Results are data, not instructions (existing prompt rule applies; subject, goal and topic names are user text).

### Write tools (proposals, never writes)

All have `target` (enum) and flat nullable fields (strict schemas have no unions); the server turns each into one action.

- `study_create({ target: subject | goal | part, subjectId?, goalId?, name, emoji?, color?, kind?, due?, dueTime?, parts?, topic estimate? })`
  - subject: name, optional emoji and color.
  - goal: existing `subjectId` (or a new subject name), name, kind (exam, assignment, presentation, other), due, optional dueTime, optional topics with estimates, or no topics (a goal that is only a date).
  - part: `goalId`, name, optional estimate minutes.
- `study_update({ target: subject | goal | part | settings, id?, ...changes })`: set only what changes, the rest null.
  - subject: name, emoji, color, archived.
  - goal: name, kind, due, dueTime, subject, studyFrom/studyTo, status done with grade, archived.
  - part: name, estimate minutes, done (true/false), order position.
  - settings: sessionMinutes (15–180), dailyMaxMinutes (15–720), windows, gradeScale.
- `study_delete({ target: subject | goal | part, id, summary })`.
- `study_plan` stays for "plan my exam from scratch with these topics" (opens the preview sheet).
- Re-plan: `study_replan()` ends the loop with an action that opens the plan preview (existing `fetchPlanPreview`).

Each valid proposal becomes an action `{ type: 'study_create' | 'study_update' | 'study_delete' | 'study_replan', target, ... }`. The server checks field shapes with the same rules as `study.js` (name length, date format, enums, ranges) and checks that every id belongs to the user (`subjects`, `goals`, `goal_parts`) before the action leaves the server. Limits in the routes (`refuseOverLimit` for subjects and goals, `MAX_PARTS`) stay in force because the app applies through the routes; the card shows the error.

### Frontend

`features/assistant/applyAction.js` gets the new cases and uses the existing thunks in `features/study/study.js`: `saveSubject`, `createGoal`, `updateGoal`, `addPart`, `updatePart`, `reorderParts`, `saveStudySettings`, `deleteSubject`, `deleteGoal(id, sessions)`, `deletePart`. `prepareActions` shows changes and deletions from the app's OWN copy (store or a fetched goal), not from the model's `summary`, as it does for tasks; an unknown id is left out and counted. Create returns an `undo` (delete again). Update and delete need the confirm card; a goal delete asks what happens to its sessions (keep or remove), as the UI does. One chat card component for all study actions; texts in `i18n/de` and `en`.

### Prompt

Add one paragraph: Lernen exists (subjects, goals, topics), look it up with the read tools first, never guess an id, creating is applied at once, changing and deleting is confirmed, ask when a subject or goal name matches more than one.

### Cost and limits

The per-message bounds stay (6 model calls, 3 lookups per turn, 60 000 input tokens, 60 s, 20 messages a day). The overview is capped so one lookup stays small; goal detail is fetched per goal.

## Calls I made (change them if wrong)

- Notes, friends and shared study material are not part of this.
- Grades go through goal done + grade, as in the UI, not as a separate tool.
- Study times as a whole list: setting windows replaces the list (as `PUT /settings` does), so the card shows the new list.
- Max-only, same access check as the rest of the assistant.

## Left to the builder

Exact field names and caps, the card layout, the wording of the German and English texts, test layout (follow `scripts/test/assistant.test.mjs` and the frontend `assistant.test.jsx`), and whether `study_plan` and `study_create` goal can share code.
