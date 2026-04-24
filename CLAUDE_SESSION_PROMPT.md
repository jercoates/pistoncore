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

**Important:** The repo may have a cached/stale version of files. If fetching from the repo fails or returns old versions, ask the user to paste the files directly.

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
- `DESIGN.md` — full design specification **v0.9.1** — **read this first every session**
- `FRONTEND_SPEC.md` — frontend developer specification **v0.5**
- `WIZARD_SPEC.md` — wizard capability map and behavior **v0.3**
- `COMPILER_SPEC.md` — compiler specification **v0.2** — **read this before any compiler work**
- `CLAUDE_SESSION_PROMPT.md` — this file
- `LICENSE` — MIT

### backend/
All Python backend files. Flat folder — no subfolders.
- `compiler.py` — native HA script compiler, matches COMPILER_SPEC v0.2 ✓
- `main.py` — FastAPI app entry point, port 7777 ✓
- `api.py` — all REST API endpoints ✓
- `storage.py` — all filesystem I/O (piston JSON, globals, config) ✓
- `__init__.py` — package marker
- `README.md` — backend developer notes

### pistoncore-customize/
User-editable folder, mounted as Docker volume.
- `compiler-templates/native-script/` — Jinja2 templates ✓
  - `automation.yaml.j2` ✓
  - `script.yaml.j2` ✓
  - `AI-UPDATE-GUIDE.md` ✓
  - `snippets/` — 18 snippet files, all present ✓
- `validation-rules/`
  - `AI-UPDATE-GUIDE.md` ✓
  - `internal-checks.json` — not yet created
  - `error-translations.json` — not yet created

### session2_archive/
Contains all code from Session 2. Built against an earlier design — kept for reference only.
Do not build on top of it directly.

### What does NOT exist yet (needs to be built):
- `Dockerfile` — Docker container setup
- `docker-compose.yml` — Unraid deployment config
- `requirements.txt` — Python dependencies
- Companion HA integration
- Frontend

---

## Architecture — Locked In (do not re-litigate)

**Compile targets:**
- **Native HA Script (primary)** — every piston compiles to two files: an automation wrapper (triggers + conditions) and a script body (all action logic). Covers ~95% of real pistons. Zero external dependencies. Truly permanent after PistonCore uninstall.
- **PyScript (fallback)** — only for pistons that use `break`, `cancel_pending_tasks`, or `on_event`. Rare edge cases. Clearly labeled as a dependency.

**Why native scripts, not simple YAML:** Native HA scripts handle variables, all loop types, waits, if/then/else, and more. Simple YAML is a strict subset of what native scripts can do. There is no reason to maintain a separate YAML compiler.

**Global variables:** Stored as native HA helpers managed by the companion. Input_text for Text, input_number for Number, input_boolean for Yes/No, input_datetime for Date/Time. No globals.json file. Compiled pistons read helpers via standard HA template syntax.

**Minimum HA version:** 2023.1

**Other locked decisions:**
- Backend: Python FastAPI
- Frontend: Vanilla JS, HTML, CSS — no framework
- Piston storage: JSON files in Docker volume (`pistoncore-userdata/pistons/`)
- Compiler output: Jinja2 snippet templates assembled by Python compiler
- Default port: 7777
- HA integration: WebSocket API for capability data, companion for file writes
- Two Docker volume folders: `pistoncore-userdata/` and `pistoncore-customize/`
- `configuration.yaml` addition: `script pistoncore: !include_dir_merge_named scripts/pistoncore/`
- All service calls in with_block compile with `continue_on_error: true` (WebCoRE resilience default)
- Automation `id:` field uses piston ID (stable); filename and alias use slug (changes on rename)

**File layout in HA:**
- `<ha_config>/automations/pistoncore/<slug>.yaml` — automation wrapper
- `<ha_config>/scripts/pistoncore/<slug>.yaml` — script body

**Docker volumes:**
- `/pistoncore-userdata/` — piston JSON files, globals store, config. Persists user data.
- `/pistoncore-customize/` — compiler templates, validation rules. User-editable.

