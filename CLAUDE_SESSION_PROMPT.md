# PistonCore — Claude Session Prompt

## What is PistonCore?
Open-source WebCoRE-style visual automation builder for Home Assistant.
GitHub: github.com/jercoates/pistoncore
Stack: Python/FastAPI backend, vanilla JS/HTML/CSS frontend, Jinja2 templates,
SQLite/JSON storage, Docker on Unraid at port 7777.
Jeremy has no formal programming background — relies entirely on Claude for
architecture and code. Never does targeted/line-level edits — only full file replacements.

## ⭐ THE LOAD-BEARING RULE — Device → Entity Resolution (read first)

If this breaks, nothing works — the editor shows pretty text that compiles to nothing.
This is the single most important contract and the hardest part of the project.

- **Variables and globals store device NAMES (friendly names) — NEVER entity IDs.** The
  friendly name is the lookup key: it's how PistonCore asks HA for that device's current
  entity IDs. A variable is a device list. Entity IDs are pulled live from HA when used.
- **Nodes store entity IDs** — the attribute-bearing entity, one per device, for the chosen
  function. Illuminance condition on 2 devices → the 2 `*_illuminance` entity IDs. Not
  battery, not motion, not temperature.
- **Resolution happens at the NODE, at commit time**, because the same variable can feed
  different attributes in different statements (illuminance condition, motion trigger,
  battery condition — same variable, three different resolved entity sets, one per node).
- **Only nodes hold entity IDs. Variables and globals never do. One rule, no exceptions.**

Authoritative: PISTON_FORMAT.md "⭐ THE LOAD-BEARING RULE". Diff anchor: REFERENCE_PISTON_V2.json.

**Current code does NOT fully obey this yet** — `_getFlatEntityIds` returns the whole device
cluster instead of the attribute-bearing entity (GAP-S69-9, the W-S11 fix). The variable side
is already correct (stores names, not IDs). See TASKS.md W-S11.

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
- `_getFlatEntityIds(name, attribute)` resolves the variable name → friendly names → the
  attribute-bearing entity per device (for commit — see load-bearing rule and GAP-S69-9).
- `_getGroupedEntityIdsForTokens` resolves the variable name → friendly names → groups → all entity_ids per group (for cap/service lookup — here ALL entities are correct, that's how the capability intersection works).
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

## Current Priority — see TASKS.md

Open work is grouped into session bundles in TASKS.md. Default next session is **W-S11 —
Device-Data Core Fix** (GAP-S69-9: make `_getFlatEntityIds` attribute-aware). That is THE
blocker — until nodes carry attribute-bearing entity IDs, the round-trip and the compiler
cannot work.

Workflow note: Jeremy fixes what's in front of him. When a new problem surfaces during
testing, log it into the right TASKS.md group and push the planned session back a slot —
groups stay intact, order flexes. At session end, move completed items to TASKS_HISTORY.md
and roll partial-fix remainders forward (remind Jeremy — it's not automatic).

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
**TARGET behavior (what the spec now requires — see GAP-S69-9, not yet in code):**
`_getFlatEntityIds(tokens, attribute)` is attribute-aware. For each token in sel.tokens:
1. Starts with `@` → global variable → look up `value` array (friendly names) → resolve each
   to the ONE entity per device matching `attribute`
2. No `.` → piston variable name → look up `initial_value` array (friendly names) → resolve
   each to the ONE entity per device matching `attribute`
3. Has `.` → plain entity_id → use as-is (or resolve within its group to the attribute-bearing entity)
Returns flat deduplicated array of the attribute-bearing entity IDs, one per device.
**Condition passes the chosen attribute; action passes the command domain/service (→ the
controllable entity). No attribute given → fall back to all entities in group.**

**CURRENT code behavior (the bug):** `_getFlatEntityIds(tokens)` takes no attribute and returns
ALL entity_ids for ALL sub-entities of every device. That is GAP-S69-9 — the W-S11 fix. Do not
treat the current "all entities" behavior as correct; it's the thing being fixed.

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
- SPEC REWRITE (Session 55): device_map eliminated, entity_ids on nodes
- FULL SPEC AUDIT (Session 57), D-S3 (Session 58), D-S4 (Sessions 59–60)
- W-S8 (Session 63), W-S9 (Session 64), W-S10 partial (Sessions 65–68)
- **Session 69 — D-S5 + D-S5b COMPLETE + full code↔spec reconciliation:**
  - All specs reconciled to actual code (Path A — code is authoritative).
  - Triggers/conditions/restrictions confirmed as TOP-LEVEL wrapper arrays (not nested
    `is_trigger` nodes). PISTON_FORMAT.md documents this; compiler reads them directly.
  - Variable schema corrected to actual field names: `var_type` / `initial_value`
    (not `type` / `default_value`). `initial_device_names` is NOT written by code —
    `initial_value` holds friendly names for both data and display.
  - Device-data model LOCKED: variables/globals store device names, nodes store
    attribute-bearing entity IDs. The load-bearing rule (top of this file).
  - logic_version 1 / device_map RETIRED — no migration, sandbox pistons regenerated as v2.
  - Compiler specs (COMPILER_SPEC.md, PYSCRIPT_COMPILER_SPEC.md) intentionally FROZEN/STALE
    until JSON structure is final (stale notice at top of each). Rewrite in D-S6.
  - REFERENCE_PISTON_V2.json created — the v2 diff anchor.
  - Live code review found GAP-S69-9 (the root-cause device bug) and grouped all open
    gaps into session bundles in TASKS.md.

---

## Newly Locked Decisions (Session 69) — add to Researched bucket
- **Triggers/conditions/restrictions are top-level wrapper arrays** (Researched — confirmed
  against editor.js). The compiler reads `_piston.triggers` directly; it does NOT walk
  `statements` for `is_trigger` nodes.
- **logic_version 1 retired** (decision) — no v1→v2 migration. Reject non-v2 pistons on load.
- **Compiler specs frozen** (decision) — directional only until JSON final; rewrite in D-S6.

---

## Open Gaps — see TASKS.md

All open gaps and fixes live in TASKS.md, grouped into session bundles so related bugs get
fixed together. This prompt no longer duplicates the gap list (one task file — completed work
moves to TASKS_HISTORY.md). Default next bundle: **W-S11 — Device-Data Core Fix**.

---

## Spec File Versions (after Session 69)
- DESIGN.md v1.8
- PISTON_FORMAT.md v2.3
- WIZARD_SPEC.md v2.6
- STATEMENT_TYPES.md v2.2
- FRONTEND_SPEC.md v1.5
- HA_LIMITATIONS.md — Section 3 corrected
- COMPILER_SPEC.md v1.5 — FROZEN/STALE (rewrite in D-S6)
- PYSCRIPT_COMPILER_SPEC.md — FROZEN/STALE (rewrite in D-S6)
- SAMPLE_PISTONS.md v1.0
- AI_PROMPT_SPEC.md v2.0 (stale — old device_map model, rewrite before AI-import work)
- REFERENCE_PISTON_V2.json — the v2 diff anchor

After B-1 and S3-1, audit all raw HTML insertions in editor.js and the wizard files to
confirm _esc() is applied everywhere. Also check Google Fonts import in style.css for
offline HA compatibility.
