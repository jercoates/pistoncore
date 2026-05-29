# PistonCore — Claude Session Prompt

## What is PistonCore?
Open-source WebCoRE-style visual automation builder for Home Assistant.
GitHub: github.com/jercoates/pistoncore
Stack: Python/FastAPI backend, vanilla JS/HTML/CSS frontend, Jinja2 templates,
SQLite/JSON storage, Docker on Unraid at port 7777.
Jeremy has no formal programming background — relies entirely on Claude for
architecture and code. Never does targeted/line-level edits — only full file replacements.

## Non-Negotiable Rules
- Specs before code. Read all listed files before writing anything.
- All problems logged in TASKS.md with GAP-SXX-N format.
- No HA YAML emitted inline in Python — always through Jinja2 templates.
- Session boundaries kept clean. Context usage monitored deliberately.
- Every gap created must be assigned to a future session before session closes.
- Do not write any file until all necessary files for that task have been read.
- One task per session. Do not combine tasks.
- Do not write code in a spec session. Specs only.
- Do not write code without permission.
- Never mark a section as SUPERSEDED and leave the stale content.
- All specs must be complete before any coding session starts. No exceptions.
- **Always upload DESIGN.md for wizard/editor/picker sessions. Device model,
  entity model, and compilation decisions all live there. Do not assume.**
- **Coding discipline — fix what the user can see first.**
- Keep the how to manage claude rules below in mind when coding.
- Remind Jeremy to review the rules below before coding starts.
- **Always check for stale comments and dead code before delivering files.**
- **Do not code without permission — explain what you plan to change first.**

## 📌 How to Handle Spec Rules — Read This Before Anything Else

Spec rules are decisions made at a point in time. They are not infallible. They were
written against a specific level of evidence — some against real bugs, some against
documented research, some against best-effort guesses. Treat each rule according to
its evidence level (see Decision Confidence Levels below).

**Jeremy will break any rule that gets in the way of making PistonCore work.** If a
spec rule appears to contradict the obvious fix for a real problem, do NOT contort
the code to honor the rule. Instead:

1. State what the spec says, in plain English.
2. State what reality is showing, in plain English.
3. Propose updating the spec, not working around it.
4. Wait for Jeremy's decision before writing any code.

The one exception is **hard guardrails** (see below). Those are scar tissue from real
bugs that took multiple sessions to fix. Do not unwind them without explicit
conversation — even if a "better" approach seems obvious. The reason they're hard is
that the "better" approach has already been tried and broke things.

## 📌 Decision Confidence Levels

Every spec rule falls into one of three buckets. The bucket determines how to handle
the rule when reality pushes back.

### 1. Hard Guardrails — Scar Tissue From Real Bugs

These came from sessions of regressions and real testing. Do NOT unwind without
explicit conversation, even if you think you see a cleaner approach. The cleaner
approach has likely already been tried.

Current hard guardrails:
- **sel.tokens model** — physical rows store ALL entity_ids (WIZARD_SPEC.md v2.4
  guardrail section). Took 6 sessions to get right. See lines 200-272 of WIZARD_SPEC.md.
- **Union-then-intersect capability lookup** — `_getGroupedEntityIdsForTokens` returns
  arrays per group, union within group, intersect across groups. Replaces the earlier
  `_getPrimaryIdsForTokens` which was wrong. Documented in WIZARD_SPEC.md and below.
- **Nested tree model** — children embedded directly on parent nodes, no ID references.
  Established Session 35 after the flat-with-stmt_map model caused orphan bugs.
- **Editor never reads display text** — rendering is a pure projection from JSON.
  Display text is generated on every render, never stored or parsed. AST/Pure
  Projection invariant in FRONTEND_SPEC.md.
- **UI/Data separation** — role/device_label always friendly names, entity_ids always
  real HA entity_ids. Mixing them is always a bug. See UI/Data Separation Rule below.