**Storage layer (`storage.py`):**
- All filesystem I/O goes through `storage.py` — API layer never touches files directly
- Uses `PISTONCORE_DATA_DIR` env var to override `/pistoncore-userdata/` for local testing
- Piston files: `/pistoncore-userdata/pistons/<piston_id>.json`
- Globals: `/pistoncore-userdata/globals.json`
- Config: `/pistoncore-userdata/config.json`

**API layer (`api.py`):**
- Two distinct save operations — UI must make this unmistakable to users:
  1. `PUT /pistons/{id}` — saves JSON to Docker volume (fast, always works, no HA involvement)
  2. `POST /pistons/{id}/deploy` — compiles + writes to HA via companion (separate action)
- `POST /pistons/{id}/compile` — preview compiled YAML without writing anything (safe anytime)
- Deploy endpoint has a clearly labeled companion stub — replace when companion is built
manualy added:
 Add GET /api/devices endpoint to api.py — calls HA /api/states using stored token, returns filtered device list. Required for integrated.html to work.

---

## Key Design Decisions — Do Not Re-Litigate

**UI:**
- Piston list: single scrolling list, folder section headers, timestamps not relative time
- Editor: structured document, indented tree, WebCoRE keywords
- Navigation: List → Status Page → Editor → Status Page
- Keywords: execute/end execute (rendering only), define/end define, settings/end settings, if/when true/when false (editor), if/then/end if (status/export), with/do/end with, repeat/do/until/end repeat (until at bottom), for each/do/end for each, only when
- AND/OR: same indent level as conditions
- Ghost text insertion points: always visible
- Right-click context menu: copy/cut/duplicate/delete/clear clipboard
- Test button: always "Live Fire ⚠" with confirmation dialog (both compile targets fire real actions)

**Compiler:**
- execute/end execute is a rendering artifact — not a JSON node
- Jinja2 templates are snippet-level, not whole-file. Python makes decisions, templates hold HA syntax.
- wait until time → `wait_for_trigger` with time trigger (not delay math, not wait_template polling)
- wait until time always emits a CompilerWarning (past-time hang behavior) — see COMPILER_SPEC Section 14
- wait until time shows a ⓘ tooltip in the editor — see FRONTEND_SPEC wait tooltip section
- Variable scope caveat: variables set inside loops and read outside emit a warning, not a rewrite
- Slug format: lowercase, underscores, max 50 chars, collision → append piston ID prefix
- Automation `id:` field = piston ID (never changes). Filename and `alias:` = slug (changes on rename).
- Renaming a piston changes the slug, filename, and alias — HA treats it as a new automation entity
- `continue_on_error: true` on all service calls in with_block (matches WebCoRE fire-and-forget behavior)
- `wait_for_state` uses `continue_on_timeout: true`; branch on timeout via `{{ not wait.completed }}` if block

**Sharing:**
- Snapshot (green) = anonymized, safe to share
- Backup (red) = full with entity mappings, personal restore only
- No central server, no short codes

**Validation pipeline:**
- Stage 1: internal checks in Docker (always runs on save)
- Stage 2: compile to sandbox
- Stage 3: yamllint on sandbox files
- Stage 4: companion calls script.reload on sandbox (HA validates natively) — REMOVED, see COMPILER_SPEC open item 6
- Stage 5: pass → deploy, fail → nothing written to production

**Run status:**
- PISTONCORE_RUN_COMPLETE event fires on script completion
- If not received within 5 minutes (configurable), status shown as "unknown" — never "Running" indefinitely
- Long-running pistons (wait until a specific time hours away) will trigger this timeout normally

---

## Standing Rule — Validate Before Documenting or Coding

Before writing any new compiler logic, API endpoint, or design decision:
1. State what you are about to implement
2. Identify the COMPILER_SPEC or DESIGN.md section it comes from
3. Check for conflicts with existing locked decisions
4. Only then write code or update documentation

This rule exists because several sessions have produced work that had to be revised due to assumptions not matching the spec. The spec is the authority.

---

## Two Save Operations — Critical UI Distinction

There are two distinct save operations in PistonCore and users need to understand both:
1. Save to Docker volume (piston JSON) — fast, always works, no HA involvement
2. Deploy to HA (compiled files written, automation/script reload called) — separate action
The UI language and button labels need to make this distinction unmistakable.
Currently defined in DESIGN.md Section 13 and FRONTEND_SPEC but worth revisiting when UI
coding starts to make sure the distinction is obvious to a non-technical user.

