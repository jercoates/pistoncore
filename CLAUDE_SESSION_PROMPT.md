# PistonCore — Claude Session Prompt

**Project:** PistonCore — open-source WebCoRE-style visual automation builder for Home Assistant
**Repo:** github.com/jercoates/pistoncore
**Stack:** Python/FastAPI backend, Vanilla JS/HTML/CSS frontend, no framework
**Deploy:** Docker container (Unraid) — port 7777

---

# Core Mission — Read This First

PistonCore has two equally important goals that must never be confused:

**1. The editor and wizard must feel like WebCoRE.**
Users coming from WebCoRE on Hubitat must be able to move their pistons over
without major relearning. Same concepts, same terminology, same workflow, same
visual structure. If a WebCoRE user has to stop and think "how do I do this in
PistonCore," that's a failure. Match WebCoRE's UI and behavior exactly unless
there is a documented reason not to.

**2. The compiler output must produce the same end-result behavior in HA.**
PistonCore outputs PyScript (complex pistons) or native HA YAML (simple pistons).
The compiled output does not need to look like WebCoRE's Groovy code. It just
needs to do the same thing in practice — same triggers, same logic flow, same
actions, same outcomes. If the piston announced which door opened in WebCoRE,
it must announce which door opened in HA.

**The tiebreaker for compiler decisions:** does it produce the right behavior in HA?
**The tiebreaker for UI/wizard decisions:** does it match what WebCoRE users expect?

---

# Non-Negotiable Requirement — Read Before Any Architecture Discussion

**The editor must render from JSON correctly 100% of the time, every time, without fail.**

This is the foundation the entire project rests on. Jeremy opens and edits pistons
constantly. If a piston ever renders incorrectly after an edit — missing statements,
wrong structure, orphaned nodes — the tool has failed at its core purpose.

This requirement overrides any argument about implementation convenience. It is why
the data model was migrated from flat ID references to a nested tree in Session 35.
Do not propose solutions that trade render reliability for implementation simplicity.

---

# Decision Stability Rule

Once a decision is made and documented in a spec, do not revisit or argue against it.

**Exception: if a prior decision breaks the end result the project exists to deliver.**

The nested tree migration in Session 35 is the model for this exception — the flat
model was a documented decision that turned out to break the non-negotiable requirement
above. The decision was correctly reversed. That reversal was right because the end
result (100% reliable editor rendering) was at stake.

If Claude finds itself arguing that a documented decision should stay even though it
breaks the non-negotiable requirement, that is wrong. The requirement wins.

If Claude finds itself arguing to revisit a decision for any other reason — preference,
elegance, theoretical correctness — that is wrong. The spec wins.

---

# File Editing Rule — Non-Negotiable

**Jeremy does not edit files manually. He will only add content to the top or bottom
of a file. Any change that requires editing the middle of a file must be delivered
as a complete replacement file. No diffs, no line-number instructions, no partial
patches. If it needs a middle edit, write the whole file.**

---

# Wizard Priority Rule — Current Focus

**The wizard core bugs are fixed. The next priority is the smoke test (W-S5 / S3-1).**

Deploy the fixed wizard.js and editor.js, build Docker, and run the 14-step minimum
viable piston flow from WIZARD_REBUILD_SPEC.md. If the smoke test passes, Stage 2
backend work resumes. If it fails, document exactly which step fails and fix only that.

All Stage 2 backend tasks (S2-2 through S2-4) remain deferred until the smoke test passes.

**WebCoRE match rule (permanent):**
Match WebCoRE exactly for all dialog flow, field behavior, and data collection —
the if/condition/action/task dialogs, the operand picker, the device selector, all of it.
PistonCore improvements are fine for the main screen layout, the debug/log screen,
and globals being accessible from anywhere. Those are upgrades, not regressions.
Do not accidentally revert intentional improvements.

---

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files and code files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority

---

## Project Status — Session 40 Complete

### What Was Done in Session 40 (W-0 + W-S1 through W-S4)

**WIZARD_REBUILD_SPEC.md written.**
Complete spec of every wizard dialog, every field, every JSON output, every device
picker rule, complete 14-step minimum viable piston flow, and 7 bugs in fix order.
Written from WebCoRE source (webcore1.txt, webcore3.txt) against PISTON_FORMAT.md
and STATEMENT_TYPES.md. Now in the repo as authoritative wizard target.

**wizard.js — 7 bugs fixed + additional improvements:**

Bug 1 — Condition subject format: `_buildConditionNode()` now writes the `subject`
object the editor reads. Previous flat `role`/`attribute` fields caused conditions
to render blank in the editor. Now writes:
`{ type:'device', role:'...', entity_id:'...', capability:'...', attribute_type:'...', device_class:null }`

Bug 2 — Statement inserted at wrong level: All statement types (timer, repeat,
for_each, skeletons: do/switch/while/on_event/for/break/exit) now pass
`{ blockId, branch }` meta through to editor on insert.

Bug 3 — Piston variables missing from device picker: All pickers now call
`Editor.getPistonVariables()` filtered to `var_type === 'device'` and show them
under "Piston variables" section.

Bug 4 — Wrong/duplicate HA entities: `ALLOWED_DOMAINS` constant added.
`_filterDevices()` helper applies domain filter + entity_id deduplication.
Applied to `_renderActDevList`, `_renderDevPanelList`, `_renderVarInitDevList`.

