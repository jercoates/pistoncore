# Session 25 Handoff Note

Load this file alongside CLAUDE_SESSION_PROMPT.md at the start of Session 25.
Process everything in this file before starting any task work.
Delete this file from the repo after Session 25 is complete.

---

## 1. TASKS.md Upload Lines — Make Exhaustive

Every task's Upload line currently lists code files only. It needs to list
every spec file required for that task too, so there's no guesswork about
what to load.

**Go through TASKS.md and update every Upload line to include spec files.**

Example — S1-2a currently says:
```
Upload: wizard.js, PISTON_FORMAT.md
```
It should say:
```
Upload: wizard.js, PISTON_FORMAT.md, STATEMENT_TYPES.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
```

Do this for every task in Stage 1 and Stage 2 at minimum. Stage 4 tasks can
be updated when they get closer. The rule: if Claude needs to read it to do
the task correctly, it goes in the Upload line.

**Always-load files (every session, no exceptions):**
- CLAUDE_SESSION_PROMPT.md
- TASKS.md

**Task-specific files — add to each task's Upload line:**

| Task | Spec files to add |
|---|---|
| S1-2a (wizard.js) | PISTON_FORMAT.md, STATEMENT_TYPES.md |
| S1-2b (editor.js) | PISTON_FORMAT.md, STATEMENT_TYPES.md, FRONTEND_SPEC.md |
| S1-2c (compiler.py) | PISTON_FORMAT.md, STATEMENT_TYPES.md, COMPILER_SPEC.md |
| S1-3 (backend audit) | DESIGN.md, FRONTEND_SPEC.md |
| S1-4 (backend cleanup) | DESIGN.md, FRONTEND_SPEC.md, PISTON_FORMAT.md |
| S1-5 (HA direct write) | DESIGN.md, COMPILER_SPEC.md |
| S2-0 (storage spec) | DESIGN.md, MISSING_SPECS.md |
| S2-1 (HAClient) | DESIGN.md, COMPILER_SPEC.md |
| S2-2 (device_map_meta) | PISTON_FORMAT.md, DESIGN.md |
| S2-3 (Snapshot export) | PISTON_FORMAT.md, DESIGN.md, FRONTEND_SPEC.md |
| S2-4 (import flow) | PISTON_FORMAT.md, DESIGN.md, FRONTEND_SPEC.md |
| S2-5 (HA version detection) | DESIGN.md, COMPILER_SPEC.md |

---

## 2. Design Claude Points Not Yet Addressed

The external design review raised several points that were not acted on
in Session 24. These need to be handled:

### 2a. COMPILER_SPEC.md Section 18 Hand-Verification Example

Design Claude noted: "The single worked example that proves the compiler is
correct only proves it once S1-2 is done." The example in Section 18 uses
the flat-format piston JSON (stmt_001 if block, stmt_002/003/004 as flat
siblings). This is correct per spec — but the compiler cannot currently
reproduce it because S1-2 is not done.

**Action needed at S1-2c:** After S1-2c is complete, run the compiler
against the Section 18 piston JSON and verify the output matches exactly.
Add a note to S1-2c in TASKS.md that this verification step is required
before marking the task done.

### 2b. write-a-piston.md Is Still a Stub

Design Claude flagged: "write-a-piston.md says 'being rewritten' — don't
let that gap sit forever." It blocks S4-10 (Snapshot import via AI).

**Action needed:** Add a note to S4-10 in TASKS.md explicitly flagging
that write-a-piston.md must be complete before S4-10 starts. Also add
"write-a-piston.md prompt content" to MISSING_SPECS.md as a tracked item
with a clear blocker reference to S4-10.

### 2c. Item 7 (SQLite) and Item 5 (Error States) Are Underestimated

Design Claude flagged both as larger than they look:
- Item 7 (Storage Architecture / SQLite) is listed as S2-0 — "a substantial
  design exercise. Don't underestimate it." S2-0 is already marked as a
  two-part session (spec + code). That's correct. No change needed to the
  task — just a reminder not to rush it.
- Item 5 (Error States Inventory) — "without this, error handling will be
  inconsistent across pages." This should be moved up in S4-0 priority —
  write it before any Stage 4 UI work, not at the end.

**Action needed:** In TASKS.md S4-0, reorder the missing specs list so
Error States Inventory appears first (before settings page, folder management,
etc.) since it affects every UI page.

### 2d. Day-of-Week and Multi-Role OR Triggers

Design Claude noted these are "too common to skip" and should be fully
compiled — not just warned. This is already captured in S4-12 in TASKS.md.
No new action needed — just confirming it was not missed.

