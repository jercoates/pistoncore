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
- My cousin is an occasional technical advisor — he has coding knowledge but limited home automation knowledge. He builds the frontend using vanilla JS, HTML, and CSS. He uses GitHub Copilot against the repo to generate code. DESIGN.md, FRONTEND_SPEC.md, and WIZARD_SPEC.md are the authoritative documents Copilot reads.
- Traffic is already coming to the GitHub repo. Real users are watching.

---

## Current State of the Repo

### Root files (do not move these):
- `README.md` — project overview
- `DESIGN.md` — full design specification v0.7 — **read this first every session**
- `FRONTEND_SPEC.md` — frontend developer specification v0.1
- `WIZARD_SPEC.md` — wizard capability map and behavior v0.1
- `Notes_for_next_session.md` — corrections and decisions from Session 5 — **read this second**
- `permanent notes ask each ai` — standing questions to ask every AI doing a design review
- `CLAUDE_SESSION_PROMPT.md` — this file
- `LICENSE` — MIT

### session2_archive/
Contains all code from Session 2. Built against an earlier design — kept for reference only.
Do not build on top of it directly.

### What does NOT exist yet (needs to be built):
- DESIGN.md v0.8 incorporating all corrections from Notes_for_next_session.md
- FRONTEND_SPEC.md v0.2 incorporating layout and rendering corrections
- Backend FastAPI skeleton matching v0.7 architecture
- Compiler template system (format not yet defined — see open items)
- AI-UPDATE-GUIDE.md files (cannot be written until compiler is designed)
- Docker container setup
- Companion integration

---

## Design is Largely Complete — Read Notes File for Corrections

DESIGN.md v0.7 is the current authoritative design. Notes_for_next_session.md contains
confirmed corrections that take priority over v0.7 in specific areas. Produce v0.8 at
the start of the next session before writing any code.

### Key decisions already locked in (do not re-litigate):

**Architecture:**
- Backend: Python FastAPI
- Frontend: Vanilla JS, HTML, CSS — no framework
- Piston storage: JSON files in Docker volume
- Compiler output: Jinja2 templates (YAML for simple pistons, PyScript for complex)
- Default port: 7777
- HA integration: Phase 1 via HA WebSocket API, Phase 2 via companion (HACS)
- Two Docker volume folders: pistoncore-userdata/ and pistoncore-customize/

**UI — match WebCoRE exactly:**
- Piston list: single scrolling list with folder section headers — NOT two-column layout
- Editor: structured document, indented tree, WebCoRE keywords
- Keywords: execute/end execute, define/end define, if/when true/when false (editor display), if/then/end if (saved format), with/do/end with, repeat/do/until/end repeat, for each/do/end for each, only when
- Status page: shows piston script read-only (NOT compiled YAML/PyScript)
- Compiled output (YAML/PyScript) is never shown to the user
- Trace numbers are statement numbers not line numbers
- Ghost text insertion points: + add a new statement / task / trigger / condition / restriction
- Right-click context menu: copy / cut / duplicate / delete / clear clipboard
- Global variables sidebar on editor right side

**Sharing:**
- JSON export only — no central server short codes (deliberate divergence from WebCoRE)
- Snapshot (green camera) = anonymized, safe to share
- Backup (red camera) = full with entity mappings, personal restore only

**Validation:**
- Runs on Docker — no HA dependency for core validation
- Stage 1: internal checks (Docker)
- Stage 2: py_compile or yamllint (Docker)
- Stage 3: stub mock import for PyScript (Docker)
- Stage 4: HA check_config for YAML — optional, only if companion installed
- Rules defined in external JSON files in pistoncore-customize/validation-rules/
- Updateable without code changes

**Compiler:**
- Jinja2 templates in pistoncore-customize/compiler-templates/
- Template format not yet fully defined — do not write compiler code until defined
- Each template folder has an AI-UPDATE-GUIDE.md for community maintenance

**PyScript vs YAML:**
- PyScript is primary compile target — complete first
- YAML is secondary
- Auto-detection uses explicit 10-condition ordered list — see DESIGN.md Section 3.1
- PyScript Only vs Full Mode is an explicit user choice at setup

---

## Open Items Blocking Coding

Do not write production code until these are resolved:

1. **Compiler template system** — format, placeholders, how compiler walks the piston tree
   Blocks: Jinja2 templates, AI-UPDATE-GUIDE.md files, compiler code