**Commit messages:**
Ask Claude for better commit message names when committing to the repo.

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
Full design and correction session. No code written. DESIGN.md v0.7, FRONTEND_SPEC.md v0.1, WIZARD_SPEC.md v0.1 produced and pushed to repo.

### Session 6 — April 2026
Full spec update session. No code written. DESIGN.md v0.8, FRONTEND_SPEC.md v0.2, WIZARD_SPEC.md v0.2 produced incorporating all 32 Session 5 notes items.

### Session 7 — April 2026
Architecture confirmed: Native HA Script primary, PyScript fallback only. Five HA capability gaps researched. Perplexity conversation reviewed. DESIGN.md updated to v0.9. COMPILER_SPEC.md v0.1 written — full native script compiler spec. AI-UPDATE-GUIDE.md written for native-script templates and validation-rules folders. Binary sensor state values validated — HA always returns "on"/"off", never friendly labels. WIZARD_SPEC.md updated to v0.3: Binary section rewritten with display_value/compiled_value separation, device_class label table, corrected wizard internal state and condition object examples. COMPILER_SPEC.md updated: Binary State Values section added (Section 11), condition state example corrected. Standing validation rule added to session prompt.

### Session 8 — April 2026
No code written. Gemini external review processed and validated against HA docs. Four items resolved: (1) continue_on_error: true added as default on all with_block service calls — matches WebCoRE resilience behavior; (2) Past-time wait hang confirmed as real HA behavior — compile_wait() now always emits CompilerWarning for time-based waits, UI tooltip added; (3) Stale run detection added — 5-minute configurable timeout, never show "Running" indefinitely; (4) Automation id: vs slug clarified — id field uses piston ID (stable), filename and alias use slug (changes on rename). Two Gemini items confirmed already handled correctly: wait.completed branching works natively in HA (no compiler change needed), trigger data intentionally not forwarded to native script pistons (by design, PyScript-only). One Gemini item was a misread: piston variables are intentionally temporary (not a bug). Binary sensor null device_class fallback added to COMPILER_SPEC Section 11 and WIZARD_SPEC (defaults to On/Off). COMPILER_SPEC updated to v0.2, FRONTEND_SPEC updated to v0.5. WIZARD_SPEC and DESIGN.md unchanged.

### Session 9 — April 2026
First real coding session. compiler.py updated to COMPILER_SPEC v0.2 (merged from Grok skeleton + Claude additions): continue_on_error on all with_block service calls, past-time CompilerWarning on wait until, parallel multi-task with_block, for_loop added, completion event fires only in top-level sequence, called_by_piston omits automation file, AND/OR condition groups, full SHA-256 hash. All 18 Jinja2 snippet templates created and placed in pistoncore-customize/compiler-templates/native-script/snippets/. storage.py written — all filesystem I/O in one place, PISTONCORE_DATA_DIR env var for local testing. api.py written — full REST API with all endpoints. main.py written — FastAPI entry point port 7777. Driveway lights piston verified against COMPILER_SPEC Section 17 — output matches exactly. Repo cleaned up (stray modular compiler files removed). pistoncore-customize/ folder structure created and pushed.

---

## Last Session
Session 9 — April 2026. First coding session. Compiler updated to v0.2 spec, all 18 Jinja2 templates created, FastAPI skeleton (main.py, api.py, storage.py) built. Repo structure cleaned and organized. Deploy endpoint has companion stub — marked clearly for future implementation.

## Next Session — Start Here

**Note:** The repo may have stale files. Ask user to paste DESIGN.md, COMPILER_SPEC.md, and this session prompt if repo fetch fails or returns old versions.

1. Read DESIGN.md v0.9.1 (ask user to paste if needed)
2. Read COMPILER_SPEC.md v0.2 (ask user to paste if needed)

**Session 10 agenda:**
manualy added
Hash computed over wrong content — excludes header, spec says hash covers content below header only
Global variable writes emit comment stub not real YAML — _compile_set_variable() needs globals_store passed in and real service call output
_scan_globals() misses globals in expression strings — needs string scanning not just key scanning
only_when not wired into _compile_sequence() — already on list, now confirmed twice
for_loop body doesn't substitute loop variable — same pattern as for_each_block substitution