---

## 3. Minor Items Not Yet Fixed

These were identified during Session 24 but not actioned:

### 3a. STATEMENT_TYPES.md Section 16 Missing Header Line
Still present as a known minor issue. Fix it anytime — takes 30 seconds.
Load STATEMENT_TYPES.md, find Section 16 (log_message), add the missing
header line. Commit with the next batch of changes.

### 3b. AI-REVIEW-PROMPT.md Still References Old Architecture
DESIGN.md Section 32 open item 2 flags this. Not urgent — only needed
before the next external review. Tracked as S4-11 in TASKS.md.

### 3c. MISSING_SPECS.md — write-a-piston.md Not Yet Tracked
See point 2b above. Should be added as a new item in MISSING_SPECS.md.

---

## 5. Missing Task — S1-6: Fat Compiler Context Assembly

**This is a significant missing piece identified end of Session 24.**

COMPILER_SPEC.md Section 7 defines the fat compiler context object that the
compiler receives. Nothing in the codebase builds it. The backend currently
has no code that assembles entity states, services, HA version, globals, areas,
and zones into the structure the compiler expects before calling compile_piston().

**Add S1-6 to TASKS.md** between S1-5 and S2-0:

---

### S1-6: Fat Compiler Context Assembly
**Why:** The compiler receives a fat context object (COMPILER_SPEC.md Section 7)
containing entity states, services, HA version, globals, and more. Nothing
currently builds this object. S1-5 deploy works with a stub — this replaces
the stub with real data.
**Do after:** S1-5 complete and tested against real HA.
**Spec ref:** COMPILER_SPEC.md Section 7, DESIGN.md Section 4
**Upload:** api.py, ha_client.py, COMPILER_SPEC.md, DESIGN.md
**What gets built:**
A `build_compiler_context(piston, ha_client)` function that:
1. Reads piston JSON from volume (already done — pass through)
2. Calls `GET /api/states` via HAClient → builds `entity_states` dict
3. Calls `GET /api/services` via HAClient for domains in piston device_map → builds `services` dict
4. Calls `GET /api/` via HAClient → reads `version` field → `ha_version`
5. Reads `globals.json` from userdata volume → builds `global_variables` array
   per COMPILER_SPEC.md Section 7 structure
6. Reads piston `variables` array → `piston_variables` (pass through)
7. Calls `GET /api/states` filtered for `zone.*` entities → `zones`
8. Calls `GET /api/template` or areas endpoint → `areas`
9. Assembles into fat context object and returns it

**Failure handling:**
- If entity states fetch fails → abort deploy, return error to frontend
- If services fetch fails → degrade gracefully, compiler warns on unknown services
- If HA version fetch fails → use "unknown", compiler proceeds with warnings
- If globals.json missing → treat as empty globals list, not an error

**Where this code lives:**
New function in ha_client.py or a new context_builder.py module.
Not in api.py — api.py calls it, doesn't contain it.

**Output:** `compile_piston()` receives a real fat context object on every
deploy. No more stub context. Compiler warnings about missing entity data
are now meaningful.

---

**Also add to MISSING_SPECS.md** as a new item:

**Item 13 — Fat Compiler Context Assembly — needs spec before S1-6 coding**
What HA endpoints are called, in what order, what failure modes abort vs degrade,
where the assembly code lives, which fields are required vs optional for the
compiler to function. Write this as part of the S1-6 session (spec first,
then code in same session if time allows — or split into two sessions).

---

## 7. Critical Compiler Bugs — Full Inventory (Design Claude Review)

**This is the most important section in this note.**

A deep code review of compiler.py against COMPILER_SPEC.md identified bugs that
will prevent compiled output from working in HA — independent of S1-2. These are
not subtle edge cases. Some mean automations will never fire.

Add a new stage to TASKS.md: **S1-7: Compiler Bug Fixes** (after S1-6, before S2-0).
This is 3-5 sessions of focused work. Use this inventory as the task list.

---

### TIER 1 — HA Will Reject The Output (Fix Before Any HA Write Attempt)

**Bug 1 — Triggers are never populated (CRITICAL)**
Compiler reads `piston.get("triggers", [])` — a top-level field that no longer
exists in the spec. COMPILER_SPEC Section 9.3 says triggers come from condition
objects in statements where `"is_trigger": true`. Result: every compiled automation
has `triggers: []` and will never fire. Nothing else matters until this is fixed.
Fix: walk statements array, find conditions with `is_trigger: true`, compile those
as triggers.

**Bug 2 — Triggers missing required `id:` field**
COMPILER_SPEC Section 9.3: every trigger must include `id:`. None of the trigger
templates emit one. Breaks `choose:` blocks and HA trace system.

