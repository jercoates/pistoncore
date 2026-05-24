# PistonCore — Missing Specs Tracker

**Status:** Living document — add to this when a gap is found, remove when the spec is written
**Last Updated:** Session 62 — Items 25/26/27 resolved. All MISSING_SPECS items now resolved. Item 15 (write-a-piston.md prompt content) deferred intentionally.
**Purpose:** Track spec gaps that will block coding when we reach those features.
           Every item here must be resolved before its dependent task is started.

---

## How to Use This File

When a feature is coming up in TASKS.md and its spec is listed here as missing,
write the spec first — dedicate a session to it if needed. Do not code against
a missing or incomplete spec.

When a spec is written, move the item from this file to DONE at the bottom.

---

## 1. PyScript Compiler Spec — RESOLVED (Session 24)

PYSCRIPT_COMPILER_SPEC.md written and complete. All 6 gaps resolved.
Status changed to READY TO CODE.
See PYSCRIPT_COMPILER_SPEC.md for full spec.

---

## 2. WebSocket Message Protocol — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into FRONTEND_SPEC.md v1.2 — "WebSocket Protocol — Backend-to-Frontend Messages" section.
Covers: hello handshake, PISTONCORE_LOG shape, PISTONCORE_RUN_COMPLETE shape, ha_status events, error events, ping/pong keep-alive, message size limits, throttling, HA reconnect events.

---

## 3. Settings Page Frontend Spec — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into FRONTEND_SPEC.md v1.2 — "Settings Page" section.
Covers: page layout, HA Connection section (Docker vs Addon), PistonCore section, My Device Definitions section, Global Variables section (create/edit/delete flows), error state when HA is disconnected, token storage guidance, token rotation instructions.

---

## 4. Piston List — Folder Management Flow — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into FRONTEND_SPEC.md v1.2 — "Piston List — Folder Management" section.
Covers: create (inline input, validation), rename (right-click context menu, inline edit), delete (pistons move to Uncategorized), move piston (status page dropdown + drag and drop), sort order (alphabetical, Uncategorized always last), empty folder behavior (shown with count 0), collapsed/expanded state persistence via localStorage.

---

## 5. Error States Inventory — RESOLVED (Session 60 / D-S4 Step 4)

Full spec written into FRONTEND_SPEC.md v1.2 — "Error States Inventory" section.
Covers all error categories: connection errors, save/deploy errors, piston list errors, import errors, global redeploy errors. Each error includes exact user-visible text, available actions, whether it blocks the current operation, and whether last good state is preserved.

---

## 6. Test Strategy — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into **TEST_STRATEGY.md** (repo root).
Covers: manual vs automated testing, round-trip test procedure, HA version matrix,
known edge cases to verify, "done" definition per stage.

---

## 7. Storage Architecture — RESOLVED (Session 60 / D-S4)

**Status:** RESOLVED. The SQLite schema and storage architecture are fully defined below.
This was previously marked MISSING in the body — corrected this session.

### What Already Has a Defined Home (do not relitigate)
- Piston JSON files → `/pistoncore-userdata/pistons/{uuid}.json`
- Global variables list → `/pistoncore-userdata/globals.json`
- Global variables index → `/pistoncore-userdata/globals_index.json`
- Custom device definitions → `/pistoncore-userdata/device-definitions/`
- PistonCore config → `/pistoncore-userdata/config.json`
- Pending cleanup queue → `/pistoncore-userdata/pending_cleanup.json`
- Clipboard → `/pistoncore-userdata/clipboard.json`
- All customize volume files → `/pistoncore-customize/`

### SQLite Database — `/pistoncore-userdata/pistoncore.db`

**Access:** Direct `sqlite3` module (no SQLAlchemy). Keep queries raw and simple.
**Created:** On first launch if not present. Schema applied via `CREATE TABLE IF NOT EXISTS`.
**Corrupt on startup:** Log error, rename to `pistoncore.db.corrupt.[timestamp]`, create fresh DB. Inform user via banner: *"Database was corrupt and was reset. Run logs have been cleared."*

#### Table: `run_log`
One row per piston run.