Bug 5 — `ha_service` wrong: `_saveDeviceCmd()` now writes `domain + '.' + command`
(e.g. `light.turn_on` not `turn_on`). `devices` array uses role labels not entity_ids.

Bug 6 — AND/OR between conditions: AND/OR selector visible in condition builder
when context is `if_condition`. Written to `group_operator` on condition node.

Bug 7 — Delete: Confirmed working. No code change needed.

Additional: `_goForEachPicker()` upgraded with variable dropdown filtered to
device-type piston vars (with custom name fallback). Section labels standardized
to "Piston variables" everywhere.

**editor.js — branch insertion fix:**
`insertStatement()` now handles `meta.blockId` + `meta.branch`. Statements inserted
inside `if.then`, `if.else`, or `node.statements` land in the correct child array
instead of always appending to the top level.

**Next task: W-S5 — Smoke Test**
Deploy, build Docker, run 14-step flow from WIZARD_REBUILD_SPEC.md.
Upload: WIZARD_REBUILD_SPEC.md, wizard.js, editor.js, PISTON_FORMAT.md,
STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### What Was Done in Session 39 (S2-1 — HAClient Abstraction)

**ha_client.py rewritten as HAClient class with module-level singleton.**
Auth mode auto-detected. reload_config() added. Bug 26 fixed. Bug 27 fixed.
endpoints.json externalization skipped (decision final).
GAP-S39-1 opened → assigned to S2-2 (deferred).

---

### What Was Done in Session 38 (S2-0 — SQLite Error Logger)

**error_logger.py created. main.py updated.**
GAP-S38-1 opened → assigned to S2-2 (deferred).

---

### What Was Done in Session 37 (S-NESTED Session C)

wizard.js audited and fixed. editor.js updated for GAP-S36-1 and GAP-S36-2.
wait field name fixed. GAP-S27-4 confirmed closed.

---

### What Was Done in Session 36 (S-NESTED Session B)

editor.js fully migrated to nested tree model. No flat statements array.
No stmtMap. No ID references between statements.

---

### Nested Tree Model — Summary (Sessions 35-37)

The statements array is a nested tree. Control flow nodes own their children directly.
`then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects.
No ID references between statements anywhere.

---

### What Was Done in Sessions 32-34

S1-6: Fat compiler context assembly. COMPLETE.
S1-7 session 3: COMPLETE. else_ifs, time condition fix, PyScript spec.
S1-8: Template compliance pass. COMPLETE.

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior (current as of Session 35)
5. PYSCRIPT_COMPILER_SPEC.md — PyScript compiler (written Session 24 — current)
6. FRONTEND_SPEC.md — frontend behavior (current as of Session 24)
7. WIZARD_REBUILD_SPEC.md — wizard rebuild target (written Session 40 — supersedes WIZARD_SPEC.md)
8. HA_LIMITATIONS.md — known HA gotchas
9. AI_PROMPT_SPEC.md — AI prompt file requirements

**WIZARD_REBUILD_SPEC.md supersedes WIZARD_SPEC.md for all wizard behavior.**

---

## AI Prompt File Format Rule — Non-Negotiable

The AI prompt files must be written against the **nested tree model only**.
Any AI generating flat ID-reference JSON will produce pistons that break the editor.

---

## Build Target — Docker Now, Addon Last

**Current build target is Docker.** Addon packaging comes last.

---

## V1 Definition Rule

**If it is not explicitly deferred to v2 or v3 in the specs, it is v1.**

---

## Reference Folder

The repo contains a `reference/` folder with session handoff notes and captured
decisions. Move processed files there, don't delete them.

---

## Reference Documents

- **TASKS.md** — what to work on and in what order (always upload this)
- **WIZARD_REBUILD_SPEC.md** — authoritative wizard target (always upload for wizard sessions)
- **MISSING_SPECS.md** — specs that must be written before certain tasks can be coded

---

```bash
cd /mnt/user/appdata/pistoncore-dev
git pull
docker build -t pistoncore .
docker stop pistoncore && docker rm pistoncore
docker run -d \
  --name pistoncore \
  --restart unless-stopped \
  -p 7777:7777 \
  -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata \
  -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize \
  pistoncore
```

**PISTONCORE_BASE_URL env var:** Set this in docker-compose.yml to your Unraid
server IP so the frontend can reach the backend from other machines on the LAN.
Example: `PISTONCORE_BASE_URL=http://192.168.1.10:7777`

---

## Template Rule — Non-Negotiable

**ALL HA YAML syntax must go through Jinja2 templates in the customize volume.**
Never emit HA YAML structure as Python inline strings in compiler methods.

---

## Code Review Requirement — Every Coding Session

After writing or modifying any code, before ending the session, Claude must:

1. Review all changed functions for gaps between what the code does and what the
   spec requires.
2. Review all call sites of changed functions for broken callers not yet updated.
3. Check for any implicit assumptions in the new code not confirmed by the spec.
4. For each gap found: fix it now if it fits the current session scope, or add
   it to TASKS.md as a named gap entry (GAP-SXX-N format).
5. Report all gaps found (fixed or deferred) before closing the session.

**Gap Assignment Rule — Non-Negotiable:**
Every gap must be assigned to the most logical future session before this session
closes. Assign to the session where the relevant file is already open, or where
the fix fits naturally in sequence. Never assign to a random session — assign to
the right one. A gap assigned to the wrong session forces unnecessary file loading
and context switching, which is exactly what this project is trying to avoid.

This is not optional. A session that produces code without a gap review is incomplete.

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.