**Bug 3 — wait_until missing timeout**
COMPILER_SPEC Section 10.2 and HA_LIMITATIONS Section 8 say timeout is always
required on wait_for_trigger. Compiler passes only `stmt_id` and `at_time` to
the template — no timeout, no `continue_on_timeout`. Piston will hang forever
if time is missed. HA_LIMITATIONS incorrectly says this is "already handled."

**Bug 4 — if-block condition indentation is malformed**
`_compile_if_block` does `f"    - {compiled_condition}"` where `compiled_condition`
is already a multi-line YAML string starting with `- condition: state\n  entity_id:...`.
This produces `- - condition: state` — invalid YAML. HA reload will fail.
Same problem in repeat/while/until. Fix: return condition body without leading `-`,
let parent prepend it correctly.

**Bug 5 — AND/OR recursive condition indentation is also malformed**
Same issue as Bug 4 — recursive calls return multi-line blocks, only first line
gets indented. Nested AND/OR conditions will not parse.

**Bug 6 — for_each body doesn't use per-iteration entity**
The `compiled_body.replace(f"{{{{ {loop_var} }}}}", "{{ repeat.item }}")` text
substitution only works if body literally contains `{{ var_name }}`. Entity IDs
are baked from device_map at compile time, not left as templates. for_each loops
will iterate but body won't use the per-iteration entity.

**Bug 7 — with_block only acts on first device**
Compiler picks `devices[0]` then `entity_id_list[0]`. Multi-device roles and
multi-entity roles only act on the first entity. COMPILER_SPEC says compile
for each entity in the role.

---

### TIER 2 — Output Looks Valid But Behaves Wrong

**Bug 8 — Conditions compiled as state blocks, spec says template**
COMPILER_SPEC Section 11: conditions compile to Jinja2 template conditions.
Compiler emits `condition: state` and `condition: numeric_state`. These cannot
express aggregation, `is any of`, `is between`, `is even`, combined and/or.
Full template condition builder needed.

**Bug 9 — Aggregation is silently dropped**
`aggregation` field on condition objects is never read. "Any of {Doors} is open"
compiles as "first mapped door is open." Logic bug — pistons fire on wrong conditions.

**Bug 10 — is_trigger not filtered in condition compilation**
Trigger conditions (which should only go in triggers: block) may also end up
in if: blocks. No filtering on `is_trigger` in the condition compiler path.

**Bug 11 — Boolean state quoting not enforced at compiler level**
HA_LIMITATIONS Section 8 incorrectly says this is "already handled." Compiler
passes `state=compiled_value` to templates and trusts the template to quote it.
No normalization in `_compile_single_condition`. Highest-frequency silent failure
mode in HA.

**Bug 12 — Parallel branch missing continue_on_error**
COMPILER_SPEC Section 10.2 explicitly says parallel branches need
`continue_on_error: true` at the branch sequence level. Compiler emits per-action
`continue_on_error` only. One offline device kills the whole parallel block.
HA_LIMITATIONS incorrectly says this is "already handled."

**Bug 13 — call_piston uses slug not UUID for entity ID**
`action: script.pistoncore_{target_slug}` — COMPILER_SPEC Section 5 says entity
IDs use UUID, never slug. Slug is for `alias:` only. If a piston is renamed its
slug changes and every piston that calls it has a dead reference.

**Bug 14 — Filename generation is also slug-based**
Same issue as Bug 13 — filenames should be `pistoncore_{uuid}.yaml` not slug-based.

**Bug 15 — Completion event may fire inside switch/do branches**
Check that `_compile_switch_block` and `_compile_do_block` pass
`_append_completion_event=False` in recursive calls. A completion event inside
a case block would fire mid-piston.

**Bug 16 — for_loop variable substitution is fragile text-replace**
`compiled_body.replace(f"{{{{ {var_name} }}}}", ...)` — breaks if template
uses `{{var_name}}` (no spaces) or `{{ var_name|int }}` (with filter).

**Bug 17 — $sunrise/$sunset offset uses string not datetime**
`_resolve_operand` builds `{{ state_attr('sun.sun', 'next_rising') + timedelta(...) }}`
— `state_attr` returns a string, not a datetime. Can't add timedelta to a string.
Correct pattern: `as_datetime(state_attr('sun.sun', 'next_rising'))`.

**Bug 18 — $currentEventDevice emits literal `var_name` in native YAML**
`"$currentEventDevice": "var_name"` in the system variable map. This emits
`{{ var_name }}` literally into compiled YAML. This is PyScript-only — compiler
must check `compile_target` and raise CompilerError if it appears in a native
script piston.