If a hard guardrail seems wrong, you (Claude) are most likely wrong. Ask before
changing anything.

### 2. Researched Decisions — Validated Against Multiple Sources

These came from real investigation: multi-AI review, WebCoRE source code reading,
verified HA documentation, or hand-verified compiler output. Lock-strength is
appropriate but each one carries the rationale that justified it.

Re-open only with new evidence that contradicts the research — not with argument.

Examples:
- **AppDaemon ruled out** — evaluated through multi-AI review (multiple models
  consulted, findings synthesized, final review against Claude). Three blockers:
  programming model mismatch (static classes vs dynamic JSON pistons), impossible
  observability layered on top of another runtime, three-layer debugging unacceptable
  for non-technical users. Re-open only if a working prototype demonstrates all three
  blockers are solvable.
- **Hybrid output model — simple pistons compile to native HA YAML permanently** —
  decision against routing simple pistons through PistonCore's runtime. Reasoning:
  native YAML pistons are owned by HA, survive PistonCore uninstall, traces work
  natively, and routing them through PistonCore would violate the independence
  guarantee. Re-open only if v1 user testing shows the simple/complex boundary
  causes real confusion or breakage.
- **HACS companion eliminated** — direct HA REST/WebSocket API used instead.
  Decision made Session 16 after evaluating the companion's actual contribution.
- **Multi-entity compilation HA-native** — verified against HA documentation May
  2026. `entity_id:` accepts arrays in triggers and action targets. No expansion
  needed. Conditions still require Jinja2 templates for any/all/none.
- **device_map eliminated** — entity_ids stored directly on condition, action, and
  for_each nodes. The map was rejected because it allowed orphaned references (node
  referencing a role not in the map). If `_reResolveVariableUses` + `globals_index.json`
  bookkeeping turns out to be slow at scale, the path back is to add a `variable_refs`
  field alongside `entity_ids` on nodes — NOT to reintroduce the map.
- **Device globals are compile-time only** — entity_ids baked inline into compiled
  YAML at deploy time, no runtime group lookup. Non-device globals use HA input
  helpers. This eliminates runtime race conditions entirely.

### 3. Working Assumptions — Best-Effort Guesses Awaiting Validation

These were written against documentation or rationale, NOT against real HA testing.
They may be wrong. The fact that they're in a spec does not make them true.

If real testing contradicts a working assumption, update the spec — do not contort
the code. Open a discussion with Jeremy before changing anything.

Current working assumptions (incomplete list — anything not in the above two buckets):
- Compiler output details for statement types that haven't been deployed to real HA
  yet (most of COMPILER_SPEC.md Section 10)
- The 30-minute entity validation interval — chosen as a reasonable default, not
  measured against real load
- Jinja2 template patterns for conditions — verified against docs, not against
  running pistons
- PyScript handlers (PYSCRIPT_COMPILER_SPEC.md) — written from documentation, no
  end-to-end verification yet
- Anything marked "needs explicit testing" or "not yet tested" in HA_LIMITATIONS.md

**Treat working assumptions as hypotheses, not laws.** The smoke test (S3-1) is when
many of them will be validated or invalidated.

---

## 📌 Architecture Guardrail: The "Lowest Common Denominator" Rule

Whenever the user is building an Action (`wizard-action.js`) or a Condition (`wizard-condition.js`) and selects a device, group of devices, or a Device Variable (e.g., `@MyLights`, `@Fountains`):

1. The Extraction Layer: The wizard must never evaluate capabilities based on the Variable string token itself. It must immediately run a background pass to unpack all selected targets into a single, flat array of raw Home Assistant entity IDs (`light.kitchen_1`, `switch.fountain_main`).
2. The Capability Matrix Lookup: For every raw entity ID in that flat array, look up its supported commands or attributes from `WizardCore.deviceData`.
3. The Intersection Filter (The Overlap): Calculate the mathematical intersection of those capability lists. The UI dropdown presented to the user must only display commands/attributes that are present across all resolved entities.
4. UI/Data Separation: The final saved node retains the user's chosen Friendly Name or Variable Token for the script display block, but the selectable parameters are safely constrained by the backend hardware intersection checked in step 3.

