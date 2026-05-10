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

## How to Start Every Session

1. Read this file completely before saying anything
2. Ask Jeremy to upload the relevant spec files and code files for what we're working on today
3. Read every uploaded file before writing any code or making any spec changes
4. Show proposed changes as text first — get approval before writing to files
5. Never remove existing spec content without explicit approval
6. Never write code that conflicts with the specs — specs are the authority

---

## Project Status — Session 39 Complete

### What Was Done in Session 39 (S2-1 — HAClient Abstraction)

**ha_client.py rewritten as HAClient class with module-level singleton.**

Auth mode auto-detected on construction:
- SUPERVISOR_TOKEN env var present → supervisor mode, URL = http://supervisor/core
- No SUPERVISOR_TOKEN → token mode, reads ha_url + ha_token from config.json

All existing module-level functions converted to instance methods. Public API
signatures unchanged — get_devices, get_capabilities, get_services, get_all_states,
get_services_for_domains, get_areas, get_ha_version, call_service, invalidate_cache.

**reload_config() added.**
Re-reads ha_url and ha_token from config.json and clears cache. No-op in supervisor
mode. Call from settings-save endpoint after writing new config.

**Bug 26 fixed:** ThreadPoolExecutor is now a persistent instance attribute
(self._executor), created once in __init__, reused across all _run() calls.
No more per-call pool creation and teardown.

**Bug 27 fixed:** get_services cache key changed from svc:{entity_id} to
svc:{domain}. Two entities in the same domain now share one cache entry.

**endpoints.json externalization skipped.** The WebSocket path (/api/websocket)
is stable HA protocol spec — not worth the file complexity. Decision final.

**GAP-S39-1:** api.py and compiler.py import ha_client functions via module-level
import. With the singleton pattern, callers must use
`from ha_client import ha_client` not `import ha_client`. Audit needed in S2-2
which already has api.py in scope.

**Next task: S2-2 — device_map_meta — Wire Into Backend and Wizard**
Upload: wizard.js, api.py, PISTON_FORMAT.md, DESIGN.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

---

### What Was Done in Session 38 (S2-0 — SQLite Error Logger)

**error_logger.py created (new file).**
Single ErrorLogger class. One table: error_logs. WAL mode enabled on init.
30-day purge runs on every startup. Module-level singleton — import `error_logger`
from anywhere in the backend that needs to log.

Schema columns: id, timestamp, piston_id, piston_name, level, code, message,
context, stack_trace, session_id, user_agent, ha_version, pistoncore_version, metadata.
Four indexes: timestamp, piston_id, level, code.
session_id / user_agent / ha_version / pistoncore_version stored as NULL for now.

Auto-captures active exception traceback on error-level log calls when no
stack_trace is passed and sys.exc_info()[0] is not None.

**main.py updated.**
Added: traceback import, Request to FastAPI imports, error_logger import.
Added: _log_unhandled_exceptions middleware — catches any unhandled exception
that escapes a route handler, logs it as UNHANDLED_EXCEPTION with method+path
as context, then re-raises so FastAPI still returns a 500.

**GAP-S38-1:** get_recent() has no /api/logs endpoint yet. Fits Stage 4.

---

### What Was Done in Session 37 (S-NESTED Session C — wizard.js audit + field name fixes)

**wizard.js audited and fixed. editor.js updated for GAP-S36-1 and GAP-S36-2.**

**GAP-S36-1 resolved:** `_blockId` stamp mechanism replaced with `meta` argument.
- `insertStatement(context, statementData, meta)` now accepts meta as third param.
- `_commitConditionAndMore` in wizard.js passes `{ blockId }` via meta instead of
  stamping `_blockId` on the condition data object.
- Editor reads `meta.blockId` cleanly. No spread/delete of statementData needed.

**GAP-S36-2 resolved:** `_deepReId(node)` added to editor.js.
- Recursively reassigns fresh IDs to every node in a cloned subtree.
- Covers statement nodes, else_if blocks, case blocks, condition nodes, task nodes.
- `_pasteSelected` now calls `_deepReId(clone)` instead of only re-IDing top node.

**GAP-S37-1 found and resolved same session:** `set_variable` value field fix.
- `_saveLocationCmd` for `set_variable` now reads `wiz-sv-valtype` selector.
- Wraps textarea content as `literal` / `variable` / `expression` operand object
  per STATEMENT_TYPES.md Section 13. Was writing a raw string before.

**wait field name fix:**
- `_saveLocationCmd` for `wait`: `unit` → `duration_unit`, `duration` parsed as int,
  `description: null, disabled: false` added for spec completeness.

