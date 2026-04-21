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

**Important:** The repo may have a cached/stale version of files. If fetching from the repo fails or returns an old version, ask the user to paste the files directly.

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
- `FRONTEND_SPEC.md` — frontend developer specification **v0.3**
- `WIZARD_SPEC.md` — wizard capability map and behavior **v0.3**
- `COMPILER_SPEC.md` — compiler specification **v0.1 (updated)** — **read this before any compiler work**
- `CLAUDE_SESSION_PROMPT.md` — this file
- `LICENSE` — MIT

### session2_archive/
Contains all code from Session 2. Built against an earlier design — kept for reference only.
Do not build on top of it directly.

### What does NOT exist yet (needs to be built):
- Backend FastAPI skeleton
- Docker container setup
- Compiler templates (Jinja2 files)
- Companion integration
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
- Piston storage: JSON files in Docker volume
- Compiler output: Jinja2 snippet templates assembled by Python compiler
- Default port: 7777
- HA integration: WebSocket API for capability data, companion for file writes
- Two Docker volume folders: pistoncore-userdata/ and pistoncore-customize/
- configuration.yaml addition: `script pistoncore: !include_dir_merge_named scripts/pistoncore/`

**File layout in HA:**
- `<ha_config>/automations/pistoncore/<slug>.yaml` — automation wrapper
- `<ha_config>/scripts/pistoncore/<slug>.yaml` — script body

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
- Variable scope caveat: variables set inside loops and read outside emit a warning, not a rewrite
- Slug format: lowercase, underscores, max 50 chars, collision → append piston ID prefix

**Sharing:**
- Snapshot (green) = anonymized, safe to share
- Backup (red) = full with entity mappings, personal restore only
- No central server, no short codes

**Validation pipeline:**
- Stage 1: internal checks in Docker (always runs on save)
- Stage 2: compile to sandbox
- Stage 3: yamllint on sandbox files
- Stage 4: companion calls script.reload on sandbox (HA validates natively)
- Stage 5: pass → deploy, fail → nothing written to production

---

## Standing Rule — Validate Before Documenting or Coding

**Any new logic choice, assumption about how HA works, or technical approach must be validated
against real HA behavior BEFORE it is written into a spec or implemented in code.**

This rule exists because incorrect assumptions propagate through all downstream documents and
code. It is cheaper to run a search and confirm than to rewrite a spec section later.

**Examples of things that must be validated first:**
- How HA returns state values for a device type (e.g. binary sensors return "on"/"off" not "open"/"closed")
- Whether a native HA script feature works the way we think it does
- Whether a WebSocket API command returns the data we expect
- Any compiler output that hasn't been hand-verified against real HA YAML examples

**How to validate:** Web search against current HA docs, fetch the HA source or developer docs,
or check real HA community examples. Claude runs these checks before producing any new spec
content or code when a new technical approach is being designed.

---

## Open Items — Do Not Start These Without Resolving First

1. **settings / end settings block contents** — research WebCoRE behavior, define before implementing
2. **AI Prompt feature redesign** — needs friendly name context without entity IDs (DESIGN.md Section 11)
3. **Which-interaction step feasibility** — PyScript context tracking, needs sandbox validation (DESIGN.md Section 8.6)
4. **Timer statement** — evaluate overlap with HA scheduler before including in v1 (DESIGN.md Section 22)
5. ~~**Devices variable storage format**~~ — **RESOLVED.** Device and Devices globals are compile-time values, resolved from PistonCore's device_map and baked as literal entity ID lists into compiled YAML. No HA helper needed. Stale-tracking handles redeployment when the list changes. See DESIGN.md Sections 4.1 and 19, COMPILER_SPEC.md Section 8.7.
6. **PyScript compiler** — separate spec needed, not started. Only needed for break/cancel_pending_tasks/on_event.
7. **make_web_request PyScript-only designation** — validate whether native HA scripts can call rest_command as an alternative before locking this in. May not need to be PyScript-only. (WIZARD_SPEC.md system commands table)
8. **System variables in native script pistons** — HA trigger variables expose some context (trigger.entity_id, trigger.to_state etc.) in native scripts. Research whether this partially covers the gap before requiring PyScript for all system variable use.

---

## Jeremy's Notes — Things to Make Sure Don't Get Lost

These are personal reminders that must be addressed before coding gets too far. Raise these
at the start of any session where they haven't been addressed yet.

