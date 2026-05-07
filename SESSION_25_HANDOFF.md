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
**Fix this as the literal first action of Session 25, before anything else.**
Load STATEMENT_TYPES.md, find Section 16 (log_message), add the missing header
line. Commit it. Done. Do not carry this into Session 26.

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

**Bug 15 — Completion event may fire inside switch/do branches (VERIFY)**
Check that `_compile_switch_block` and `_compile_do_block` pass
`_append_completion_event=False` in recursive calls. Flagged as unverified —
file truncated during review. May already be correct. Verify first, fix if broken.

**Bug 16 — for_loop variable substitution is fragile text-replace**
`compiled_body.replace(f"{{{{ {var_name} }}}}", ...)` — breaks if template
uses `{{var_name}}` (no spaces) or `{{ var_name|int }}` (with filter).

**Bug 17 — $sunrise/$sunset offset uses string not datetime**
`_resolve_operand` builds `{{ state_attr('sun.sun', 'next_rising') + timedelta(...) }}`
— `state_attr` returns a string, not a datetime. Can't add timedelta to a string.
Correct pattern: `as_datetime(state_attr('sun.sun', 'next_rising'))`.

**Bug 18 — $currentEventDevice resolution is wrong for native YAML**
Current: emits `{{ var_name }}` literally — wrong in all contexts.
The correct behavior depends on context:
- In a native automation action triggered by a state trigger →
  compiles to `{{ trigger.entity_id }}` (HA exposes this natively)
- In a PyScript on_event handler → compiles to `var_name` (from kwargs)
- Outside any trigger context in a native compile → CompilerError

Current Bug 18 description "raise CompilerError if it appears in a native
script piston" is too broad — it would break valid native automations that
reference which entity triggered them. Fix must be context-aware, not a
blanket error. Requires knowing whether the reference is inside a triggered
action sequence or a general expression context.

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
Must cover:
- `Time is between X and Y` as a condition (not a trigger)
- `Time is X` as a condition
- `$now` operand handling in time conditions
- `$sunrise`/`$sunset` with offsets in time conditions
- Day-of-week conditions (overlaps with S4-12 — coordinate)

---

### HA_LIMITATIONS.md Corrections Needed

These items are currently marked "already handled" but are NOT handled:
- State value quoting (Bug 11) — not enforced at compiler level
- wait_for_trigger timeout (Bug 3) — not emitted
- Parallel branch continue_on_error (Bug 12) — not emitted

Move these out of "already handled" and into "known gaps" in HA_LIMITATIONS.md.

---

### Recommended Fix Order (After S1-2 Complete)

**Important sequencing note:** Bug 1 (trigger compilation) depends on the flat
statements array from S1-2 being in place — the trigger compiler walks statements
looking for `is_trigger: true`. Fix triggers BEFORE writing anything to HA.
The correct order is:

**S1-7 session 1 (before S1-5 — before any HA write):**
1. Fix trigger compilation — read from `is_trigger: true` in statements
2. Fix condition indentation in if/while/repeat/AND/OR
3. Switch entity IDs and filenames from slug to UUID
4. Add file signature header generation
5. Enforce state-value quoting at compiler level
6. Add wait_for_trigger timeout fallback
7. Add continue_on_error at parallel branch sequence level

**Then S1-5 (HA direct write) — now writes something correct**
**Then S1-6 (fat context assembly) — real data into compiler**

**S1-7 session 2:**
8. Build template-condition compiler per Section 11
9. Add aggregation handling
10. Multi-device with-blocks

**Then S3-1 round-trip has a realistic chance of working.**

---

### What This Means for the Stage Plan

S1-2 is necessary but not sufficient. Even after the flat-array refactor,
the compiler produces invalid HA output. A new stage is needed:

**Add S1-7: Compiler Bug Fixes to TASKS.md** (S1-7 session 1 before S1-5, S1-7 session 2 after S1-6)
3-5 sessions. Use this inventory as the task list.

**S1-7 session 1 must also include: build a test-piston suite.**
The chicken-lights piston alone is not sufficient to prove the compiler works.
Add 5-6 hand-written flat-format piston JSON files to a `tests/pistons/` folder:
- A piston using every condition operator
- A piston using every wait variant (duration, until, wait_for_state)
- A piston using parallel + with-block + multi-device role
- A piston with deeply nested if/while/repeat
- A piston using for_each with dynamic attribute access
- The chicken-lights piston itself

These are the compiler test suite. All six must compile to valid HA YAML before
S1-7 is marked done. Add building this suite as part of S1-7 session 1, not deferred.

**Also add to TASKS.md:** S3-2: Deferred Validation Testing
Work through D-1, D-5, D-6, D-7 from the DEFERRED section against real HA.
Without this, S3-1 passes on paper but real users hit edge cases that were
known risks and never tested. Schedule S3-2 immediately after S3-1 passes.