**GAP-S27-4:** Confirmed closed — wizard skeleton already writes `start/end/step/
counter_variable` matching the corrected renderer. No code change needed.

**New gaps opened:** GAP-S36-3 (wait 'until'/'state' render branches untested —
deferred until wizard gets wait UI support).
**Gaps resolved:** GAP-S36-1, GAP-S36-2, GAP-S37-1, wait field name.

---

### What Was Done in Session 36 (S-NESTED Session B — editor.js)

**editor.js fully migrated to nested tree model.**

All statement tree operations now work directly on the nested object tree.
No flat statements array. No stmtMap. No ID references between statements.
Children live inside their parent nodes in then/else/statements/cases/default arrays.

**Functions rewritten:**
- `_actionLines(childNodes, depth, ...)` — accepts object arrays directly. stmtMap
  gone from signature and all 13 recursive calls.
- `_renderDocument` — passes `p.statements` objects directly. stmtMap build removed.
- `_findNode(id, nodes)` — recursive tree walk. Called as `_findNode(id)` from root.
  No map lookup. Searches then/else/statements/else_ifs/cases/default at every level.
- `_buildStmtMap` — deleted.
- `_findAnyNode` — updated call site to new `_findNode`.
- `_removeNode(id, nodes)` — recursive tree splice. Called as `_removeNode(id)` from root.
- `_insertAfter(targetId, newNode)` — finds owning array in tree, splices there.
- `_replaceNode(statementData, nodes)` — new helper. Replaces node in-place anywhere
  in tree. Called from `insertStatement` for update-in-place.

**`insertStatement` updated:**
- Uses `_replaceNode` for update-in-place (works at any depth, not just top level).
- `if_condition` branch uses `_findNode(blockId)` — no `_buildStmtMap()` call.
- Strips `_blockId` from condition before storing (routing metadata, not piston data).

**Field name bugs fixed:**
- `for` renderer: `node.from/to/variable` → `node.start/end/counter_variable`.
  `counter_variable` already includes `$` prefix in stored value — rendered directly.
- `switch` renderer: subject now reads `node.expression` (operand object, uses `_val()`).
  Default branch now reads `node.default` (not `node.default_statements`).
- `wait_for_state` renderer: now renders `node.conditions` array + timeout as
  multi-line block. Was incorrectly reading `node.condition` (singular).

**Other fixes:**
- GAP-S27-2: `else` branch renders only when `node.else.length > 0`. Empty array
  no longer produces a blank else line.
- `piston_text` generation removed from `save()`. Field is gone per PISTON_FORMAT.md v2.0.
- `_normalizePiston` added on load: checks logic_version/ui_version against supported
  max (throws on future version), removes malformed nodes recursively.

---

### Nested Tree Model — Summary (Sessions 35-37)

The statements array is a nested tree. Control flow nodes own their children directly.
`then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects.
No ID references between statements anywhere. The tree structure is explicit and
self-contained.

**Spec files updated this session:**
- `PISTON_FORMAT.md` — rewritten to nested tree model. `piston_text` field removed.
- `DESIGN.md` Section 6 — nested tree paragraph added to 6.1.
- `STATEMENT_TYPES.md` — all child array field descriptions updated to nested objects.
- `COMPILER_SPEC.md` — Section 7.2 and Section 9.3 updated for nested walk.

**compiler.py updated this session:**
- `_compile_sequence` — accepts list of statement objects directly. `stmt_map`
  build and ID resolution loop removed.
- `stmt_map` parameter removed from all control-flow methods.
- `_collect_triggers` — now recurses into nested children at any depth.
- `compile_piston` — `stmt_map` build removed, `_compile_sequence` called with
  raw statements list.

---

### What Was Done in Sessions 32-34

**S1-6: Fat compiler context assembly. COMPLETE.**
**S1-7 session 3: COMPLETE.** else_ifs, time condition fix, PyScript spec.
**S1-8: Template compliance pass. COMPLETE.** All compiler methods route through
Jinja2 templates. Zero inline HA YAML in Python. 15 new snippet templates.

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

## AI Prompt File Format Rule — Non-Negotiable

The AI prompt files (`write-a-piston.md` and `migrate-from-webcore.md`) must be
written against the **nested tree model only**.

Any AI generating flat ID-reference JSON (e.g. `"then": ["stmt_002"]`) will produce
pistons that break the editor. When S4-10 is reached, the nested format examples in
PISTON_FORMAT.md and COMPILER_SPEC.md Section 18 are the reference.

**Do not use any flat-model JSON examples anywhere in the prompt files.**

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
