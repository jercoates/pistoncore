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

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files and code files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority

---

## Project Status — Session 35 Complete

### What Was Done in Session 35 (Nested Tree Migration — Spec + compiler.py)

**Root cause identified and corrected.**

The flat statements array (implemented Sessions 26-28) stored child statements as
ID references rather than embedded objects. This made editor render reliability
dependent on correct maintenance of ID reference lists across every insert, remove,
move, and edit operation. Any bug in that maintenance produced silent render gaps.
Since Jeremy edits pistons constantly, this was unacceptable.

**Decision: migrate to nested tree model.**
Control flow nodes own their children directly. `then`, `else`, `statements`,
`else_ifs`, and `cases` contain child statement objects. No ID references between
statements anywhere. The tree structure is explicit and self-contained.

**Spec files updated this session:**
- `PISTON_FORMAT.md` — rewritten to nested tree model. `piston_text` field removed.
  GAP-S28-1/GAP-S27-1 (tasks embedded vs flat exception) resolved — now universal rule.
- `DESIGN.md` Section 6 — nested tree paragraph added to 6.1.
- `STATEMENT_TYPES.md` — all child array field descriptions updated to nested objects.
- `COMPILER_SPEC.md` — Section 7.2 and Section 9.3 updated for nested walk.
- `TASKS.md` — S-NESTED migration task added, superseded tasks marked.
- `CLAUDE_SESSION_PROMPT.md` — this file.

**compiler.py updated this session:**
- `_compile_sequence` — accepts list of statement objects directly. `stmt_map`
  build and ID resolution loop removed. Simpler and correct.
- `stmt_map` parameter removed from all control-flow methods:
  `_compile_if_block`, `_compile_repeat_block`, `_compile_while_block`,
  `_compile_for_each_block`, `_compile_for_loop`, `_compile_switch_block`,
  `_compile_do_block`.
- `_collect_triggers` — now recurses into nested children at any depth.
- `compile_piston` — `stmt_map` build removed, `_compile_sequence` called with
  raw statements list (objects, not IDs).

**What was NOT changed — all still valid:**
- All 15 Jinja2 templates — untouched
- All condition/trigger compilation logic — untouched
- The entire backend (api.py, ha_client.py, context_builder.py) — untouched
- All bugs fixed in Sessions 28-34 — untouched

**Tasks superseded by this migration:**
- S1-2b (editor.js flat array) — SUPERSEDED by S-NESTED Session B
- S1-2c (compiler.py flat array) — SUPERSEDED by S-NESTED Session A (this session)
- GAP-S28-1 / GAP-S27-1 — RESOLVED (no exception needed, all children are objects)
- GAP-S27-3 — RESOLVED (case.statements are nested objects)
- Bug A / _blockId hack — RESOLVED in Session B

**Next task: S-NESTED Session B — editor.js**
Upload: editor.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, TASKS.md,
CLAUDE_SESSION_PROMPT.md

---

### What Was Done in Sessions 32-34

**S1-6: Fat compiler context assembly. COMPLETE.**

**context_builder.py — new file:**
- `ContextBuildError` exception class.
- `build_compiler_context(piston)` — assembles full fat context per COMPILER_SPEC
  Section 7. Aborts on entity_states failure. All other HA fetches degrade
  gracefully. Zones filtered from entity_states (no extra call). globals dict
  converted to list. piston_variables pass-through.

**ha_client.py changes:**
- `get_all_states()` / `_fetch_all_states()` — WebSocket get_states, returns
  `{entity_id: {state, attributes}}`. Raises HAClientError on failure.
- `get_services_for_domains(domains)` / `_fetch_services_for_domains()` —
  WebSocket get_services, filters to requested domains. Degrades gracefully.
- `get_areas()` / `_fetch_areas()` — WebSocket area_registry/list. Degrades.
- `get_ha_version()` / `_fetch_ha_version()` — reads `ha_version` from
  `auth_ok` WebSocket handshake. Returns "unknown" on any failure.

**api.py changes:**
- Added `import context_builder` and `from context_builder import ContextBuildError`.
- `_compile()` rewritten — calls `build_compiler_context()`, handles
  `ContextBuildError` with `CONTEXT_BUILD_ERROR` code. Stub dict removed.
- `_get_app_version()` removed — dead code after rewrite.

**S1-7 session 3: COMPLETE.**

**compiler.py changes:**
- `_compile_if_block` rewritten — else_ifs array now compiled.
- `_compile_time_condition` "is" operator fixed — ±1-second bracket with midnight rollover.

**Template changes:**
- `snippets/if_block.yaml.j2` — added `compiled_else_ifs` loop.
- `snippets/condition_time.yaml.j2` — added `exact_time_warning` comment variable.

**Spec changes:**
- `PYSCRIPT_COMPILER_SPEC.md` Section 4.1 added. Closes MISSING_SPECS Item 16.

**Gaps still open from Sessions 32-34:**
- GAP-S34-1: _compile_single_condition has no warnings param. Low priority.
- GAP-S33-2: condition_and/or template indentation needs real-world testing → S3-2.
- Bug 26 (ThreadPoolExecutor) → S2-1
- Bug 27 (get_services cache per entity) → S2-1
- Bug 28 (_field_type entity_id selector) → S2-2

**S1-8: Template compliance pass. COMPLETE.**

All compiler methods route through Jinja2 templates. Zero inline HA YAML in Python.
15 new snippet templates created. AI-UPDATE-GUIDE.md updated.

---