## 📌 UI/Data Separation Rule
- The user always sees friendly names (variable names, global @tokens, device friendly names).
- The JSON always stores entity_ids on nodes for the compiler.
- `role` and `device_label` are always friendly names or variable names. Never entity_ids.
- `entity_ids` on nodes are always real HA entity_ids. Never role names.
- `role_tokens` stores what the user selected (variable names, @globals, entity_ids) for edit round-trip. Compiler ignores it.
- These must never mix. If they are mixing anywhere that is a bug.

## 📌 sel.tokens Model

- `sel.tokens` is the authoritative selection tracker in all wizard pickers.
- It tracks exactly what the user clicked: variable names (e.g. `"MyLights"`), `@global` tokens (e.g. `"@Fountains"`), or plain entity_ids for physical devices.
- `_getFlatEntityIds(sel.tokens)` is the ONLY place that resolves tokens to real HA entity_ids at commit time. Never resolve inline anywhere else.
- `_getGroupedEntityIdsForTokens(sel.tokens)` is used for capability/service lookup ONLY — returns one array of entity_ids per physical device group.
- `role_tokens` is written to every action and condition node at commit time. It is a required field. The compiler ignores it. The editor preserves it on save.
- On edit, `_route()` restores `sel.tokens` from `role_tokens`. If `role_tokens` absent (old-format node), fall back to `entity_ids` as tokens, then `devices` array, then `role` name.
- `sel.devices` is NOT the authoritative list. Do not use it as the picker source of truth.

## 📌 Device Define / Variable Model

- A device define (piston variable of type `device`) holds a list of friendly names as `initial_value`.
- Friendly names resolve to device groups via `_groupDevices()`. Each group contains ALL entity_ids for that physical device.
- When selected in the wizard, the variable name becomes the `role` token.
- `_getFlatEntityIds` resolves the variable name → friendly names → all entity_ids (for commit).
- `_getGroupedEntityIdsForTokens` resolves the variable name → friendly names → groups → all entity_ids per group (for cap/service lookup).
- For capability lookup: fetch caps for ALL entity_ids in each group, union per group, intersect across groups. Caps named "state" with a device_class are keyed by device_class so illuminance/temperature/battery appear as distinct picker entries.
- Global device variables work exactly like local device variables. Both store friendly names.
- Globals store friendly names in `value` field (not entity_ids).
- Local variables store friendly names in `initial_value` field.

## 📌 Cap/Service Lookup — _getGroupedEntityIdsForTokens

- Replaces `_getPrimaryIdsForTokens` which was wrong — it returned only one entity per device.
- Returns array of arrays: one inner array = all entity_ids for one physical device group.
- For each group: fetch caps/services for ALL entity_ids → union → one cap set per device.
- Intersect cap sets across physical devices — only shared caps shown.
- This means a multi-sensor (motion + illuminance + temperature + battery) exposes ALL its attributes, not just the dominant domain's caps.

## How to Manage Claude — Three Rules

- Keep the UI label separate from the data payload. The user sees friendly names. The JSON stores entity_ids. Always tell Claude explicitly which one a piece of code is responsible for. Never let them mix.
- Demand helper functions, not monolithic code. When solving a multi-step problem, require Claude to isolate each step into its own small function before writing anything.
- Make Claude explain before it codes. If you are unsure Claude understands the problem, say: "Do not write any code yet. Explain in plain English the step-by-step logic and which files you will modify." If the explanation is wrong, correct it before a single line is written.

