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

**Important:** The repo may have a cached/stale version of files. If fetching from the repo fails or returns an old version, ask the user to paste the files directly. DESIGN.md in the repo may still be at v0.2 (Session 1) — the current version is v0.8.

---

## Key Facts

- I have almost no programming background. I am directing the vision, you are writing the code.
- This is built in limited sessions. The session prompt and DESIGN.md are your memory between sessions.
- I run Unraid as my primary server. The app will run as a Docker container on Unraid.
- I have a dedicated test Unraid instance with a clean Home Assistant VM for testing.
- My cousin is an occasional technical advisor — he has coding knowledge but limited home automation knowledge. He builds the frontend using vanilla JS, HTML, and CSS. He uses GitHub Copilot against the repo to generate code. DESIGN.md, FRONTEND_SPEC.md, and WIZARD_SPEC.md are the authoritative documents Copilot reads.
- Traffic is already coming to the GitHub repo. Real users are watching.

---

## Current State of the Repo

### Root files (do not move these):
- `README.md` — project overview
- `DESIGN.md` — full design specification **v0.8** — **read this first every session**
- `FRONTEND_SPEC.md` — frontend developer specification **v0.2**
- `WIZARD_SPEC.md` — wizard capability map and behavior **v0.2**
- `CLAUDE_SESSION_PROMPT.md` — this file
- `LICENSE` — MIT

### session2_archive/
Contains all code from Session 2. Built against an earlier design — kept for reference only.
Do not build on top of it directly.

### What does NOT exist yet (needs to be built):
- COMPILER_SPEC.md — the primary blocker for all coding (Session 7 primary item)
- AI-UPDATE-GUIDE.md files — cannot be written until compiler is designed
- Backend FastAPI skeleton
- Docker container setup
- Companion integration

---

## Design is Complete Enough to Begin Compiler Work

DESIGN.md v0.8, FRONTEND_SPEC.md v0.2, and WIZARD_SPEC.md v0.2 are current and consistent.
No further design sessions needed before compiler work begins.

### Key decisions already locked in (do not re-litigate):

**Architecture:**
- Backend: Python FastAPI
- Frontend: Vanilla JS, HTML, CSS — no framework
- Piston storage: JSON files in Docker volume
- Compiler output: Jinja2 templates (PyScript primary, YAML secondary)
- Default port: 7777
- HA integration: Phase 1 via HA WebSocket API, Phase 2 via companion (HACS)
- Two Docker volume folders: pistoncore-userdata/ and pistoncore-customize/

**UI — match WebCoRE exactly:**
- Piston list: single scrolling list with folder section headers — NOT two-column layout
- Last run time shown as timestamp (HH:MM:SS) not relative time
- Editor: structured document, indented tree, WebCoRE keywords
- Keywords: execute/end execute (rendering only, not a JSON node), define/end define, settings/end settings, if/when true/when false (editor display), if/then/end if (saved/status page format), with/do/end with, repeat/do/until/end repeat (until at bottom), for each/do/end for each, only when
- AND/OR between conditions: same indent level as conditions, not further indented
- Status page: shows piston script read-only (visual format, NOT compiled YAML/PyScript)
- Test button label differs by compile target: Preview Mode (YAML) vs Live Fire ⚠ (PyScript)
- Compiled output (YAML/PyScript) is never shown to the user
- Trace numbers are statement numbers not line numbers
- Ghost text insertion points: always visible, + add a new statement / task / trigger / condition / restriction
- Right-click context menu: copy / cut / duplicate / delete / clear clipboard
- Condition wizard first step: Condition or Group (groups are first-class)

**Sharing:**
- JSON export only — no central server short codes (deliberate divergence from WebCoRE)
- Snapshot (green camera) = anonymized, safe to share
- Backup (red camera) = full with entity mappings, personal restore only
- Role creation: hard references internally, auto-roles generated on Snapshot export

**Validation:**
- Runs on Docker — no HA dependency for core validation
- Stage 1: internal checks (Docker) — rules in validation-rules JSON files
- Stage 2: compile to sandbox (Docker)
- Stage 3: yamllint or py_compile (Docker)
- Stage 4: HA check_config for YAML — optional, only if companion installed

**Compiler:**
- Jinja2 templates in pistoncore-customize/compiler-templates/
- PyScript is primary compile target — design and complete first
- YAML is secondary — simpler, add after
- execute/end execute is a rendering artifact, NOT a JSON data node
- Template format not yet defined — COMPILER_SPEC.md is the Session 7 primary output
- Each template folder has an AI-UPDATE-GUIDE.md for community maintenance

**Auto-detection (3 root-cause rules):**
- Any non-device variable used → PyScript
- Any HA helper would be required → PyScript
- Any feature not native to YAML automation block → PyScript
- Otherwise → YAML

---

## Open Items Blocking Coding