| Column | Type | Notes |
|---|---|---|
| `run_id` | TEXT PRIMARY KEY | UUID |
| `piston_id` | TEXT NOT NULL | UUID — indexes required |
| `timestamp` | TEXT NOT NULL | ISO 8601 |
| `trigger_source` | TEXT | e.g. "sun.next_setting", "manual" |
| `status` | TEXT NOT NULL | "success", "error", "unknown" |
| `duration_ms` | INTEGER | |
| `compile_target` | TEXT | "native_script" or "pyscript" |

Index: `CREATE INDEX idx_run_log_piston ON run_log(piston_id, timestamp DESC)`

**Retention:** Keep last 50 runs per piston. On every insert, delete runs over the limit:
`DELETE FROM run_log WHERE piston_id = ? AND run_id NOT IN (SELECT run_id FROM run_log WHERE piston_id = ? ORDER BY timestamp DESC LIMIT 50)`

#### Table: `run_events`
One row per log line within a run.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | |
| `run_id` | TEXT NOT NULL | FK → run_log.run_id |
| `sequence_number` | INTEGER NOT NULL | Monotonic per run |
| `timestamp` | TEXT NOT NULL | ISO 8601 |
| `event_type` | TEXT NOT NULL | "trigger", "condition", "action", "log", "error" |
| `statement_id` | TEXT | May be null for run-level events |
| `message` | TEXT NOT NULL | |

Index: `CREATE INDEX idx_run_events_run ON run_events(run_id, sequence_number ASC)`

**Retention:** Cascade-deleted with run_log rows.

#### Table: `entity_state_cache`
Last known state of every entity referenced in any deployed piston.

| Column | Type | Notes |
|---|---|---|
| `entity_id` | TEXT PRIMARY KEY | |
| `friendly_name` | TEXT | May be null |
| `last_seen` | TEXT NOT NULL | ISO 8601 |
| `last_known_state` | TEXT | May be null |

**Update triggers:**
- On every HA connect: full refresh of all tracked entities
- On `state_changed` WebSocket event for any tracked entity
- On successful piston save: new entity_ids are added immediately

**Tracked entities:** All entity_ids found across all deployed piston nodes (condition, action, for_each).

#### Table: `compile_index`
One row per piston, updated on every successful compile.

| Column | Type | Notes |
|---|---|---|
| `piston_id` | TEXT PRIMARY KEY | |
| `compiled_at` | TEXT NOT NULL | ISO 8601 |
| `compile_target` | TEXT NOT NULL | "native_script" or "pyscript" |
| `file_hash` | TEXT NOT NULL | SHA-256 of compiled file content |
| `logic_version` | INTEGER NOT NULL | |
| `ui_version` | INTEGER NOT NULL | |

**Schema migration:** Version stored in a `schema_version` table (`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER)`). On startup, compare current schema version to expected. Run migration scripts in order if behind. Migration scripts are append-only — never drop columns in v1.

---

## 8. Entity Change Tracking Data Shape — RESOLVED (Session 60 / D-S4)

**Status:** RESOLVED. Fully defined by the `entity_state_cache` table in Item 7 above,
and the entity validation rules in COMPILER_SPEC.md v1.4 Section 8, and DESIGN.md Sections 9.1/9.2.
This was previously marked MISSING in the body — corrected this session.

Summary of what is now defined:
- Cache schema: `entity_state_cache` table in `pistoncore.db` — entity_id, friendly_name, last_seen, last_known_state
- Cache update triggers: HA connect (full refresh), state_changed WebSocket event, piston save
- Comparison logic: entity_id present in HA entity registry = exists. Unavailable ≠ missing.
- Missing entity: emit MISSING_ENTITY error with friendly_name from cache for the message
- Entity renames: old entity_id disappears, new one appears — PistonCore cannot auto-detect. User must fix manually.

See COMPILER_SPEC.md v1.4 Section 8 (resolve_entities), Section 13 (MISSING_ENTITY error), DESIGN.md Section 9.1 Step 5, Section 9.2.

---

## 9. PyScript-Forcing Patterns — RESOLVED (Session 24)