---

## 8. Editor Render-Back Is Non-Negotiable

**This must be treated with the same rigor as the compiler.**

The editor is not just a display surface — it is the editing surface. If any
statement type fails to render, the user cannot click it, cannot open the wizard
to edit it, and cannot delete it. The statement is effectively lost even though
the JSON is intact. This is a critical failure mode, not a cosmetic one.

There are two round-trips that must both work:

**Forward (compile direction):**
wizard → JSON → backend save → compiler → HA YAML → HA runs it

**Backward (edit direction):**
JSON → editor renders every statement → user clicks → wizard opens pre-populated
→ user edits → JSON updated correctly → editor re-renders

The backward round-trip is arguably more important for day-to-day use.
Users edit existing pistons far more than they create new ones from scratch.

**What render-back requires for every statement type:**
1. `_actionLines` has a handler for the type — no silent fall-through
2. Rendered line has `data-id` set correctly — click events can find it
3. `_openWizardForEdit` routes to the correct wizard step for that type
4. Wizard opens pre-populated with the statement's current values
5. After editing, `insertStatement` updates the correct flat array entry
6. Editor re-renders and the updated statement is visible immediately

**Required verification for S1-2b — every type, full backward round-trip:**

| Statement type | Renders? | Clickable? | Wizard pre-populated? | Save updates? |
|---|---|---|---|---|
| action | | | | |
| if (then / else_if / else) | | | | |
| while | | | | |
| repeat | | | | |
| for | | | | |
| for_each | | | | |
| do | | | | |
| switch | | | | |
| set_variable | | | | |
| wait (duration) | | | | |
| wait (until) | | | | |
| wait_for_state | | | | |
| log_message | | | | |
| call_piston | | | | |
| exit | | | | |
| on_event | | | | |
| break | | | | |
| every | | | | |

If any row has a blank — fix it before marking S1-2b done.
Do not move to S1-2c with broken render-back.

**Silent failures are not acceptable.** If `_actionLines` has no case for a
type and falls through rendering nothing, that is a critical bug. The fallthrough
must render a visible error placeholder so the user can at least see, click,
and delete the broken node:

```
⚠ Unknown statement type: {type} — {id}
```

---

## 9. piston_text Safety Net — Temporary Render Fallback

**Decision made end of Session 24. Implement during S1-2b.**

Add a `piston_text` field to the bottom of the piston JSON as a temporary
human-readable safety net while the editor render-back is being proven out.
Remove after S3-1 round-trip testing confirms the editor renders reliably.

### Rules — Non-Negotiable

- **JSON is always the source of truth. If piston_text and the JSON ever
  disagree, the JSON wins. Always. No exceptions.**
- piston_text is never parsed by anything — not the compiler, not the backend,
  not the import flow
- piston_text is never used to reconstruct a piston
- It is human-readable only — a safety net so a user can read what their
  piston does even if the editor fails to render it
- **piston_text is NOT regenerated if the editor fails to render any statement.**
  If render fails, piston_text from the previous successful save is preserved.
  A piston with 18 statements in JSON that only renders 17 must NOT produce a
  piston_text with 17 statements — that would make the user think one was deleted.
  The safety net must fail loudly, not silently mask the problem.
- **piston_text is generated from the same render functions the editor uses —
  not a parallel render path.** If editor and piston_text use different render
  code they will drift. One render function, two consumers.

### Where It Lives

Bottom of the piston JSON, after `statements`:

```json
{
  "id": "a3f8c2d1",
  "name": "Driveway Lights at Sunset",
  ...
  "statements": [ ... ],
  "piston_text": "execute\n  if\n    ⚡ Time happens daily at sunset\n  then\n    with {driveway_light}\n    do\n      Turn on;\n    end with;\n  end if;\nend execute;"
}
```

### Who Generates It

The frontend — same render functions that produce the editor display.
The backend stores it as-is and never touches it.

### When It's Generated

- On every save (always current at save time)
- Updated live with a debounce as the user builds — same 2-second debounce
  as the compile status indicator in FRONTEND_SPEC.md

### What to Add to PISTON_FORMAT.md

Add this field to the wrapper field reference table:

| `piston_text` | string | No | Human-readable render of the piston. Generated by frontend render functions on save. Never parsed. Never authoritative. JSON is always the source of truth. Temporary — remove after S3-1 testing. |

And add a clear warning block:

```
⚠ TEMPORARY FIELD — piston_text is a safety net only.
It is never parsed or used to reconstruct piston logic.
The statements array is always the source of truth.
This field will be removed after editor render-back is confirmed reliable.
```

### Removal Criteria

Remove `piston_text` from the format when:
1. S3-1 round-trip passes on the chicken-lights piston
2. All 18 statement types pass the S1-2b render-back verification table
3. At least one session of real editing has been done without render failures