### What Was Done in Session 31 (S1-5: HA Direct Write)

- `_setup_ha_config()` startup hook — configuration.yaml setup, output dirs created.
- ha_client.py: `call_service()` added for automation.reload, script.reload.
- Full deploy endpoint — compile, hash mismatch detection, file write, reload.
- `_check_hash_mismatch()` helper.
- `delete_piston()` — removes compiled HA files, calls reload.
- automation_yaml.j2: GAP-S30-8 fixed — standardized to `{{ piston_id }}`.
- backend/README.md: companion references removed, first-run warning added.

**Gaps still open from Session 31:**
- GAP-S31-2: _setup_ha_config() errors not surfaced to UI → S4-0
- GAP-S31-3: PyScript deploy not implemented → S1-7 session 2
- GAP-S31-5: ha_config_path has no UI → blocked by Settings spec
- GAP-S31-6: endpoints.json dead reference → low priority

---

### What Was Done in Session 30 (S1-4: Backend Cleanup)

- `_compile()` rewritten — fat context dict, CompilerResult unpack.
- `_send_to_companion()` removed. Compile-on-save removed.
- `_validate_device_map()` added. `_migrate_piston()` hook added.
- BASE_URL injection, /ws WebSocket stub, 501 stubs for import/export.
- TemplateError caught. piston_text never-parsed comments added.

**Backend gaps still open:**
- GAP-S29-11: No Pydantic validation on piston save — deferred
- GAP-S30-3: Double config load per compile. Low priority.

---

## Spec File Authority Order

When specs conflict, this is the resolution order:
1. DESIGN.md — philosophy and architecture decisions
2. PISTON_FORMAT.md — canonical data format
3. STATEMENT_TYPES.md — statement-level schemas and render output
4. COMPILER_SPEC.md — compiler behavior (current as of Session 35)
5. PYSCRIPT_COMPILER_SPEC.md — PyScript compiler (written Session 24 — current)
6. FRONTEND_SPEC.md — frontend behavior (current as of Session 24)
7. WIZARD_SPEC.md — wizard behavior (current as of Session 24)
8. HA_LIMITATIONS.md — known HA gotchas
9. AI_PROMPT_SPEC.md — AI prompt file requirements

---

## Build Target — Docker Now, Addon Last

**Current build target is Docker.** All development and testing happens in Docker
on Unraid (port 7777). This is not a compromise — Docker is the right dev environment.

**Addon packaging comes last** — after Docker is solid and fully functional.
The addon and Docker share the same codebase. Packaging as an addon is a separate
step that happens at the end, not a parallel track. Do not write addon packaging
specs or code until Docker is complete.

The addon IS the end goal and primary product. Docker is how we get there cleanly.

---

## V1 Definition Rule

**If it is not explicitly deferred to v2 or v3 in the specs, it is v1.**

No separate v1 feature list needed. DESIGN.md Sections 28 and 29 define what is
in scope and what is deferred. Everything in scope is v1.

---

## Reference Folder

The repo contains a `reference/` folder with session handoff notes, external
design reviews, and captured decisions from past sessions.

**What goes in reference/:**
- SESSION_XX_HANDOFF.md files after they are processed
- External AI review files (e.g., AIReviews5-6-26.md)
- Any captured decision or context document that should be preserved but is not
  a living spec

**Policy — move, don't delete:**
After processing a handoff note or review file at the start of a session, move it
to `reference/` rather than deleting it. Nothing gets lost. The working root stays
clean.

**File naming:** Keep original filenames. Session handoff files use the pattern
`SESSION_XX_HANDOFF.md`. Review files keep whatever name they were given.

**Before starting any task that might have prior context:** Ask Jeremy if a relevant
reference file exists before proceeding.

---

## Reference Documents

In addition to the spec files, always check:
- **TASKS.md** — what to work on and in what order (always upload this)
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
Without it, BASE_URL defaults to localhost:7777 which only works when browser
and server are on the same machine.

---

## Template Rule — Non-Negotiable

**ALL HA YAML syntax must go through Jinja2 templates in the customize volume.**
Never emit HA YAML structure as Python inline strings in compiler methods.
If you find inline YAML in Python, that is a bug — add it to TASKS.md immediately.

Templates exist so HA syntax changes require only a template edit, never a
Python code release. This is core to the architecture per DESIGN.md and
AI-UPDATE-GUIDE.md. This rule has been violated three times and caught by
Jeremy each time. It is non-negotiable — there are no exceptions.

---

## Code Review Requirement — Every Coding Session

**Standing rule from Jeremy:** All problems must be addressed as we go — either
fix it now if the fix fits the current session's file scope, or add it to TASKS.md
if it is better done later or needs a totally separate context. No problem gets
ignored or mentioned in passing without one of those two outcomes.

After writing or modifying any code, before ending the session, Claude must:

1. Review all changed functions for gaps between what the code does and what the
   spec requires — field names, model assumptions, missing cases, wrong signatures.
2. Review all call sites of changed functions for broken callers not yet updated.
3. Check for any implicit assumptions in the new code that are not confirmed by
   the spec or by inspecting the other files in context.
4. For each gap found:
   - If it is a small fix that fits the current session's file scope — fix it now.
   - If it requires a different file or separate context — add it to TASKS.md as
     a named gap entry (GAP-SXX-N format) with: what the problem is, where it was
     found, what needs to happen, and which session/task it fits into.
5. Report all gaps found (fixed or deferred) before closing the session.

This is not optional. A session that produces code without a gap review is incomplete.

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.