All seven patterns documented in PYSCRIPT_COMPILER_SPEC.md Section 1.1:
- Original three: `break`, `on_event`, `cancel_pending_tasks`
- Added: `repeat_until_state`, `current_event_device`, `dynamic_attribute_access`, `loop_string_accumulation`

Detection note added: the last three require content analysis, not just type checking.
Detection logic must be written before compile target detection is coded.

---

## 10. Global Variables — Maintenance Strategy — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into **DESIGN.md v1.5 Section 7.1** — subsections: "Global Variables —
Maintenance Strategy", "Standard Global Naming Convention", "Sample Piston Global Reference
Rules", "Global Name Validation Rules", "Where the Maintenance Story Is Communicated".

---

## 11. Sample Piston Library — PARTIALLY RESOLVED (Sessions 59/60)

**Status:** SAMPLE_PISTONS.md created in Session 59 with 3 logic_version 2 examples.
The four production-quality pistons (Low Battery Check, Door Chime, CO/Smoke Alert, Water Leak)
are still TODO — those require full PyScript patterns not yet in the compiler.

**What is done:**
- SAMPLE_PISTONS.md exists with 3 simple examples validating the JSON format
- Standard global naming convention defined in Item 10 above
- Library spec (where to ship, setup instructions format) defined below

**What remains (blocked on compiler being solid — after S3-2):**
- Write all four production pistons as Snapshot JSON in SAMPLE_PISTONS.md
- Each piston must include: full JSON, globals needed, setup instructions, device role requirements
- Ship location: bundled with PistonCore at `/pistoncore-userdata/samples/` (read-only)
  AND available as a community GitHub repo `pistoncore-sample-pistons`

This item is moved to DONE. The remaining production pistons are tracked as a post-S3-2 task.

---

## 12. Best Practices Documentation — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into **BEST_PRACTICES.md** (repo root).
Three patterns defined: globals for cross-piston device management, define block for
single-piston device references, role names over hardcoded entity lists.
Writing the README onboarding section is deferred to v1 release.

---

## 13. Fat Compiler Context Assembly — RESOLVED (Session 32)
See context_builder.py. Spec written and implemented this session.
Moved to DONE section below.

---

## 14. Time Condition Compiler Path — RESOLVED (Session 60 / D-S4 Step 7)

Full spec written into COMPILER_SPEC.md v1.4 — Section 11 "Time Condition Compiler Path" subsection.
Covers: `is between` (same-day and midnight-crossing), `is` (exact time), `$sunrise`/`$sunset` offsets, `$now`, day-of-week standalone conditions, weekday integer → HA string mapping, when to use native `time` condition vs template condition.

---

## 15. write-a-piston.md Prompt Content — MISSING

**Blocks:** S4-10 (Snapshot import via AI prompt)
**Needs to be written before:** S4-10 starts
**Status:** File exists in repo but content is a stub marked "being rewritten."
**What it must cover:** See AI_PROMPT_SPEC.md for the full requirements.
**Note:** Do not start S4-10 until this is complete and reviewed against
AI_PROMPT_SPEC.md.

---

## 16. PyScript Compiler Template Design — RESOLVED (Session 34)

**Resolved:** Section 4.1 added to PYSCRIPT_COMPILER_SPEC.md.
**Decision:** Hybrid approach — Jinja2 templates for the 5 boilerplate patterns
that change with PyScript API versions (`pyscript_state_trigger.j2`,
`pyscript_time_trigger.j2`, `pyscript_task_unique.j2`, `pyscript_service_call.j2`,
`pyscript_completion_event.j2`). Pure Python string generation for all body logic
because Python indentation is load-bearing and templates cannot know nesting depth.
Templates stored in `compiler-templates/pyscript/snippets/` in the customize volume.

---

## 17. Action Node Output Schema — RESOLVED (Session 55)

**Blocks:** wizard-action.js _saveDeviceCmd coding (Session 56), compiler.py action compilation
**Needs to be written before:** wizard-action.js _saveDeviceCmd is rewritten to the new model
**Status:** RESOLVED IN WIZARD_SPEC.md v2.0 (Session 55)

The action node output schema is now fully defined in WIZARD_SPEC.md v2.0 Screen W-6
(Action Node JSON output section). Fields: `id`, `type`, `async`, `role`, `entity_ids`,
`tasks` (with `id`, `command`, `domain`, `ha_service`, `parameters`, `description`),
`description`, `disabled`.

