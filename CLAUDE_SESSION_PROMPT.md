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

**The wizard is the current top priority. Nothing else gets worked on until the
wizard works end-to-end on a simple piston.**

The backend, compiler, and editor have all been through major structural work.
The blocking problem is the wizard — it cannot produce valid JSON for even a
simple if/then/action piston reliably. Until the wizard works, nothing else
in the stack can be tested or verified.

All Stage 2 backend tasks (S2-2 through S2-4) are deferred until after the
wizard works and the round-trip smoke test (S3-1) passes.

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
which already has api.py in scope — deferred until after wizard is working.

**Decision end of Session 39:** Stage 2 backend work (S2-2 through S2-4) is
deferred. The wizard is broken and is the real blocker. Next work is a full
wizard rebuild spec written against the WebCoRE source code.

**Next task: W-0 — Wizard Rebuild Spec**
Upload: wizard.js, CLAUDE_SESSION_PROMPT.md, TASKS.md,
app.js (WebCoRE), piston.module.html (WebCoRE), dashboard.module.html (WebCoRE)

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
**GAP-S36-2 resolved:** `_deepReId(node)` added to editor.js.
**GAP-S37-1 found and resolved same session:** `set_variable` value field fix.
**wait field name fix:** unit → duration_unit, duration parsed as int.
**GAP-S27-4:** Confirmed closed.

---

### What Was Done in Session 36 (S-NESTED Session B — editor.js)

**editor.js fully migrated to nested tree model.**
All statement tree operations now work directly on the nested object tree.
No flat statements array. No stmtMap. No ID references between statements.

---

### Nested Tree Model — Summary (Sessions 35-37)

The statements array is a nested tree. Control flow nodes own their children directly.
`then`, `else`, `statements`, `else_ifs`, and `cases` contain child statement objects.
No ID references between statements anywhere.

---

### What Was Done in Sessions 32-34

**S1-6: Fat compiler context assembly. COMPLETE.**
**S1-7 session 3: COMPLETE.** else_ifs, time condition fix, PyScript spec.
**S1-8: Template compliance pass. COMPLETE.**

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
8. WIZARD_REBUILD_SPEC.md — wizard rebuild target (to be written in W-0)
9. HA_LIMITATIONS.md — known HA gotchas
10. AI_PROMPT_SPEC.md — AI prompt file requirements

**When WIZARD_REBUILD_SPEC.md exists, it supersedes WIZARD_SPEC.md.**

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

This is not optional. A session that produces code without a gap review is incomplete.

---

## Communication Style

Jeremy works two jobs and codes in limited sessions. He has no formal
programming background. Direct and concise. Plain language over technical
jargon. Show proposed changes as text before writing files. Humor is welcome.

When something is unclear, ask one question — not five.
