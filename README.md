# TimeStable (demo)

A working, no-build demo of TimeStable: an academic planner that turns a university timetable,
deadlines and personal commitments into a weekly study plan, and keeps it working when the week changes.

## Run it

- **Easiest:** open `index.html` in a browser (needs internet for fonts and the React/htm/Lucide CDN scripts).
- **Recommended:** serve the folder so the sample calendar feed can be fetched:
  `python -m http.server 5173`, then open http://localhost:5173
- **Tests:** open `tests.html` (40 checks on the scheduling engine, dates, ICS import, analytics and the published ECE2 timetable).

To restart the demo, use **Demo → Start setup again** (top of Today/Week) or **Preferences → Delete everything**.

## Demo script (about 3 minutes)

1. **Set up my semester**, then pick DCU · Electronic & Computer Engineering · Year 2.
2. **Connect to Loop (simulated)**: modules, timetable and module pages arrive with a progress log.
3. **Check the import**: review the published classes and acknowledge the flagged items (undated coursework, make-up sessions, exam dates).
4. Routine → Commitments (add a job, gym, a society) → Priorities (rate a module Hard / Low).
5. **Build my plan**: real counts from the engine, plus anything that can't fit.
6. In Today or Week, choose **Demo → Loop pushes a lab time change**. The proposal moves only what is
   affected, and flags any clash with your commitments.
7. Drag a hatched study block in Week to move and pin it; open any block to see why it is there.
8. Insights shows the Week Dial. Selecting a segment highlights where that time sits in the week.

The second sample course (Computer Science, Year 2) and the calendar-file path
(`samples/sample-timetable.ics`) show the same flow with different data.

## What is simulated

| Area | In this demo | For production |
| --- | --- | --- |
| DCU Loop / timetable | The connection is simulated and asks for no credentials. **ECE2 uses DCU's published 2026/27 timetable and module specifications** (`js/data/dcu-ece2-2026.js`, copied 23 Nov 2026). Computer Science is still sample data. | A server-side adapter with the same method names (`connect`, `getEnrolments`, `getTimetable`, `getModulePage`), using DCU SSO through an approved integration. |
| Calendar links | Same-origin links are fetched; other sites usually block browsers (CORS), which the UI explains. | Fetch feeds on the server. |
| PDFs / photos | Detected and declined with an explanation. | Document extraction + OCR service, results go through the same review step. |
| Study guides | Deterministic: lab-prep checklists, revision checklists and recall prompts from content that was actually read. | An LLM service for summaries and practice questions, labelled with its sources. |
| Reviews | ECE2 starts with no reviews. The sample Computer Science course shows labelled sample reviews. Submissions are held as "pending moderation" locally. | Moderation queue, verified enrolment from the university connector. |
| Accounts / sync | None. Data lives in the browser's localStorage (`js/state.js` is the only persistence boundary). | Auth + database (e.g. Supabase) behind the same actions. |

## Structure

- `js/engine/model.js`: expands classes, commitments and one-off changes into dated occurrences, and derives tasks
  (pre-labs before labs, reports after them, tutorial prep, weekly review and recall, assessments).
- `js/engine/scheduler.js`: deterministic, constraint-first placement with priority tiers, focus-time
  preferences, spreading, breaks, daily limits, flex reserve, unfit reporting with reasons,
  a minimal replan that moves only what a change affects, and a diff for accept/reject.
- `js/engine/ics.js`: link checks, ICS parsing, and conversion to weekly classes.
- `js/state.js`: app state and every action (check-ins, moves, replans, preferences).
- `js/views/*`: Setup, Today, Week, Tasks, Modules, Insights, Explore, Preferences.
- `css/app.css`: the design system (tokens for dark and light, module colour model, components).

The product name lives in `TS.brand` in `js/core.js`.