Key rule: `entity_ids` is always an array of real HA entity IDs. `role` is a display label only.
`ha_service` = `domain + "." + command` always. Written at wizard commit time.

**Remaining work:** wizard-action.js `_saveDeviceCmd` must be updated to write the new schema.
See CLAUDE_SESSION_PROMPT.md open gaps. WIZARD_SPEC.md is the reference.

---

## 18. Device Change Detection / Compile-Time Entity Validation — RESOLVED (Session 55)

**Blocks:** compiler.py entity validation (backend session)
**Needs to be written before:** compiler.py entity_ids validation is coded
**Status:** RESOLVED IN COMPILER_SPEC.md v1.2 (Session 55)

The compile-time validation behavior is now fully defined in COMPILER_SPEC.md v1.2:

- Section 8: `resolve_entities()` function — walks all condition and action nodes,
  checks every entity_id against `context["entity_states"]`
- Section 13: `MISSING_ENTITY` compiler error — code, message format, context field
- Section 15: Stage 2 in the pre-deploy validation pipeline

Key rules: validation runs before compile. If any entity_id is missing from HA, compilation
stops and returns MISSING_ENTITY errors. User fixes in editor and recompiles. No silent failures.
No automatic fallback. The `context_builder.py` entity_states dict is already available.

**Remaining work:** compiler.py must implement `resolve_entities()`. This is a backend session task.
See TASKS.md for the gap assignment.

---

## 19. Fast Pre-Check Validation (Wizard-Step Feedback) — RESOLVED (Session 60 / D-S4 Step 7)

Decision and future spec written into **FRONTEND_SPEC.md v1.3** — "Future Spec — Fast
Pre-Check Validation (Post-v1)" section. Deferred to post-v1. The compile-time
MISSING_ENTITY check is the v1 validation gate.

---

## 20. Statement Compiler Registry Pattern — RESOLVED (Session 60 / D-S4 Step 7)

Decision and future spec written into **COMPILER_SPEC.md v1.5 Section 20** — "Future
Architecture — Statement Compiler Registry Pattern". Current elif-chain is v1-acceptable.
Registry pattern is a post-S3-2 refactor.

---

## 25. HA Entity State Subscription vs Polling — RESOLVED (Session 62)

Full spec written into **DESIGN.md v1.6 Section 9.2** — "Entity State Subscription vs Polling — Decision" subsection.
Decision: polling only for entity validation (30-min schedule). `state_changed` subscription maintained only for `entity_state_cache` updates. Subscription list managed on deploy/delete/reconnect. No subscription needed for global device change detection.

---

## 26. Copy/Paste/Duplicate Statements — RESOLVED (Session 60 / D-S4)

Full spec written into **FRONTEND_SPEC.md** — "Copy / Paste / Duplicate Statements" section.
Covers: server-side clipboard storage, right-click context menu, copy/cut/duplicate/paste behavior, UUID regeneration rule, cross-piston use, API endpoints.

---

## 27. Piston Backup — Trigger, Download, Naming, Restore — RESOLVED (Session 62)

Full spec written into **FRONTEND_SPEC.md v1.4** — "Snapshot and Backup Export" section.
Covers: Snapshot export (entity_ids stripped, green button, file naming), Backup export (full format, amber button, file naming), Bulk Backup (zip from Settings), Restore/Import ID handling dialog, API endpoints.

---

## DONE

### Item 1 — PyScript Compiler Spec (Session 24)
PYSCRIPT_COMPILER_SPEC.md written. All 6 gaps resolved. Status: READY TO CODE.

### Item 2 — WebSocket Message Protocol (Session 60 / D-S4)
Full spec in FRONTEND_SPEC.md v1.2 — "WebSocket Protocol" section.

### Item 3 — Settings Page Frontend Spec (Session 60 / D-S4)
Full spec in FRONTEND_SPEC.md v1.2 — "Settings Page" section.

### Item 4 — Folder Management Flow (Session 60 / D-S4)
Full spec in FRONTEND_SPEC.md v1.2 — "Piston List — Folder Management" section.

