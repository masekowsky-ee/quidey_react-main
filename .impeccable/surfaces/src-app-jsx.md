---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/components/Home.jsx","src/components/tester/Tester.jsx"]
---

# Tester UI variants (app shell + Home)

Scope: the signed-in app for testers. Mode: Operate. Four switchable worlds beside "Aktuell" (the incumbent, kept as the control). Each world lends type, palette, density and one signature move; navigation stays standard per world (top tabs / rail / sidebar + command bar / top strip). Testers rate each (1-5 + comment) on /tester; admins read the results.

## Direction contract

THESIS: Quidey is studied in, not looked at: four worlds from a student's own day (exercise book, reading room, dense info sites, station boards) test which shell makes "one thing at a time" clearest. Refuses the grey SaaS sidebar with one accent.

OWN-WORLD:
- Schulheft: white paper, 20px Kästchen grid as the literal spacing armature, ballpoint blue ink (#2340b8) for actions and data, red margin line reserved for the task in focus; Lexend.
- Lesesaal: bottle-green ground, ivory text, brass lamp light (#e3b35a) only on focus and progress; Source Serif 4 titles, Source Sans 3 UI; quiet icon rail.
- Übersicht: white, hairline modules with small red header tabs (#d7000f), M PLUS 1 at 14px base, 3px corners, command bar (Ctrl K).
- Tafel: navy board (#071635) shell in both themes, white condensed Barlow, yellow (#ffd23f) only for "now"/changes, time columns.

STORY: The tester switches world on /tester, lives in it for a day, rates it, comments, switches again.

FIRST VIEWPORT: Home per world. Schulheft: timetable week on the grid, list in ruled rows, focus with red margin. Lesesaal: lamp-lit focus card first in one centred column, list under it, seats of friends online. Übersicht: mosaic of ruled modules, everything at once. Tafel: departure board of today (Zeit | Aufgabe | Gleis = group | Hinweis), list below.

FORM: four grounded directions (assigned #3 Schulheft, pick #1 Lesesaal, challenger japanese-high-density-web as Übersicht, grounded #4 Tafel). seed:11c5a7f477d4e5e2
Raises: Schulheft took the visible-grid-as-armature discipline from crouwel-grid-specimen and the single reserved course colour from notation-diagram-systems-orienteering-map (red only for the active task).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
