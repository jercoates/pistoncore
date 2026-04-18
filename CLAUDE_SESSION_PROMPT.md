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
- `LICENSE` — MIT
- `CLAUDE_SESSION_PROMPT.md` — this file
- `RESEARCH_NOTES.md` — background research

### session2_archive/
Contains all code from Session 2. This code was built against an earlier design that has since changed significantly. It is kept for reference only — do not build on top of it directly. Useful parts to reference:
- `session2_archive/editor/backend/` — FastAPI backend structure, storage system, piston models, API routes
- `session2_archive/editor/frontend/` — React frontend, largely superseded by new UI direction
- `session2_archive/companion/` — HA companion integration skeleton

### What does NOT exist yet (needs to be built fresh):
- New editor frontend matching v0.5 design (framework not prescribed — see DESIGN.md Section 7)
- Dynamic multi-step condition and action wizard with live HA capability fetching
- Updated companion that fetches full device capability profiles
- Compiler template system (external files, not hardcoded)
- Piston status page as the hub
- Two-phase setup flow (Phase 1 REST API only, Phase 2 companion prompted on first deploy)
- Trace mode via WebSocket
- Snapshot and Backup export

---

## The Most Important Design Changes Since Session 2

Read DESIGN.md fully but pay special attention to these areas:

**1. The editor is a structured document, not a form.**
Logic always visible top to bottom, indented to show nesting. NOT dropdowns buried in form sections. See Section 7.

**2. The device picker works at the device level, not the entity level.**
User picks a physical device, then picks a capability from a live list fetched from HA. Entity IDs are never shown. See Section 5.

**3. The condition and action wizard is a dynamic multi-step modal.**
Each step's options are generated from HA based on the previous step. PistonCore never maintains its own capability database. See Section 8.

**4. The companion must fetch full device capability profiles.**
Not just entity lists. Every attribute and supported state for every device. See Section 14.3.

**5. The status page is the hub for every piston.**
Navigation: List → Status Page → Editor → Status Page. Validation warnings appear automatically on save. Trace toggle lives here. See Section 7.

**6. Two-phase setup.**
Phase 1: user enters HA URL and token, REST API pulls everything, pistons can be built immediately. Phase 2: companion installation is prompted only when the user first tries to deploy. See Section 14.2.

**7. Export is Snapshot and Backup.**
Snapshot = anonymized, safe to share. Backup = full with entity mappings, personal only. Both use camera icon plus plain English label. See Section 9.

**8. Global variables write to JSON and push to HA immediately on save.**
JSON is always the master. Startup sync script loads globals into HA on boot. See Section 4.1.

**9. Safety lockdown is architectural.**
PistonCore cannot touch HA core files regardless of user intent. See Section 13.

**10. Frontend framework is not prescribed.**
React is not required. Whatever produces the structured document editor feel. See Section 7.

---

## Open Design Questions — Resolve These Before Coding

DESIGN.md Section 20 lists six open questions that were not resolved in Session 3. These must be answered before writing code that depends on them. Prompt the user on each one at the start of the next session if they have not been answered yet:

1. Does the compiled script output display on the status page or is it hidden?
2. Where is the per-piston failure notification configured and what does it send?
3. How are piston IDs generated and what happens on an ID collision at import?
4. Is folder assignment prompted on new piston creation or always optional?
5. When the user saves in the editor, do they stay in the editor or return to the status page?
6. Does the trigger setup use the same multi-step wizard as the condition wizard or is it structured differently?

---

## Tech Stack

- **Backend:** Python FastAPI
- **Frontend:** Framework not prescribed — must produce structured document editor feel
- **Piston storage:** JSON files in Docker volume
- **Compiler output:** YAML (simple pistons) or PyScript (complex pistons) via external templates
- **Default port:** 7777
- **HA integration:** Phase 1 via HA REST API, Phase 2 via companion custom integration installed via HACS
- **Target deployment:** Docker on Unraid, Unraid Community Apps template planned

---

## V1 Core Feature Set

Build only these in V1. Everything else is a future feature. See Section 18 of DESIGN.md for the full list.

**Statement types for V1:**
- If Block (Condition and Group)
- Action
- Timer / Wait
- Wait for state with timeout
- Only when restrictions
- Repeat loop with condition
- Nested ifs to any depth

**Editor features for V1:**
- Toolbar with visibility toggles
- Drag and drop block reordering
- Global variables right sidebar (read-only reference)
- Simple / Advanced mode toggle
- Snapshot and Backup export (camera icon + plain English label)
- Duplicate piston
- Import from JSON paste, URL, and file
- Piston status page as hub
- Run log with plain English detail
- Trace mode for live debug via WebSocket
- Pause/resume from list and status page
- Compiler templates (external, user replaceable)
- Device picker with type-to-filter search by name and area
- Dynamic capability-driven multi-step condition and action wizard
- True/false last evaluation result on piston list
- Copy AI Prompt button on piston list
- Automatic validation warnings on save

---

## Session Log

### Session 1 — April 2026
Project conceived, design document written, GitHub repo created with docs.

### Session 2 — April 2026
FastAPI backend scaffolded, React frontend scaffolded, companion integration skeleton built, 19 API endpoints verified, compiler verified against example piston. All code now in session2_archive — superseded by v0.5 design changes.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design doc rewritten as v0.5 — major changes to UI model, architecture, and scope. Frontend decoupled from React. Condition wizard redesigned as dynamic multi-step. Status page established as piston hub. Compiler template system designed. V1 scope tightened.

### Session 3 — April 2026
Design refinement session. No code written. Key decisions made through WebCoRE screenshot analysis and structured topic review. DESIGN.md updated to v0.5 and committed to repo. Six open design questions documented for next session.

---

## Last Session
Session 3 — design refinement. DESIGN.md updated to v0.5. No code written. Six open questions remain (see Section 20 of DESIGN.md and the list above).

## Next Session — Start Here

1. Read DESIGN.md from the repo before doing anything else.
2. Work through the six open design questions in Section 20 — resolve all of them before writing any code.
3. Once questions are resolved, decide on frontend framework.
4. Scaffold the new folder structure.
5. Start with the companion Phase 1 — get it pulling device capability profiles from HA via REST API.
6. Get the Docker container running on test Unraid so the UI can be seen in a browser.

Do not start writing editor UI code until all six open questions are answered and the framework decision is made.

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