---

## 10. Wizard Pre-Population Bugs — From Earlier Code Review

A previous chat session identified specific bugs in the wizard↔editor round-trip
that are directly relevant to the render-back problem. These were never fully
captured in the specs. Add these to the S1-2b task or create a dedicated task.

**Bug A — `insertStatement` doesn't handle `if_condition` context**
When the wizard calls `insertStatement('if_condition', node, {'block-id': id})`,
the editor falls through to the else branch and pushes to the top-level statements
array instead of adding the condition to the correct if block's conditions array.

Fix needed in editor.js `insertStatement`:
```javascript
if (context === 'if_condition' && blockId) {
  const block = _findNode(piston.statements, blockId);
  if (block) {
    block.conditions = block.conditions || [];
    const i = block.conditions.findIndex(c => c.id === statementData.id);
    if (i >= 0) block.conditions[i] = statementData;
    else block.conditions.push(statementData);
    _markUnsaved(true);
    render();
    return;
  }
}
```

**Bug B — Two mechanisms for block-id, needs to be unified**
`_extra['block-id']` and `_sel.pending_if_id` both try to track which if block
a condition belongs to. They conflict. Pick one — `_extra['block-id']` is the
correct mechanism per the specs. Remove `_sel.pending_if_id` entirely.

**Bug C — `_buildConditionNode` doesn't pass `_blockId` back**
When wizard saves a condition, `_buildConditionNode` builds the condition object
but doesn't include the block ID. `insertStatement` receives the node with no
`_blockId` so it can't route to the correct if block.

Fix needed in wizard.js `_buildConditionNode` — add to the returned object:
```javascript
_blockId: _extra?.['block-id'] || null,
```

**These three bugs together mean:** editing an existing condition inside an if
block either goes to the wrong place or fails silently. This is the core of
the render-back reliability problem. Fix all three in S1-2b.

---

## 11. New Gaps Found — Grok Repo Review

Grok reviewed the actual repo code (not just specs). These items are not
captured anywhere in MISSING_SPECS.md, TASKS.md, or the handoff note yet.
Add them to MISSING_SPECS.md and TASKS.md at the start of Session 25.

---

**Gap A — get_all_slugs() instantiates Compiler on every call**
`storage.py` `get_all_slugs()` loads every piston file AND instantiates a
Compiler object on every call. Called on every save to check for slug collisions.
Scales badly with dozens or hundreds of pistons — will become a noticeable
delay. Fix: cache slug list, invalidate on save. Add to TASKS.md as a
performance task in Stage 4.

**Gap B — No .dockerignore**
Docker image likely includes screenshots, zip files, dev artifacts, and other
non-production files. Bloats the image unnecessarily. Fix: add `.dockerignore`
to repo. Simple fix — do it anytime. Add to Minor/Cosmetic section of TASKS.md.

**Gap C — Single-process uvicorn, no worker config**
`main.py` runs single-process uvicorn with no worker configuration. Fine for
development but not production-grade. Under load (multiple users, concurrent
device picker requests) will bottleneck. Fix: document recommended uvicorn
worker config in README and Docker run command. Add to TASKS.md as a
pre-v1-release operational task.

**Gap D — docker-entrypoint.sh volume population race conditions**
First-run volume setup (copying customize templates, creating userdata dirs)
could fail silently if volumes are mis-mounted or entrypoint errors mid-run.
Leaves the container in a partially-initialized state with missing templates
or pistons. Fix: add startup validation that checks required dirs and files
exist before starting FastAPI, fails loudly with a clear message if not.
Add to TASKS.md — important for reliability before v1 ships.

**Gap E — No central logging config in main.py**
`ha_client.py` has a logger but there's no central logging configuration in
`main.py`. Log output is inconsistent — some paths log, others don't.
Fix: add logging config at startup (level, format, output). Add to S1-4
backend cleanup task — low effort, high value for debugging.

**Gap F — Token security not documented**
Long-lived HA token stored in plaintext `config.json` in the userdata volume.
No guidance in README or Docker docs about:
- Keeping the volume secure
- Using least-privilege token scopes
- Token rotation
- Risks of exposing port 7777 publicly without auth
Fix: add a security section to README. Not a code change — documentation only.
Add to TASKS.md pre-v1 documentation tasks.

**Gap G — _scan_globals regex may false-positive**
`_scan_globals` in compiler.py uses regex `@([A-Za-z_]\w*)` to find global
variable references in expression strings. Could false-positive on email
addresses, Twitter handles, or any other `@word` pattern in string literals.
Fix: tighten the scan to only match known global variable contexts, or add
a validation step that checks found names against the actual globals list.
Add to S1-7 compiler fixes.

---

*Load this file at the start of Session 25. Process it before starting S1-2a.
Delete from repo after Session 25 is complete.*