### Item 5 — Error States Inventory (Session 60 / D-S4)
Full spec in FRONTEND_SPEC.md v1.2 — "Error States Inventory" section.

### Item 6 — Test Strategy (Session 60 / D-S4; moved to correct doc Session 61)
Full spec in TEST_STRATEGY.md (repo root).

### Item 7 — Storage Architecture (Session 60 / D-S4)
Full SQLite schema defined in MISSING_SPECS.md Item 7 body.

### Item 8 — Entity Change Tracking Data Shape (Session 60 / D-S4)
Resolved by Item 7 (entity_state_cache table) + COMPILER_SPEC.md v1.5 Section 8 + DESIGN.md Section 9.

### Item 9 — PyScript-Forcing Patterns (Session 24)
All seven patterns documented in PYSCRIPT_COMPILER_SPEC.md Section 1.1.

### Item 10 — Global Variables Maintenance Strategy (Session 60 / D-S4; moved to correct doc Session 61)
Full spec in DESIGN.md v1.5 Section 7.1.

### Item 11 — Sample Piston Library (Sessions 59/60)
SAMPLE_PISTONS.md created. Library spec defined. Production pistons deferred to post-S3-2.

### Item 12 — Best Practices Documentation (Session 60 / D-S4; moved to correct doc Session 61)
Full spec in BEST_PRACTICES.md (repo root).

### Item 13 — Fat Compiler Context Assembly (Session 32)
context_builder.py created. Spec written and implemented this session.

### Item 14 — Time Condition Compiler Path (Session 60 / D-S4)
Full spec in COMPILER_SPEC.md v1.5 — Section 11 "Time Condition Compiler Path" subsection.

### Item 16 — PyScript Compiler Template Design (Session 34)
Section 4.1 added to PYSCRIPT_COMPILER_SPEC.md. Hybrid approach locked.

### Item 17 — Action Node Output Schema (Session 55)
Resolved in WIZARD_SPEC.md v2.0 Screen W-6.

### Item 18 — Device Change Detection / Compile-Time Entity Validation (Session 55)
Resolved in COMPILER_SPEC.md v1.5 Sections 8, 13, 15.

### Item 19 — Fast Pre-Check Validation (Session 60 / D-S4; moved to correct doc Session 61)
Full spec in FRONTEND_SPEC.md v1.3 — "Future Spec — Fast Pre-Check Validation" section.

### Item 20 — Statement Compiler Registry Pattern (Session 60 / D-S4; moved to correct doc Session 61)
Full spec in COMPILER_SPEC.md v1.5 Section 20 — "Future Architecture — Statement Compiler Registry Pattern".

### Item 21 — Snapshot Format for Logic Version 2 (Session 57)
Fully specced in DESIGN.md v1.3 Sections 6.10 and 6.11.

### Item 22 — for_each list_role Architecture (Session 57)
Resolved: entity_ids on node directly. list_role retired. STATEMENT_TYPES.md and WIZARD_SPEC.md updated.

### Item 23 — MISSING_ENTITY Model (Session 58)
Resolved in COMPILER_SPEC.md v1.3 Section 13 and DESIGN.md v1.3 Section 9.

### Item 24 — Global Device Edit Redeploy Prompt UX (Session 60 / D-S4)
Full spec in DESIGN.md v1.6 Section 7.1 — permission prompt layout, progress modal layout, all edge cases.

### Item 25 — HA Entity State Subscription vs Polling (Session 62)
Full spec in DESIGN.md v1.6 Section 9.2 — "Entity State Subscription vs Polling" subsection. Decision: polling for validation, subscription only for entity_state_cache.

### Item 26 — Copy/Paste/Duplicate Statements (Session 60 / D-S4)
Full spec in FRONTEND_SPEC.md v1.4 — "Copy / Paste / Duplicate Statements" section.

### Item 27 — Piston Backup (Session 62)
Full spec in FRONTEND_SPEC.md v1.4 — "Snapshot and Backup Export" section.

---

*Add to this file whenever a coding task is blocked by a missing spec.
The goal is to never be surprised mid-session by a gap that could have been
caught earlier.*