**Option A — Docker setup (recommended):**
- Write `requirements.txt` (fastapi, uvicorn, jinja2, pyyaml, websockets)
- Write `Dockerfile` — Python 3.12 slim, installs requirements, runs uvicorn on port 7777
- Write `docker-compose.yml` — two volume mounts, port 7777, env vars
- Test on Unraid test instance — verify container starts, /health returns ok, /pistons returns []
- Write a simple `docker-compose.unraid.yml` template for users

**Option B — Frontend scaffold (if cousin needs unblocked):**
- Scaffold `frontend/` folder with `index.html`, `styles.css`, `app.js`
- Implement piston list page against the live API
- Coordinate with cousin on what he has already built

**Option A is the right call** — Docker is the unlock that lets you actually run and test the backend on your Unraid instance. Without it the API exists but can't be used.

---

## Reference — HA Script Capability Gaps (Researched Session 7)

1. **Custom event on completion** — `event:` action in native scripts. Works cleanly. → `PISTONCORE_RUN_COMPLETE`
2. **Script entity ID format** — `script.pistoncore_<slug>`. Key names lowercase/underscores only.
3. **Script + automation pairing** — two files per piston. Labeled include avoids conflict with user's existing scripts.
4. **for_each over Devices variable** — works via Jinja2 template. Variable scope caveat documented.
5. **Minimum HA version** — 2023.1.

---

## Reference — Gemini Review Items (Session 8)

| Item | Verdict | Action taken |
|---|---|---|
| Past-time hang in wait_for_trigger | Confirmed real | CompilerWarning always emitted, UI tooltip added |
| Physical vs programmatic context | Confirmed unreliable | Already open item #3, not changed |
| Atomic reload kills running scripts | Already documented | No change — warning on deploy already in DESIGN.md |
| wait_for_state timeout branching | Gemini partially wrong | wait.completed works natively, no compiler change needed |
| $currentEventDevice in native scripts | Confirmed by design | Intentionally PyScript-only, already documented |
| Piston variable persistence | Gemini misread | Piston vars are intentionally temporary, no change |
| Automation id: vs slug | Real gap | Clarified in COMPILER_SPEC Section 6.1 |
| Binary sensor null device_class | Real gap | Fallback to On/Off added to COMPILER_SPEC Section 11 |
| continue_on_error on service calls | Good suggestion | Added as default in COMPILER_SPEC Section 8.1 |
| Stale run detection | Real gap | 5-minute timeout added to FRONTEND_SPEC Log Panel |
| Script variable scope in loops | Already documented | No change — warning system already in Section 8.9 |

---

## Reference — Key File Locations for the AI Update Guide System

```
/pistoncore-customize/compiler-templates/native-script/
  automation.yaml.j2          ✓ in repo
  script.yaml.j2              ✓ in repo
  AI-UPDATE-GUIDE.md          ✓ in repo
  snippets/                   ✓ all 18 files in repo

/pistoncore-customize/validation-rules/
  AI-UPDATE-GUIDE.md          ✓ in repo
  internal-checks.json        not yet created
  error-translations.json     not yet created

/pistoncore-customize/compiler-templates/pyscript/
  piston.py.j2                not yet written — PyScript compiler not yet designed
  AI-UPDATE-GUIDE.md          not yet written
```

---

## Reference — Open Items Compiler Not Yet Complete (COMPILER_SPEC Section 18)

1. **settings / end settings block** — contents undefined. Compiler ignores this block for now.
2. **PyScript compiler** — separate spec needed. Not started.
3. **Device event trigger (button/momentary)** — requires HA device ID. Backend must resolve role → device ID from HA device registry. No endpoint or data flow defined yet.
4. ~~**Devices variable storage format**~~ — RESOLVED.
5. **which-interaction step** — feasibility not confirmed. Not compiled until validated.
6. ~~**Stage 4 pre-deploy sandbox validation**~~ — REMOVED.
7. **Trace mode per-step events** — v1 trace does not emit per-step events. v2 feature.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