1. **COMPILER_SPEC.md** — primary blocker. Session 7 agenda: work backwards from hand-written PyScript output for the driveway lights piston to define template format, placeholders, and compiler tree walk.
2. **settings / end settings block** — research WebCoRE behavior, define contents before implementing
3. **globals.json sandbox validation** — three fallback solutions to test (task.executor, hass.data cache, PyScript module)
4. **AI Prompt feature redesign** — needs friendly name context without entity IDs
5. **Which-interaction step feasibility** — sandbox validation of PyScript context tracking
6. **Timer statement** — evaluate overlap with HA scheduler

---

## Session Log

### Session 1 — April 2026
Project conceived, design document written, GitHub repo created with docs.

### Session 2 — April 2026
FastAPI backend scaffolded, React frontend scaffolded, companion integration skeleton built, 19 API endpoints verified, compiler verified against example piston. All code now in session2_archive.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design doc rewritten as v0.5 — major changes to UI model, architecture, and scope. Frontend decoupled from React. Condition wizard redesigned as dynamic multi-step. Status page established as piston hub. Compiler template system designed. V1 scope tightened.

### Session 3 — April 2026
Design refinement session. No code written. DESIGN.md updated to v0.5.

### Session 4 — April 2026
Full design review session. No code written. All six open questions resolved. DESIGN.md updated to v0.6.

### Session 5 — April 2026
Full design and correction session. No code written. DESIGN.md v0.7, FRONTEND_SPEC.md v0.1, WIZARD_SPEC.md v0.1 produced and pushed to repo. WebCoRE screenshots reviewed, 8 corrections documented in notes file. Docker volume structure, validation rules file, AI-UPDATE-GUIDE concept, and Jinja2 compiler format confirmed. Compiler template design approach (backwards from output) confirmed. 32-item notes file produced.

### Session 6 — April 2026
Full spec update session. No code written. DESIGN.md v0.8, FRONTEND_SPEC.md v0.2, WIZARD_SPEC.md v0.2 produced incorporating all 32 notes file items. Key additions: piston list single-column corrected, status page read-only script view added, execute/end execute confirmed as rendering artifact, if/then vs when true/when false distinction documented, repeat/until structure corrected, AND/OR indentation corrected, auto-detection simplified to 3 rules, statement types expanded (Switch/While/DoBlock/OnEvent/ForLoop/Break/CancelPendingTasks added), variable types expanded (integer/decimal split, Date-only/Time-only added), condition-or-group wizard first step added, which-interaction step added, system variables defined, call-another-piston warning timing defined, control another piston as first-class feature, test button labeled by compile target, independence guarantee table added. Compiler work deferred to Session 7.

---

## Last Session
Session 6 — April 2026. Spec update session. DESIGN.md v0.8, FRONTEND_SPEC.md v0.2, WIZARD_SPEC.md v0.2 produced. No code written. Compiler work deferred to Session 7.

## Next Session — Start Here

**Note:** The repo may have stale files. Ask user to paste DESIGN.md, FRONTEND_SPEC.md, WIZARD_SPEC.md, and this session prompt if the repo fetch fails or returns old versions.

1. Read DESIGN.md v0.8 from the repo (or ask user to paste)
2. Read FRONTEND_SPEC.md v0.2 from the repo (or ask user to paste)
3. Read WIZARD_SPEC.md v0.2 from the repo (or ask user to paste)
4. **Primary session goal: Design the compiler template system and produce COMPILER_SPEC.md**

   Follow this process (defined in Session 5 notes):
   a. Write valid PyScript BY HAND for the driveway lights piston (DESIGN.md Section 18 example JSON) — this is the target output, no templates yet
   b. Work backwards: identify what parts are fixed (template) vs variable (placeholders)
   c. Work backwards: determine what the compiler must extract from piston JSON and how it walks the tree
   d. Define the exact recursive compiler walk function
   e. Verify on paper: feed the piston JSON through the designed logic, confirm it produces the hand-written output
   f. Document as COMPILER_SPEC.md

5. Write AI-UPDATE-GUIDE.md files once COMPILER_SPEC.md is complete
6. Update this session prompt
7. Poll other AIs (Grok, Gemini, Perplexity) against updated specs — do AFTER specs are published, not before

**Do not write production code until COMPILER_SPEC.md is produced.**

---

## Reference Videos for WebCoRE UI Context

If you need to understand what WebCoRE looks like before making UI decisions:
- Introduction: https://www.youtube.com/watch?v=Dh5CSp-xdfM
- Dashboard: https://www.youtube.com/watch?v=HIzgoXgLUxQ
- Conditions vs Triggers: https://www.youtube.com/watch?v=L4axJ4MCYRU
- Variables: https://www.youtube.com/watch?v=6d3wtjjCLiM

Note: These are beginner level only. For complex feature reference, see DESIGN.md, FRONTEND_SPEC.md, WIZARD_SPEC.md, and the WebCoRE wiki at wiki.webcore.co.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
