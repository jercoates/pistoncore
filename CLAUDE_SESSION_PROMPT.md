# PistonCore — Claude Session Starter Prompt

Paste this at the start of every new Claude session to restore context.
Update the "Last session" and "Next session" sections each time.

---

## How to use this prompt

1. Paste this entire file at the start of a new Claude session
2. Tell Claude what you want to work on today
3. At the end of the session update "Last session" and "Next session" before saving

---

## Project Overview

I am building an open source project called PistonCore — a WebCoRE-style visual automation builder for Home Assistant.

GitHub repo: https://github.com/jercoates/pistoncore

**The design document is the authoritative source for all decisions.** Before writing any code read DESIGN.md from the repo. Do not rely on memory or assumptions — the design has changed significantly and the code must match the current design.

---

## Key Facts

- I have almost no programming background. I am directing the vision, you are writing the code.
- This is built in limited sessions. The session prompt and DESIGN.md are your memory between sessions.
- I run Unraid as my primary server. The app will run as a Docker container on Unraid.
- I have a dedicated test Unraid instance with a clean Home Assistant VM for testing.
- My cousin is an occasional technical advisor — he has coding knowledge but limited home automation knowledge.
- Traffic is already coming to the GitHub repo. Real users are watching.

---

## Current State of the Repo

### Root files (do not move these):
- `README.md` — project overview
- `DESIGN.md` — full design specification v0.5 — **read this first every session**
- `DESIGN.md` — full design specification v0.5
- `LICENSE` — MIT
- `CLAUDE_SESSION_PROMPT.md` — this file
- `RESEARCH_NOTES.md` — background research

### session2_archive/
Contains all code from Session 2. This code was built against an earlier design that has since changed significantly. It is kept for reference — do not build on top of it directly. Useful parts to reference:
- `session2_archive/editor/backend/` — FastAPI backend structure, storage system, piston models, API routes are worth reviewing
- `session2_archive/editor/frontend/` — React frontend, largely superseded by new UI direction
- `session2_archive/companion/` — HA companion integration skeleton

### What does NOT exist yet (needs to be built fresh):
- New editor frontend matching v0.5 design (framework not prescribed — see DESIGN.md Section 7)
- Dynamic multi-step condition wizard with live HA capability fetching
- Updated companion that fetches full device capability profiles
- Compiler template system (external files, not hardcoded)
- Piston status / troubleshoot page as the hub
- All toolbar visibility toggle behavior

---

## The Most Important Design Changes Since Session 2

Read DESIGN.md fully but pay special attention to these areas that changed most significantly:

**1. The editor is a structured document, not a form.**
It should feel like viewing code in a text editor — logic always visible top to bottom, indented to show nesting. NOT dropdowns and form fields. See Section 7 of DESIGN.md.

**2. The condition wizard is a dynamic multi-step modal.**
Not a static dropdown. Each step's options are generated from HA based on what was selected in the previous step. PistonCore never maintains its own device capability database — it always asks HA. See Section 5.5 of DESIGN.md.

**3. The companion must fetch full device capability profiles.**
Not just entity lists. Every attribute and supported state for every device. The condition wizard depends on this data. See Section 10.2 of DESIGN.md.

**4. The status page is the hub for every piston.**
Navigation flow is: List → Status page → Editor → back to Status page. Folder assignment, export (green/red camera), and run log all live on the status page, not in the editor. See Section 7 of DESIGN.md.

**5. Global variables live in PyScript's variable store.**
Not HA helpers. Any piston using a global automatically compiles to PyScript. See Section 3 of DESIGN.md.

**6. The compiler uses external template files.**
Not hardcoded output. Templates live in the Docker volume and are user-replaceable with AI assistance. See Section 9 of DESIGN.md.

**7. Frontend framework is not prescribed.**
React is not required. The UI feel requirements take priority over any specific technology. Whatever framework best produces the structured document editor feel is the right choice. See Section 7 of DESIGN.md.

---

## Tech Stack

- **Backend:** Python FastAPI
- **Frontend:** Framework not prescribed — must produce structured document editor feel
- **Piston storage:** JSON files in Docker volume
- **Compiler output:** YAML (simple pistons) or PyScript (complex pistons) via external templates
- **Default port:** 7777
- **HA integration:** Companion custom integration installed via HACS
- **Target deployment:** Docker on Unraid, Unraid Community Apps template planned

---

## V1 Core Feature Set

Build only these in V1. Everything else is a future feature. See Section 14 of DESIGN.md for the full list.

**Statement types for V1:**
- If Block (Condition and Group)
- Action
- Timer / Wait
- Wait for state with timeout
- Only when restrictions
- Repeat loop with condition
- Nested ifs to any depth

**Editor features for V1:**
- Toolbar with visibility toggles (define, restrictions, complex ifs, move mode)
- Drag and drop block reordering
- Global variables right sidebar (read-only reference)
- Simple / Advanced mode toggle
- Safe share export (green camera) and full export (red camera)
- Duplicate piston
- Import from backup code and backup file
- Piston status page as hub (folder assignment, exports, run log, edit button)
- Run log with plain English detail
- Pause/resume from list and status page
- Compiler templates (external, user replaceable)
- EntityPicker with type-to-filter search (name and area)
- Dynamic capability-driven multi-step condition wizard
- True/false last evaluation result on piston list

---

## Session Log

### Session 1 — April 2026
- Project conceived, design document written
- GitHub repo created with docs

### Session 2 — April 2026
- FastAPI backend scaffolded — routes, models, storage, HA client, compiler
- React frontend scaffolded — all pages, editor sections, EntityPicker
- Companion integration skeleton built
- 19 API endpoints verified
- Compiler verified against example piston
- All code now in session2_archive — superseded by v0.5 design changes

### Session 2 Strategy Review — April 2026
- Extensive WebCoRE screenshot review
- Design doc rewritten as v0.5 — major changes to UI model, architecture, and scope
- Frontend decoupled from React
- Condition wizard redesigned as dynamic multi-step
- Status page established as piston hub
- Compiler template system designed
- V1 scope tightened to real world core feature set
- Future features list established

---

## Last Session
Session 2 strategy review. No new code written. Major design changes captured in DESIGN.md v0.5. All Session 2 code moved to session2_archive.

## This Session — Start Here
Read DESIGN.md from the repo before doing anything else.

Suggested starting point for the first coding session against v0.5:

1. Decide on frontend framework — review session2_archive React frontend and discuss whether to keep React or switch. The structured document editor feel is the requirement, the framework is the tool.
2. Scaffold the new folder structure for editor and companion
3. Start with the companion — get it fetching full device capability profiles from HA since everything else depends on that data
4. Get the Docker container running on test Unraid so the UI can be seen in a browser

Do not start writing editor UI code until the framework decision is made and confirmed.

---

## Reference Videos for WebCoRE UI Context

If you need to understand what WebCoRE looks like before making UI decisions:
- Introduction: https://www.youtube.com/watch?v=Dh5CSp-xdfM
- Dashboard: https://www.youtube.com/watch?v=HIzgoXgLUxQ
- Conditions vs Triggers: https://www.youtube.com/watch?v=L4axJ4MCYRU
- Variables: https://www.youtube.com/watch?v=6d3wtjjCLiM

Note: These are beginner level only. For complex feature reference, see the WebCoRE screenshots in the project discussion history.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