2. **settings / end settings block** — research WebCoRE behavior, define contents
3. **globals.json sandbox validation** — requires running PyScript/HA to test fallback solutions
4. **AI Prompt feature redesign** — needs friendly name context without entity IDs

---

## Session Log

### Session 1 — April 2026
Project conceived, design document written, GitHub repo created with docs.

### Session 2 — April 2026
FastAPI backend scaffolded, React frontend scaffolded, companion integration skeleton built,
19 API endpoints verified, compiler verified against example piston. All code now in
session2_archive.

### Session 2 Strategy Review — April 2026
Extensive WebCoRE screenshot review. Design doc rewritten as v0.5 — major changes to UI
model, architecture, and scope. Frontend decoupled from React. Condition wizard redesigned
as dynamic multi-step. Status page established as piston hub. Compiler template system
designed. V1 scope tightened.

### Session 3 — April 2026
Design refinement session. No code written. Key decisions made through WebCoRE screenshot
analysis and structured topic review. DESIGN.md updated to v0.5. Six open design questions
documented for next session.

### Session 4 — April 2026
Full design review session. No code written. All six open questions resolved. WebCoRE wiki
and documentation scraped for full operator set, logging behavior, and UI flow reference.
DESIGN.md updated to v0.6 and committed to repo.

### Session 5 — April 2026
Full design and correction session. No code written. Key accomplishments:
- DESIGN.md updated to v0.7
- FRONTEND_SPEC.md v0.1 written — complete frontend developer specification
- WIZARD_SPEC.md v0.1 written — closes capability map gap, lightning bolt distinction,
  no-trigger upgrade flow, full attribute type operator map
- Frontend technology confirmed: vanilla JS, HTML, CSS
- Drag and drop rules defined: within-block reorder only, cut/paste for cross-block
- Statement tree data structure defined
- Editor save pipeline defined
- Docker validation approach defined — no HA dependency
- Validation rules file design defined — updateable without code changes
- Docker volume folder structure defined — two self-explanatory named folders
- AI-UPDATE-GUIDE.md concept defined — one per template folder, community maintainable
- Compiler template format confirmed: Jinja2
- WebCoRE screenshots reviewed — 8 corrections captured in Notes_for_next_session.md
  including: piston list is single column, status page shows read-only script not compiled
  output, execute/end execute wraps action tree, if/then vs when true/when false distinction,
  repeat/until structure, AND/OR indentation, trace = statement numbers not line numbers

---

## Last Session
Session 5 — April 2026. Full design and correction session. DESIGN.md v0.7, FRONTEND_SPEC
v0.1, and WIZARD_SPEC v0.1 produced and pushed to repo. WebCoRE screenshots reviewed and
corrections documented. Docker volume structure, validation rules file, and AI-UPDATE-GUIDE
concept finalized. No code written.

## Next Session — Start Here

1. Read DESIGN.md v0.7 from the repo
2. Read FRONTEND_SPEC.md v0.1 from the repo
3. Read WIZARD_SPEC.md v0.1 from the repo
4. Read Notes_for_next_session.md from the repo — corrections take priority over v0.7
5. Read permanent notes ask each ai from the repo
6. Produce DESIGN.md v0.8 incorporating all corrections from notes file
7. Produce FRONTEND_SPEC.md v0.2 incorporating layout and rendering corrections
8. Design the compiler template system — this is the primary blocker
9. Write AI-UPDATE-GUIDE.md files once compiler template system is defined
10. Begin backend scaffolding only after compiler template system is defined

Do not write production code until the compiler template system is designed.

---

## Reference Videos for WebCoRE UI Context

If you need to understand what WebCoRE looks like before making UI decisions:
- Introduction: https://www.youtube.com/watch?v=Dh5CSp-xdfM
- Dashboard: https://www.youtube.com/watch?v=HIzgoXgLUxQ
- Conditions vs Triggers: https://www.youtube.com/watch?v=L4axJ4MCYRU
- Variables: https://www.youtube.com/watch?v=6d3wtjjCLiM

Note: These are beginner level only. For complex feature reference, see DESIGN.md,
FRONTEND_SPEC.md, WIZARD_SPEC.md, and the WebCoRE wiki at wiki.webcore.co.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant,
Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