**Debugging — what is actually possible:**
What can a user see when a piston misbehaves? Need to define this clearly before coding:
- Trace mode and statement numbers — already in design
- The run log on the status page — already in design
- HA logbook entries from the completion event — confirm what shows up
- What a user actually sees when a native HA script fails mid-run (no completion event fired)
- Whether there's a way to surface HA's own script error messages back to PistonCore UI
This needs a dedicated design pass before the logging/debugging code is written.

**Save status — two different saves, make sure the UI is crystal clear:**
There are two distinct save operations in PistonCore and users need to understand both:
1. Save to Docker volume (piston JSON) — fast, always works, no HA involvement
2. Deploy to HA (compiled files written, automation/script reload called) — separate action
The UI language and button labels need to make this distinction unmistakable.
Currently defined in DESIGN.md Section 13 but worth revisiting when UI coding starts
to make sure the distinction is obvious to a non-technical user.

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

---

## Last Session
Session 7 — April 2026. All spec files updated. Design claude feedback processed — four fixes applied: FRONTEND_SPEC v0.3 (test button unified to Live Fire ⚠, compile target labels corrected, two-save distinction made explicit, stale mode notice removed), COMPILER_SPEC updated (Section 8.9 scope caveat fully defined with compiler behavior and why namespace pattern doesn't work), DESIGN.md v0.9.1 (helper manifest format and storage location defined, Section 27 expanded). Jeremy's personal notes captured in session prompt as tracked items. AI-REVIEW-PROMPT.md added to repo.

## Next Session — Start Here

**Note:** The repo may have stale files. Ask user to paste DESIGN.md, COMPILER_SPEC.md, FRONTEND_SPEC.md, WIZARD_SPEC.md, and this session prompt if repo fetch fails or returns old versions.

1. Read DESIGN.md v0.9 from the repo (or ask user to paste)
2. Read COMPILER_SPEC.md v0.1 from the repo (or ask user to paste)
3. Read FRONTEND_SPEC.md v0.2 and WIZARD_SPEC.md v0.2 if working on frontend/wizard

**Recommended Session 8 agenda (pick one track):**

**Track A — Begin backend scaffolding:**
- Scaffold FastAPI project structure
- Implement `compile_piston()` entry point from COMPILER_SPEC.md Section 5
- Implement `slugify()` and all trigger compilers (Section 6.3)
- Implement `with_block` and `wait` statement compilers (Section 8.1, 8.2) — enough to compile the driveway lights piston end to end
- Verify output matches the hand-written example in COMPILER_SPEC.md Section 16

**Track B — Begin frontend scaffolding:**
- Scaffold the three-page SPA structure (List, Status, Editor)
- Implement the piston list page with static mock data
- Implement folder section headers and piston rows

**Track C — Push all spec files to repo then poll other AIs:**
- Push DESIGN.md v0.9, COMPILER_SPEC.md v0.1, both AI-UPDATE-GUIDE.md files, updated session prompt
- Poll Grok, Gemini, Perplexity against the updated specs
- Collect feedback on COMPILER_SPEC.md specifically — are there HA script behaviors we've missed?

**Do not write production code until all spec files are in the repo and the user has confirmed which track to follow.**

---

## Reference — HA Script Capability Gaps (Researched Session 7)

These were the five gaps researched. Keeping here for reference:

1. **Custom event on completion** — `event:` action in native scripts. Works cleanly. → `PISTONCORE_RUN_COMPLETE`
2. **Script entity ID format** — `script.pistoncore_<slug>`. Key names lowercase/underscores only.
3. **Script + automation pairing** — two files per piston. Labeled include avoids conflict with user's existing scripts.
4. **for_each over Devices variable** — works via Jinja2 template. Variable scope caveat documented.
5. **Minimum HA version** — 2023.1.

---

## Reference — Key File Locations for the AI Update Guide System

```
/pistoncore-customize/compiler-templates/native-script/
  automation.yaml.j2
  script.yaml.j2
  snippets/                   (one file per statement/trigger/condition type)
  AI-UPDATE-GUIDE.md          ← written in Session 7

/pistoncore-customize/compiler-templates/pyscript/
  piston.py.j2                (not yet written — PyScript compiler not yet designed)
  AI-UPDATE-GUIDE.md          (not yet written)

/pistoncore-customize/validation-rules/
  internal-checks.json
  error-translations.json
  AI-UPDATE-GUIDE.md          ← written in Session 7
```

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
