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
- My cousin is an occasional technical advisor — he has coding knowledge but limited home automation knowledge. He has built two working tested versions of the frontend using his own framework (framework not yet confirmed — ask at start of next session). He uses GitHub Copilot against the repo to generate code. DESIGN.md is the authoritative document Copilot reads.
- Traffic is already coming to the GitHub repo. Real users are watching.

---

## Current State of the Repo

### Root files (do not move these):
- `README.md` — project overview
- `DESIGN.md` — full design specification v0.6 — **read this first every session**
- `LICENSE` — MIT
- `CLAUDE_SESSION_PROMPT.md` — this file
- `RESEARCH_NOTES.md` — background research
- `Notes for next session` — additional notes file in repo

### session2_archive/
Contains all code from Session 2. Built against an earlier design — kept for reference only. Do not build on top of it directly.
- `session2_archive/editor/backend/` — FastAPI backend structure, storage system, piston models, API routes
- `session2_archive/editor/frontend/` — React frontend, superseded by v0.6 design
- `session2_archive/companion/` — HA companion integration skeleton

### What does NOT exist yet (needs to be built fresh):
- New editor frontend matching v0.6 design
- Dynamic multi-step condition, trigger, and action wizard with live HA capability fetching
- Updated companion that fetches full device capability profiles
- Compiler template system (external files, not hardcoded)
- Piston status page as the hub
- Two-phase setup flow
- Trace mode via WebSocket
- Snapshot and Backup export
- File signature and hash system
- Pre-save validation pipeline
- Unknown device fallback and My Device Definitions screen

---

## Design is Complete — No Open Questions

All six open questions from previous sessions have been resolved. DESIGN.md v0.6 is the authoritative source. Do not re-open resolved questions. If something seems unclear, read DESIGN.md Section by Section before asking.

Key decisions already locked in (do not re-litigate):
- Compiled output is hidden from users — not shown on status page
- Save in editor returns to status page
- Trigger wizard uses same multi-step pattern as conditions and actions
- Folder assignment: no prompt on creation, lands in Uncategorized, assigned on status page
- Piston IDs: Snapshot import always gets new ID, Backup import preserves original
- Failure notification: HA persistent notification + PistonCore badge, per piston toggle
- Unknown device fallback: HA first always, one-time Define screen if no capability data returned
- File signature and hash system: every compiled file gets header, hash of compiled content, diff shown on manual edit detection
- Pre-save validation: internal checks → sandbox compile → HA check_config (YAML) or py_compile (PyScript) → commit or stop
- Editor is a structured document, indented tree, WebCoRE keywords, inline ghost text insertion
- Single global Simple/Advanced toggle — no per-block toggles in document
- Per-statement cog in wizard for TEP, TCP, Execution Method
- Full operator set per Section 9 of DESIGN.md — XOR and followed-by excluded, range deferred to v2
- Geofence handled naturally via changes-to on person/zone entity — no special operator
- Logging matches WebCoRE: log level per piston, five log message types, Trace via WebSocket with line number overlay
- Frontend framework: not prescribed — cousin's working implementation to be integrated
- Three pages: Main list, Status page (hub), Editor — content defined in Section 7 of DESIGN.md
- Output files go in pistoncore subfolders only: automations/pistoncore/ and pyscript/pistoncore/

---

## Tech Stack

- **Backend:** Python FastAPI
- **Frontend:** Framework TBD — cousin has working tested versions, confirm framework at start of next session
- **Piston storage:** JSON files in Docker volume
- **Compiler output:** YAML (simple pistons) or PyScript (complex pistons) via external templates
- **Default port:** 7777
- **HA integration:** Phase 1 via HA REST API, Phase 2 via companion custom integration installed via HACS
- **Target deployment:** Docker on Unraid, Unraid Community Apps template planned

---

## V1 Core Feature Set

See DESIGN.md Section 21 for the complete list. Do not add features outside this list.

---

## Session Log

### Session 1 — April 2026
Project conceived, design document written, GitHub repo created with docs.

### Session 2 — April 2026
FastAPI backend scaffolded, React frontend scaffolded, companion integration skeleton built, 19 API endpoints verified, compiler verified against example piston. All code now in session2_archive.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design doc rewritten as v0.5 — major changes to UI model, architecture, and scope. Frontend decoupled from React. Condition wizard redesigned as dynamic multi-step. Status page established as piston hub. Compiler template system designed. V1 scope tightened.

### Session 3 — April 2026
Design refinement session. No code written. Key decisions made through WebCoRE screenshot analysis and structured topic review. DESIGN.md updated to v0.5 and committed to repo. Six open design questions documented for next session.

### Session 4 — April 2026
Full design review session. No code written. All six open questions resolved. WebCoRE wiki and documentation scraped for full operator set, logging behavior, and UI flow reference. Key decisions:
- All six open questions answered (see DESIGN.md Section 24 development log for full list)
- Full WebCoRE operator set reviewed and documented in DESIGN.md Section 9
- Logging system designed to match WebCoRE as closely as HA allows
- Three pages fully defined: Main list, Status page, Editor (Section 7)
- File signature and hash system designed (Section 12)
- Pre-save validation pipeline designed (Section 13)
- Unknown device fallback designed (Section 5)
- Piston ID and import collision handling resolved (Section 18)
- Cousin's involvement clarified: has working frontend, uses Copilot against repo
- DESIGN.md updated to v0.6 and successfully committed to repo

---

## Last Session
Session 4 — full design review, all open questions resolved, DESIGN.md updated to v0.6 and committed to repo. No code written.

## Next Session — Start Here

1. Read DESIGN.md from the repo before doing anything else.
2. **Confirm cousin's frontend framework** — what did he use for his two working versions? This determines the frontend section of the tech stack.
3. Review cousin's current working code if available — identify what matches v0.6 design and what does not.
4. Decide on folder structure for the new build.
5. Begin scaffolding:
   - Backend: FastAPI skeleton matching v0.6 architecture
   - Companion: Phase 1 REST API pull of device capability profiles
   - Frontend: stub pages for Main list, Status page, and Editor
6. Get the Docker container running on test Unraid so the UI can be seen in a browser — even if it is just stub pages.

Do not write production-quality editor UI code until the framework is confirmed and the cousin's existing work has been reviewed.

---

## Reference Videos for WebCoRE UI Context

If you need to understand what WebCoRE looks like before making UI decisions:
- Introduction: https://www.youtube.com/watch?v=Dh5CSp-xdfM
- Dashboard: https://www.youtube.com/watch?v=HIzgoXgLUxQ
- Conditions vs Triggers: https://www.youtube.com/watch?v=L4axJ4MCYRU
- Variables: https://www.youtube.com/watch?v=6d3wtjjCLiM

Note: These are beginner level only. For complex feature reference, see DESIGN.md and the WebCoRE wiki at wiki.webcore.co.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