**Bug 19 — Yes/No global write has malformed YAML indentation**
`default:` block in the `choose:` output is at wrong indent level. HA reload will fail.

---

### TIER 3 — Spec Compliance Gaps

**Bug 20 — File signature header not verified**
Header generation may be in templates — cannot verify without seeing template files.
Confirm templates emit correct format per COMPILER_SPEC Section 6.

**Bug 21 — Hash not computed anywhere**
Neither compiler.py nor api.py computes `hashlib.sha256()` against compiled output.
Flagged as backend responsibility in spec — but not yet implemented. Known gap for S1-5/S1-6.

**Bug 22 — compile_piston signature doesn't match spec**
Spec (Section 8): `def compile_piston(context: dict) -> CompilerResult`
Code: `def compile_piston(self, piston, device_map, globals_store, app_version, known_piston_slugs)`
Also: `CompilerResult` dataclass with `code` field per message not implemented.
Current `CompilerWarning` has no `code` field.

**Bug 23 — CompilerError messages lack required code field**
Spec requires SCREAMING_SNAKE_CASE codes (NO_TRIGGERS, UNMAPPED_ROLE, etc.).
Current errors are plain message strings.

**Bug 24 — No validation that piston has triggers**
Compiler emits `triggers: []` without error. Spec requires NO_TRIGGERS error.

**Bug 25 — No PyScript dispatch**
compile_piston always renders native YAML. No branch on `compile_target`.
Stage 4 territory but dispatch isn't even stubbed.

---

### TIER 4 — ha_client.py Issues

**Bug 26 — ThreadPoolExecutor per call causes connection leaks**
Spinning up a fresh executor per HA call creates a new event loop each time.
Under load (device picker loading many entities) HA can rate-limit or refuse.
Should be await-able from FastAPI handler directly.

**Bug 27 — get_services fetches entire catalog per entity**
Cache key is per-entity. `get_services("light.a")` and `get_services("light.b")`
both fetch the entire HA services catalog twice. Should cache per-domain.

**Bug 28 — _field_type doesn't handle entity_id selector**
Service fields that select an entity render as text input in wizard. UX wrong.

---

### Spec Gap Found — Time Condition as Condition (Not Trigger)

The chicken-lights piston uses "Time is between 6:00 AM and $sunrise + 30 minutes"
as a **condition**, not a trigger. COMPILER_SPEC Section 11 has no compiler path
for time-subject conditions — only entity-state operators. This needs a spec
addition before any piston using time conditions can compile correctly.

Add to MISSING_SPECS.md: **Item 14 — Time Condition Compiler Path**
Blocks: any piston using time-of-day conditions (very common).

---

### HA_LIMITATIONS.md Corrections Needed

These items are currently marked "already handled" but are NOT handled:
- State value quoting (Bug 11) — not enforced at compiler level
- wait_for_trigger timeout (Bug 3) — not emitted
- Parallel branch continue_on_error (Bug 12) — not emitted

Move these out of "already handled" and into "known gaps" in HA_LIMITATIONS.md.

---

### Recommended Fix Order (After S1-2 Complete)

**Before any HA write attempt (S1-7 session 1):**
1. Fix trigger compilation — read from `is_trigger: true` in statements
2. Fix condition indentation in if/while/repeat/AND/OR
3. Switch entity IDs and filenames from slug to UUID
4. Add file signature header generation
5. Enforce state-value quoting at compiler level
6. Add wait_for_trigger timeout fallback
7. Add continue_on_error at parallel branch sequence level

**Then (S1-7 session 2):**
8. Build template-condition compiler per Section 11
9. Add aggregation handling
10. Multi-device with-blocks

**Then S3-1 round-trip has a realistic chance of working.**

---

### What This Means for the Stage Plan

S1-2 is necessary but not sufficient. Even after the flat-array refactor,
the compiler produces invalid HA output. A new stage is needed:

**Add S1-7: Compiler Bug Fixes to TASKS.md** (after S1-6, before S2-0)
3-5 sessions. Use this inventory as the task list. The chicken-lights piston
is the forcing function — until it compiles to YAML that HA accepts on reload
and behaves correctly, the compiler is not done.

Do not let Sections 5 and the other items in this note expand Session 25's scope.

Session 25 = S1-2a only. wizard.js only. Everything else in this note gets
handled in subsequent sessions or at the start of Session 25 before coding begins.

---

*Load this file at the start of Session 25. Process it before starting S1-2a.
Delete from repo after Session 25 is complete.*