## Deploy Command (Unraid)
```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## WARNING — /reference folder
Do NOT read any file in /reference. Those are archived session artifacts.
All authoritative specs are in the repo root.

## Completed Sessions
See TASKS_HISTORY.md for full archive.

---

## Current Priority — W-S10 continued (Session 69 work)

### ⚠ Testing reminder for Session 69
Before writing any new code, ask Jeremy to test the following from Session 68:
1. Edit a condition inside an if block — confirm it replaces in place (no new line added)
2. Edit a numeric condition (e.g. illuminance is less than 800) — confirm value pre-fills correctly
3. Edit a condition with a trigger operator — confirm interaction row shows. With condition operator — confirm it hides.
4. Select a piston variable in action picker — confirm Next button enables
5. Open action command picker — confirm params do NOT show until a command is picked
6. Select a variable/global in condition device picker — confirm button shows correct prefix tag

### What was done in Session 68 (W-S10 partial):

**WIZARD_SPEC.md updated to v2.4:**
- sel.tokens model corrected — physical rows store ALL entity_ids (not just primary_entity_id).
  This is correct working behavior. Hard guardrail added. DO NOT CHANGE.
- Union-then-intersect cap model documented with plain English explanation.
- selected_entity_ids references removed (field does not exist — use sel.tokens).
- Edit pre-fill hydration corrected to use role_tokens → sel.tokens.

**GAP-S67-1 ✅ — wizard-condition.js:**
- showInteraction now requires isTrigger(op) — fixed in _goConditionBuilder,
  _refreshConditionRows, and device panel click handler.

**GAP-S67-2 ✅ — wizard-action.js:**
- Next button syncs after every _renderActDevList re-render.
- NOTE: the "primary_entity_id only" part of this gap was WRONG and has been deleted.
  Physical rows correctly store ALL entity_ids in sel.tokens. See WIZARD_SPEC.md v2.4.

**GAP-S67-3 ✅ — wizard-action.js:**
- Removed auto-select of first command and auto-render of params on load.
  Params only render when user picks a command or when editing an existing node.

**GAP-S67-4 ✅ — wizard-condition.js:**
- Device button tag now shows correct prefix: variable / global / device.

**GAP-S64-2 ✅ — closed as won't fix:**
- Old-format pistons should be reimported. Not worth fixing.

**editor.js — condition edit insert-vs-replace bug fixed:**
- Root cause: ln() only wrote data-id and data-type, ignoring all other opts.
  data-parent-block never reached the DOM so parentBlock was always null.
  Wizard opened with edit_condition context instead of if_condition.
  _commitCondition wrapped result in new if block instead of replacing.
- Fix: both ln() functions now write all extra opts as data- attributes (same as gh()).

**wizard-core.js — condition value pre-fill fixed:**
- _route() now uses compiled_value for numeric attributes (avoids unit suffix like
  "800lux" being rejected by type="number" inputs), display_value for all others.

**Files changed this session:**
- WIZARD_SPEC.md → v2.4
- wizard-action.js (GAP-S67-2, GAP-S67-3)
- wizard-condition.js (GAP-S67-1, GAP-S67-4)
- editor.js (condition edit routing fix)
- wizard-core.js (condition value pre-fill fix)

### Still open — W-S10:
- **GAP-S46-5 → W-S10:** Import modal has no file picker — paste-only
- **GAP-S58-2 → W-S10:** Copy/paste/duplicate statements
- **GAP-S68-1 → W-S10:** Import mapper shows raw entity_ids instead of friendly names
- **GAP-S68-2 → W-S10:** Import role mapping does not populate defines initial_value
- **GAP-S68-3 → W-S10:** Action params save as indexed keys {0:'',1:''} instead of named
  fields — _saveDeviceCmd querySelectorAll('[data-param]') reading index not data-param value

**Upload for Session 69:**
wizard-core.js, wizard-action.js, wizard-condition.js, wizard-variable.js,
wizard-loops.js, wizard-statement.js, editor.js, globals.js,
DESIGN.md, WIZARD_SPEC.md, PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md
---

## Architecture — Decisions With Rationale

Each decision below carries its confidence level (Guardrail / Researched / Assumption)
per the Decision Confidence Levels section above. Treat each accordingly.

- **Nested tree model** (Guardrail) — children embedded directly on parent nodes, no
  ID references. Established Session 35 after flat-with-stmt_map caused orphan bugs.
- **All HA YAML through Jinja2 templates only** (Researched) — no inline YAML in
  Python. Lets PistonCore absorb HA YAML syntax changes by updating templates, no
  code release needed. See DESIGN.md Section 14.
- **HACS companion eliminated** (Researched) — direct HA REST/WebSocket API used
  instead. Decision Session 16 after evaluating actual companion contribution.
- **Native HA Script as primary compile target (~95%), PyScript fallback** (Researched)
  — see DESIGN.md Section 3.1 Hybrid Output Model for full rationale. Native YAML
  pistons are owned by HA, survive PistonCore uninstall, traces work natively. This
  is permanent for simple pistons.
- **context_builder.py for fat compiler context assembly** (Assumption) — compiler
  is pure (no HA calls), backend pre-fetches everything. Pattern not yet exercised
  end-to-end. Will be validated by B-1 and S3-1.
- **Piston identity via UUID throughout** (Researched) — all HA artifact names derive
  from UUID, never piston name. Renaming a piston never breaks HA references.
- **Editor renders correctly from valid JSON, never silently drops or corrupts nodes**
  (Guardrail) — replaces earlier "100% of the time" wording. Malformed nodes (missing
  type, unknown type, future logic_version, missing required fields) render as a
  clearly-flagged placeholder row that preserves the node and lets the user repair
  or delete it. The editor must never silently lose data.
- **device_map ELIMINATED** (Researched) — entity_ids stored directly on condition,
  action, and for_each nodes. Map was rejected because it allowed orphaned references.
  If the new bookkeeping (`_reResolveVariableUses` + `globals_index.json`) turns out
  to be slow or unreliable, the path forward is a `variable_refs` field alongside
  `entity_ids` on nodes — NOT reintroducing the map.
- **entity_ids validated against live HA on every compile** (Researched) — Section 8
  of COMPILER_SPEC.md. `resolve_entities()` is the gate. MISSING_ENTITY error stops
  the deploy. Old deployed version stays running in HA.
- **entity_ids on nodes are real HA entity_ids, captured at the wizard commit time**
  (Guardrail) — but they may also be rewritten at three other specific times: when
  `_reResolveVariableUses` runs after a local variable save, when Snapshot import
  role mapping completes, and when a global device variable's Redeploy All flow
  propagates. No other code may write to a node's `entity_ids`. (Replaces the earlier
  "never at runtime" wording — that hid the three legitimate non-wizard write points.)
- **sel.tokens is the authoritative selection tracker — never sel.devices** (Guardrail)
- **role_tokens is a required field on all action and condition nodes** (Guardrail)
  — see WIZARD_SPEC.md v2.4 and the sel.tokens model section below.
- **_getFlatEntityIds is the only place tokens are resolved to entity_ids at commit
  time** (Guardrail) — note: read-side walks of already-committed nodes do NOT
  re-resolve. They trust the entity_ids on the node. If a read-side walk seems to
  need resolution, that's a sign a previous commit didn't fully resolve — fix the
  commit, not the walk.
- **_getGroupedEntityIdsForTokens is the only path for capability/service lookup**
  (Guardrail) — returns array of arrays (one per physical device group). Union
  within group, intersect across groups.

## Device Data Model — Guardrails

Same as the Architecture section — items below are guardrails (scar tissue from real
bugs) unless marked otherwise.

- `API.getDevices()` returns flat entity list with `device_id` field
- Frontend groups by `device_id` → one picker row per physical device
- `primary_entity_id` chosen by domain priority at group time:
  light > switch > cover > fan > climate > lock > media_player >
  input_boolean > input_number > input_select > automation >
  binary_sensor > sensor > person > device_tracker > alarm_control_panel
- **Physical device rows write ALL entity_ids to sel.tokens — NOT just primary_entity_id.**
  This is a hard guardrail. Storing only primary_entity_id was tried and broke the
  capability intersection for multi-entity devices (intersection collapsed to only
  `state` when a multi-entity device was selected alongside another device). See
  WIZARD_SPEC.md v2.4 guardrail section for full rationale. Do not change without
  explicit conversation.
- Piston variable rows write variable name to `sel.tokens`
- Global variable rows write `@name` token to `sel.tokens`
- `_getFlatEntityIds(sel.tokens)` resolves all tokens to flat real entity_ids (commit time)
- `_getGroupedEntityIdsForTokens(sel.tokens)` resolves to grouped entity_ids (cap lookup)
- `role` on nodes = human-readable label (variable name, @global, friendly name) — display only
- `role_tokens` on nodes = raw tokens user selected — edit round-trip only, compiler ignores
- `entity_ids` on nodes = real HA entity_ids — compiler reads these directly
- Device variables: `initial_value` = array of friendly names (local) or `value` (globals)
- Search in device pickers: filter on display label only

## _getFlatEntityIds Resolution Order
For each token in sel.tokens:
1. Starts with `@` → global variable → look up in `WizardCore.globalsData`, get `value` array (friendly names) → resolve each to all entity_ids in group
2. No `.` → piston variable name → look up in `Editor.getPistonVariables()`, get `initial_value` array (friendly names) → resolve each to all entity_ids in group
3. Has `.` → plain entity_id → expand to all entity_ids in its group
Returns flat deduplicated array of real HA entity_ids.

## _getGroupedEntityIdsForTokens Resolution Order
For each token in sel.tokens:
1. Starts with `@` → global variable → friendly names in `value` → groups → all entity_ids per group
2. No `.` → piston variable name → friendly names in `initial_value` → groups → all entity_ids per group
3. Has `.` → plain entity_id → find its group → all entity_ids in group
Returns array of arrays — one inner array per physical device group.

## _reResolveVariableUses Contract
Called after any device variable (define) is saved.
Walks the entire piston tree (statements recursively, triggers, conditions, restrictions).
Finds every node where `role_tokens` contains the variable name.
Re-resolves `entity_ids` from current variable definitions.
Other tokens in the same node (other variables, globals, physical devices) are preserved.
Globals resolve from `_piston._globalsCache` (loaded at editor open via `API.getGlobals()`).

## Multi-Entity Compilation — Confirmed HA Native
- Triggers: pass entity_ids array directly — one trigger block, HA fires on any match
- Actions: pass entity_ids array directly to target.entity_id — one action block
- Conditions: Jinja2 any()/all()/none() template
- Never expand multi-entity into multiple blocks

## Wizard Architecture (Post-Split)
Files: wizard-core.js, wizard-statement.js, wizard-condition.js,
wizard-action.js, wizard-variable.js, wizard-loops.js
All functions top-level (no IIFE wrapping). Shared state via WizardCore object.

## Frontend File Locations
- frontend/js/ — all JS files
- frontend/css/style.css — all CSS

---

## Key State — What's Done
- Nested tree migration complete (Session 35)
- Editor.js nested tree rendering complete (Session 36)
- Wizard split complete (Session 46)
- Globals backend G-1 (Session 48), frontend G-2 (Session 49), CSS G-2b (Session 50)
- Vertical structure lines (Session 47)
- SPEC REWRITE COMPLETE (Session 55): device_map eliminated, entity_ids on nodes
- FULL SPEC AUDIT (Session 57)
- D-S3 COMPLETE (Session 58)
- D-S4 COMPLETE (Sessions 59–60)
- W-S8 COMPLETE (Session 63): all wizard coding done, device picker rebuilt
- W-S9 COMPLETE (Session 64): sel.tokens model, capability intersection, define auto-update
- W-S10 PARTIAL (Sessions 65–67): cap/service intersection rewritten, globals aligned

---

## Open Gaps — All Assigned

### Session 67 gaps (new)

- **GAP-S67-1 → W-S10:** Interaction row shows on conditions — should only show when operator is a trigger
- **GAP-S67-2 → W-S10:** Next button dead when piston variable selected in action picker; also physical rows write all entity_ids to sel.tokens instead of primary_entity_id only
- **GAP-S67-3 → W-S10:** Action command picker shows all params immediately — should wait for command selection
- **GAP-S67-4 → W-S10:** Variable/global names missing prefix in condition device button display

### Session 64 gaps

- **GAP-S64-1 → D-S5:** role_tokens must be documented as required in PISTON_FORMAT.md
- **GAP-S64-2 → W-S10:** Picker not loading correct state for old-format imported pistons

### Session 63 gaps

- **GAP-S63-1 → deferred:** Domain priority investigation — not blocking anything
- **GAP-S63-4 → D-S5:** Spec update — sel.tokens, role_tokens, _getFlatEntityIds,
  device grouping, _getGroupedEntityIdsForTokens, globals friendly name model,
  _reResolveVariableUses contract, globals cache model, UI/data separation rule
- **GAP-S63-5 → W-S10 ✅:** for_each device picker complete (Session 66)

### Pre-session-63 coding gaps still open

- **GAP-S57-5 → G-4:** Global device edit redeploy prompt
- **GAP-S46-4 → G-3:** Imported globals land in piston variables instead of globals store
- **GAP-S46-5 → W-S10:** Import modal has no file picker — paste-only
- **GAP-S58-2 → W-S10:** Copy/paste/duplicate statements
- **GAP-S58-3 → S2-3:** Piston backup trigger/download/restore
- **GAP-S50-1 → S3-1:** Compiler does not handle device initial_value disambiguation
- **GAP-S33-2 → S3-2:** condition_and/or template indentation needs real-world testing
- **GAP-S34-1 → S4-16:** _compile_single_condition has no warnings param
- **GAP-S38-1 → S2-2:** /api/logs route missing from api.py
- **GAP-S39-1 → S2-2:** ha_client import pattern wrong in api.py and compiler.py
- **GAP-S43-4 → S2-3:** Snapshot export not yet implemented
- **GAP-S30-3 → S4-16:** Double config load per compile call
- **GAP-S47-1 → S4-16:** Structure line position needs fine-tuning (cosmetic)
- **GAP-S45-1 → S4-16:** set_variable wizard doesn't normalize $ prefix (cosmetic)

### Spec gaps still open

- **MISSING_SPECS Item 11 (partial)** → post-S3-2: Production sample pistons
- **MISSING_SPECS Item 12** → post-S3-1: Write BEST_PRACTICES.md
- **MISSING_SPECS Item 15** → before S4-10: write-a-piston.md actual prompt content
- **MISSING_SPECS Item 25** → S4-17: HA entity state subscription vs polling
- **MISSING_SPECS Item 26** → W-S10: Copy/paste/duplicate statements
- **MISSING_SPECS Item 27** → S2-3: Piston backup trigger/download/restore

---

## Spec File Versions (after Session 67)
- DESIGN.md v1.6
- PISTON_FORMAT.md v2.1 (needs update — GAP-S63-4, GAP-S64-1)
- COMPILER_SPEC.md v1.5
- WIZARD_SPEC.md v2.2 (needs update — GAP-S63-4)
- STATEMENT_TYPES.md v2.1
- FRONTEND_SPEC.md v1.4
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0


After B-1 and S3-1, do a pass to audit all raw HTML insertions in editor.js and the wizard files to confirm _esc() is applied everywhere. Also check Google Fonts import in style.css for offline HA compatibility.
