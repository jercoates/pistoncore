# PistonCore — With-Block & Task Framework Spec

**Version:** 1.0 (NEW — standalone, ledgered)
**Status:** Implementation spec. Written AGAINST THE CODE, not against the older specs.
**Last Updated:** June 2026 (Session 73)
**Authority for behavior/visual:** WebCoRE (`webcore3.txt` = piston.module.html, `webcore1.txt`
  = app.js) + the editor screenshots. **Authority for data shape:** the actual frontend
  code as it stands today (`editor.js`, `wizard-action.js`, `wizard-core.js`,
  `wizard-statement.js`), which is the source of truth — the old specs (PISTON_FORMAT,
  STATEMENT_TYPES, WIZARD_SPEC) drifted behind code fixes and are NOT authoritative here.

---

## HOW TO READ THIS SPEC — the ledger convention

This spec follows the Verified / Decided / Assumed discipline (the same convention the
Speak and Notify specs use). Every non-obvious claim is one of three things:

- **VERIFIED** — traced directly in the code (file + line cited) or in the WebCoRE source.
  These are facts about what exists today. Not opinions.
- **DECIDED** — Jeremy's calls. The product direction. Not negotiable without Jeremy.
- **ASSUMED** — Claude's gap-fill: a proposed name, shape, or rule Jeremy did not
  explicitly decide. **Never load-bearing. Override freely in coding.** If a thing is not
  marked ASSUMED, it is either Verified or a Jeremy Decision.

The reason for this: code fixes were made by ignoring stale specs and making the product
work; the specs were never updated to match. This document exists to STOP that drift —
it records what the code actually does and what must change, so the next coding session
builds on truth, not on guesses.

---

## 0. The governing principles (DECIDED)

1. **Render exactly like WebCoRE.** Open a piston in WebCoRE and in PistonCore side by
   side and see no difference. This is what makes migration trivial. The visual and the
   command vocabulary are WebCoRE's — PistonCore reproduces them. (Jeremy, Session 73.)
2. **Storage is Claude's to design for reliability.** How a piston is saved is not WebCoRE's
   flat format — it is PistonCore's nested JSON. The only constraint on storage is: it must
   round-trip editor → JSON → editor losslessly, preserve order exactly, and feed the
   compiler a correct ordered sequence. (Jeremy, Session 73.)
3. **Framework for ALL task types; implement Jeremy's pistons.** The wizard/editor/JSON must
   be STRUCTURED so any WebCoRE task type has a defined home and can be added later without
   re-architecting. Only the commands Jeremy's real pistons use need a working end-to-end
   path now. Everything else is a registered-but-unhandled slot, not a missing concept.
   (Jeremy, Session 73.)
4. **"Can HA do it?" decides native / PyScript / cannot-do.** For each command: native HA
   Script if possible; else PyScript; else it genuinely cannot cross — and that gets NOTED
   in HA_LIMITATIONS.md for the docs, never silently dropped. The editor still renders and
   round-trips a cannot-do command losslessly; the inability is a compile-time outcome
   (debug page), not an editor refusal. (Jeremy, Session 73.)
5. **Order is load-bearing.** Tasks fire top to bottom in sequence, not concurrently.
   `Set Volume; Speak text;` means volume THEN speak. Array position = execution order.
   Anything that reorders tasks on round-trip or compile is a correctness bug. (Jeremy,
   Session 73; visible in every screenshot.)

---

## 1. THE CENTRAL FINDING — the container already exists; the wizard doesn't drive it

This is the most important section. Read it before touching any code.

**A WebCoRE `with` block is, in PistonCore, an `action` node whose `tasks[]` array holds
an ordered list of tasks.** The node is the "with {devices}", the array is the "do ...".
This shape is correct and already in the code. The bug is NOT the shape — it is that the
wizard's commit and edit paths never use the multi-task machinery that already exists on
the editor side.

### 1.1 What already works (VERIFIED — keep it, document it, do not rebuild)

- **Action node shape** — `type:'action'`, `role`, `role_tokens`, `entity_ids`, `tasks[]`,
  `description`, `disabled`. (VERIFIED: wizard-action.js `_saveDeviceCmd` lines 786–818;
  PISTON_FORMAT action schema agrees.) The `tasks[]` array is the universal ordered task
  container. The shape is sound.
- **Task object shape** — `{ id, command, domain, ha_service, parameters, description }`.
  (VERIFIED: wizard-action.js lines 786–793.)
- **Editor renders multi-task blocks correctly** — it iterates ALL tasks, renders each as
  its own clickable line carrying `{ id: task.id, type:'task' }`, and emits the
  `· add a new task` ghost affordance with `{ 'block-id': id }`. (VERIFIED: editor.js
  lines 364–387.) The render side is complete. It already does what WebCoRE does visually:
  `with` / role / `do` / one line per task / `+ add a new task` / `end with;`.
- **The append-a-task seam exists** — `insertStatement(context, data, meta)` with
  `context === 'task'` + `meta.blockId` (the action node id) + no `meta.branch` finds the
  action node and **pushes the task, or replaces it by matching `task.id`**. (VERIFIED:
  editor.js lines 1124–1136.) This is exactly the append-and-edit-by-identity behavior a
  multi-task with-block needs. It is built. It is just not called correctly by the wizard.

### 1.2 What is broken (VERIFIED — these are the real fixes)

**BUG A — `_saveDeviceCmd` overwrites instead of appends.** (GAP-S72-1, true root cause.)
On every commit it builds a whole new action node and writes `tasks: [newTask]` —
replacing the entire tasks array with a single task — both on new (line 816) and on edit
(line 807). "Add more" (lines 821–825) resets command/params and reopens the picker, but
the previous task was already discarded, never appended. (VERIFIED: wizard-action.js
lines 800–818, 821–825.) The node shape can hold many tasks; the commit path never puts
more than one in it.

**BUG B — task edit always loads `tasks[0]`.** When a task line is clicked to edit, the
editor click-targets the specific `task.id` (editor.js line 383), but `_route` reads only
`_editNode.tasks[0]` (VERIFIED: wizard-core.js lines 642–646, and lines 651 for the
location case). So editing the 2nd, 3rd, … task in a block is impossible — the wizard
always pre-fills task index 0 regardless of which line was clicked.

**BUG C — location/virtual commands cannot live inside a device with-block.**
`_saveLocationCmd` commits each location command either as a standalone sibling statement
(`set_variable`, `wait`, `log_message`, `call_piston` — VERIFIED: wizard-action.js lines
454–481) or as a FAKE one-task action node with `devices:['Location']` (notify, http,
set_mode, raise_event — VERIFIED: lines 482–522). Neither path appends a task into a real
device with-block's `tasks[]`. So `with {@Speakers} do { Set Volume; Speak text; Wait 5
min; }` — device tasks and a virtual Wait interleaved in one block, which WebCoRE produces
natively (screenshots: image set 2 of this session) — has no representable form today.

### 1.3 The framework conclusion (DECIDED direction + ASSUMED shape where noted)

The fix is NOT "build a with-block model." It is:

1. **Rewire `_saveDeviceCmd`** to commit ONE task through the existing `'task'` append seam
   against the block's action-node id — not to rebuild the node with `tasks:[one]`.
2. **Rewire task-edit hydration** so `_route` loads the clicked task by `task.id`, not
   `tasks[0]`, and so commit replaces THAT task by id (the seam already replaces by id —
   editor.js line 1131–1132 — it just needs the right id threaded through).
3. **Give virtual/location commands an in-block task form** so they append into the same
   `tasks[]` as device tasks, interleaved, order preserved — instead of becoming standalone
   siblings or fake-device nodes.

Item 3 is the only part with real design work, and it needs a task-kind discriminator so
the compiler can route each task (device service vs virtual action). See Section 3.

---

## 2. The data model (what the JSON looks like — Verified shape + the one change)

### 2.1 The action / with-block node (VERIFIED — current shape, keep)

```json
{
  "type": "action",
  "id": "stmt_xxxxxxxx",
  "async": false,
  "role": "@Speakers",
  "role_tokens": ["@Speakers"],
  "entity_ids": ["media_player.sonos_kitchen", "media_player.garage_sonos"],
  "tasks": [ /* ordered list — see 2.2 */ ],
  "description": null,
  "disabled": false
}
```

- `role` / `role_tokens` / `entity_ids` follow the existing device-resolution rules
  (the load-bearing rule: variables/globals store names; nodes store resolved entity_ids).
  Unchanged by this spec.
- `tasks[]` is an **ordered** array. Index = execution order. (DECIDED: order is
  load-bearing.)

### 2.2 The task object — device task (VERIFIED — current shape, keep)

```json
{
  "id": "task_xxxxxxxx",
  "command": "volume_set",
  "domain": "media_player",
  "ha_service": "media_player.volume_set",
  "parameters": { "volume_level": 0.7 },
  "description": null
}
```

### 2.3 The task object — virtual/location task (ASSUMED shape — the proposed change)

To put a virtual command (Wait, Set variable, notify, log, …) inside a device with-block's
`tasks[]`, it needs a task form that the compiler can tell apart from a device service
call. **Proposed (ASSUMED — override freely): add a `kind` discriminator to every task.**

```json
{
  "id": "task_xxxxxxxx",
  "kind": "virtual",
  "command": "wait",
  "parameters": { "duration": 5, "duration_unit": "minutes" },
  "description": null
}
```

- `kind: "device"` (default if absent, for back-compat) → a device service call; compiler
  emits a service call against the block's `entity_ids`. Carries `domain` / `ha_service`.
- `kind: "virtual"` → a non-device action (Wait, Set variable, notify, log, execute piston,
  …); ignores the block's devices; compiler routes by `command`. Carries no `domain`/
  `ha_service` — the compiler resolves the HA mapping by `command` (and by the native/
  pyscript/cannot-do routing of Section 4).
- The task `parameters` for a virtual task mirror the standalone-statement payloads the
  code already builds in `_saveLocationCmd` (e.g. wait → `{duration, duration_unit}`,
  set_variable → `{variable, value:{type,…}}`, log → `{message, level}`). Reuse those
  shapes; do not invent new ones. (VERIFIED source for the payloads: wizard-action.js
  lines 454–522.)

> **ASSUMED — the `kind` field name and the device/virtual split.** This is Claude's
> proposed discriminator. An equally valid alternative the coding session may prefer:
> keep using `domain`/`ha_service` for device tasks and detect a virtual task by a
> reserved `domain` (the code already uses `domain:'location'` for http/set_mode/
> raise_event — wizard-action.js lines 494, 504, 511). Either works. Pick the one that
> makes the compiler's routing cleanest. The DECIDED requirement is only that a task
> inside `tasks[]` is unambiguously classifiable as device-vs-virtual and ordered.

### 2.4 Standalone statements still exist (VERIFIED — do not remove)

`wait`, `set_variable`, `log_message`, `call_piston` also exist as **top-level statement
nodes** (VERIFIED: wizard-action.js `_saveLocationCmd` builds them as such, lines 454–481;
STATEMENT_TYPES documents them). WebCoRE allows the same command as either a standalone
step OR a task inside a `with`. Both forms must remain. The framework duality:

- A virtual command chosen from the **statement picker** (or the **Location** with-target)
  → standalone statement node, as today.
- A virtual command chosen from **`+ add a new task` inside an existing device with-block**
  → a `kind:"virtual"` task appended to that block's `tasks[]` (the new path, Section 2.3).

---

## 3. Wizard behavior contract (what must happen — DECIDED behavior, code-located)

### 3.1 Building a with-block, multiple tasks (fixes BUG A)

1. User adds an action → picks device(s)/group/global → `_goCommandPicker` (device) or the
   block is created. The action node is inserted with its `entity_ids`/`role`/`role_tokens`
   and an initially-1-task `tasks[]` (or empty, then first task appended — coding choice).
2. **"Add more" appends.** On Add-more, the wizard must commit the current task via
   `insertStatement('task', taskObj, { blockId: <action node id> })` — the existing append
   seam (editor.js 1124–1136) — then reopen the command picker for the SAME block, SAME
   devices, with command/params reset. It must NOT rebuild the action node. (Fixes the
   `tasks:[newTask]` overwrite at wizard-action.js 807/816.)
3. Each appended task gets a fresh `task_` id (VERIFIED helper exists: `_taskId()`,
   wizard-action.js line 787).
4. Order = append order = array order. (DECIDED.)

### 3.2 Editing one task in a multi-task block (fixes BUG B)

1. Editor already renders each task line with its own `task.id` and `type:'task'`
   (VERIFIED: editor.js 383). Clicking a task opens the wizard with that task as the edit
   target.
2. `_route` must hydrate the **clicked task by id**, not `tasks[0]`. The clicked `task.id`
   must be threaded into the wizard's edit context. (Fixes wizard-core.js 642–646 / 651.)
3. On Save, commit replaces THAT task by id via the same append seam (which already does
   push-or-replace-by-id: editor.js 1131–1132). Sibling tasks and the block's
   `entity_ids`/`role` are untouched.

### 3.3 Deleting one task (currently unspecified — DECIDED behavior, needs a code path)

- Delete in task-edit mode removes only the addressed task by id from `tasks[]`.
- (ASSUMED) If it was the last remaining task, the empty `action` node is removed entirely —
  an action node with zero tasks is not a valid with-block. Confirm with Jeremy if a
  zero-task block should instead be kept as an empty `with … do … end with`. Default:
  remove the empty node.
- A delete-task path does not clearly exist in the current `insertStatement` seam (it does
  insert/replace, not remove). The coding session must add a remove-by-task-id path
  (parallel to the existing branch-delete logic in editor.js — `_deleteEditNode` exists in
  wizard-core for whole nodes; a per-task analog is needed).

### 3.4 Interleaving virtual tasks into a device block (fixes BUG C)

- Inside an existing device with-block, `+ add a new task` must offer BOTH the device
  commands (the current `_goCommandPicker` intersection list) AND the virtual/location
  commands (the `LOCATION_COMMANDS` list), in one picker, matching WebCoRE's three-group
  "Do…" dropdown (Section 5).
- Choosing a virtual command there appends a `kind:"virtual"` task (Section 2.3) into the
  block's `tasks[]` at the current position — NOT a standalone statement, NOT a fake
  Location node. Order preserved.
- (VERIFIED constraint) This is the path that does not exist today; `_saveLocationCmd`
  only ever produces standalone/fake-device nodes. This is the real new construction.

### 3.5 The "With… Location" path stays (VERIFIED — keep)

Selecting the **Location** virtual device as a with-target (`__location__`) and adding
virtual commands there remains valid (wizard-action.js `_goLocationCmdPicker`,
`_saveLocationCmd`). This is how a pure non-device task block is built. Unchanged, except
that its commit should also flow through the task framework if the coding session unifies
the paths (optional — the DECIDED requirement is only that device blocks can hold virtual
tasks, item 3.4).

---

## 4. Command routing — native / PyScript / cannot-do (DECIDED policy; classification PENDING)

Per principle 4: each command is classified by "can HA do it?". The routing lives in the
mechanism the old specs call `target-boundary.json`.

> **UNVERIFIED — `target-boundary.json` existence.** The old specs (HA_LIMITATIONS.md,
> STATEMENT_TYPES.md) refer to `target-boundary.json` as the file that forces PyScript for
> `break`/`on_event`/`cancel_pending_tasks`. Whether this file actually exists in the repo,
> or whether the boundary is hardcoded, is NOT confirmed from the frontend code provided.
> The coding session MUST check the backend for it and either extend it or create it. Do
> not assume it exists. (This is exactly the kind of stale-spec claim that needs verifying
> against code, per this document's reason for existing.)

The three-way status per command:
- **native** — compiles to native HA Script YAML.
- **pyscript** — no native equivalent; forces PyScript compile target.
- **cannot-do** — no HA equivalent at all (native or PyScript). Renders + round-trips in
  the editor losslessly; compiler writes a debug-page message; NOTED in HA_LIMITATIONS.md
  for the docs. (DECIDED.)

**The full command classification is a SEPARATE deliverable** (extends HA_LIMITATIONS.md +
the boundary file). It requires checking each command against CURRENT HA — and current HA
moves monthly, so version-sensitive commands (notify transition, HSM, web request) must be
researched live, not classified from memory. Known anchors from existing specs (VERIFIED in
HA_LIMITATIONS / STATEMENT_TYPES): `break`, `on_event`, `cancel_pending_tasks` → pyscript.
Hubitat-only commands surfaced by Jeremy's pistons (e.g. **Set Hubitat Safety Monitor
status**, file I/O, fuel streams, piston tiles, IFTTT, LIFX scenes) → almost certainly
cannot-do, pending confirmation + an HA-side adaptation note.

---

## 5. The picker menus — full vocabularies to populate (the "save all choices somewhere")

This is the menu source data so the pickers can be populated. Two parts: (A) what the code
defines today (VERIFIED), and (B) the full WebCoRE command universe the framework must be
able to represent (from the screenshots + WebCoRE source).

### 5.1 Statement type picker (VERIFIED — wizard-core.js STATEMENT_TYPES, lines 464–481)

**Basic:** If Block (`if_block`), Action (`action`), Timer (`timer`).
**Advanced:** Switch (`switch`), Do Block (`do_block`), On Event (`on_event` — pyscript),
For Loop (`for_loop`), For Each Loop (`for_each`), While Loop (`while_loop`), Repeat Loop
(`repeat_loop`), Break (`break` — pyscript), Exit (`exit`).

> Note: `wait`, `set_variable`, `log`, `wait_for_state`, `call_piston` are reachable as
> statements via the Action → Location path, not as top-level cards here. WebCoRE's
> statement picker (dialog-edit-statement) lists them under Execution. Coding session:
> decide whether to surface them as top-level cards too, to match WebCoRE's "Execution"
> group. (ASSUMED gap, not decided.)

### 5.2 Device "Do…" command picker — three groups (VERIFIED structure from screenshots)

WebCoRE's command dropdown inside a `with {devices}` block has three optgroups
(this session's first screenshot set):

1. **Commands available to all devices** — the capability INTERSECTION across all selected
   devices. (VERIFIED mechanism: wizard-action.js `_goCommandPicker` / service intersection,
   lines ~640–697; `DOMAIN_CAPS` static fallback wizard-core.js 93–172.)
2. **Commands available to only some devices** — marked `emulated`. WebCoRE synthesizes
   these for devices lacking native support. (ASSUMED: treat as NOT v1 — most don't map
   cleanly to HA. Flag, don't build, unless a specific one is needed.)
3. **Location commands (non-device)** — marked `location`. The virtual command list. See 5.4.

### 5.3 Operand / value types for task parameters (VERIFIED — screenshots + code)

Any task parameter value can be one of (WebCoRE "Text"/"Level" dropdowns, screenshots
image set 2): **Value | Variable | Expression | Argument** (and Physical device(s) /
Virtual device for device-valued params). The code already builds typed operand shapes for
set_variable (VERIFIED: wizard-action.js 457–461 — `{type:'literal'|'variable'|
'expression'}`). (DECIDED: full operand support is the WebCoRE standard; implement
Value/Variable/Expression for Jeremy's pistons, Argument + device-valued params are
framework slots.)

This matters beyond set_variable: e.g. **Wait with a variable duration**
(`Wait {integer_Lock_Confirm_Wait} seconds` — VERIFIED in Jeremy's alarm piston screenshot)
and **Set Volume from a variable** (`Set Volume to {integer_Speaker_Volum}`). So task
parameter values must accept operands, not just literals.

### 5.4 Location / virtual command list (VERIFIED current + FULL WebCoRE universe)

**Currently in code** (wizard-core.js LOCATION_COMMANDS, lines 452–461) — these are the
implemented-or-stubbed slots:

| id | label | current commit (wizard-action.js) |
|---|---|---|
| `set_variable` | Set variable… | standalone `set_variable` node (454–465) |
| `execute_piston` | Execute piston… | standalone `call_piston` node (476–481) |
| `wait` | Wait… | standalone `wait` node (466–470) |
| `send_notification` | Send push notification… | fake `action` node, `persistent_notification.create` (482–490) |
| `log` | Log to console… | standalone `log_message` node (471–475) |
| `http_request` | Make an HTTP request… | fake `action` node, `location.http_request` (491–500) |
| `set_mode` | Set HA mode… | fake `action` node, `location.set_mode` (501–507) |
| `raise_event` | Raise an event… | fake `action` node, `location.raise_event` (508–516) |

**Full WebCoRE location command universe** (from this session's screenshots — the framework
must be able to REPRESENT all of these; only Jeremy's are implemented now). Listed so the
picker menu data exists somewhere:

Append to file, Append to fuel stream, Cancel all pending tasks, Capture attributes to
global store, Capture attributes to local store, Clear fuel stream, Clear piston tile,
Delete file, Execute piston, Execute Rule, LIFX – Activate scene, LIFX – Breathe,
LIFX – Pulse, LIFX – Set State, LIFX – Toggle, Log to console, Make a web request,
No operation, Overwrite fuel stream, Parse JSON data, Pause piston, Read from file,
Read fuel stream, Restore attributes from global store, Restore attributes from local
store, Resume piston, Send an IFTTT Maker event, Send email, Send notification,
Send PUSH notification, Send SMS notification, Set Hubitat Safety Monitor status,
Set location mode, Set piston state, Set piston tile colors, Set piston tile footer,
Set piston tile mouseover title, Set piston tile text, Set piston tile title,
Set piston tile, Set variable, Store media, Wait for date & time, Wait for time,
Wait randomly, Wait, Wake a LAN device, Write to file.

> Each entry needs a status (native / pyscript / cannot-do) — that is the Section 4
> classification deliverable. Many (file I/O, fuel streams, piston tiles, IFTTT, LIFX,
> HSM) are Hubitat-platform-specific and will be cannot-do in HA. The picker should still
> list them (render fidelity / lossless import), with cannot-do ones flagged.

### 5.5 Device command universe for media_players (from screenshots — the `@Speakers` block)

Device commands shown for the speaker group (this session's screenshots, "all devices"
group): Lower volume, Mute, Next track, Pause, Play, Play track and restore…, Play track…,
Previous track, Raise volume, Refresh, Restore track…, Resume track…, Set level…,
Set track…, Set Volume…, Speak text and restore…, Speak text…, Speak…, Stop, Unmute,
plus custom (`updateIpAddress`). These come live from the device's HA services
(`API.getServices` / intersection); they are not a static list and should not be hardcoded —
the picker pulls them per-selection. Listed here only to document what the speaker case
surfaces. (VERIFIED source: device service intersection path, wizard-action.js ~640–697.)

### 5.6 Condition / trigger operator vocabularies (VERIFIED — wizard-core.js 33–78)

Already fully defined in code; recorded here for completeness so the picker spec is in one
place. **Conditions** (no ⚡): is, is any of, is not, is not any of, is between, is not
between, is even, is odd, was, was any of, was not, was not any of, changed, did not
change, is equal to, is not equal to, is less than, is less than or equal to, is greater
than, is greater than or equal to. **Triggers** (⚡): changes, changes to, changes to any
of, changes away from, changes away from any of, drops, drops below, drops to or below,
rises, rises above, rises to or above, stays, stays equal to, stays any of, stays away
from, stays away from any of, stays unchanged, gets, gets any, receives, happens daily at,
event occurs, is any and stays any of, is away and stays away from. (VERIFIED.)

### 5.7 Virtual devices / system vars (VERIFIED — wizard-core.js 439–449)

Virtual devices: Location, Time, Date, Mode, System Start. System vars:
`$currentEventDevice`, `$previousEventDevice`, `$device`, `$devices`, `$location`.

---

## 6. The work, as a coding checklist (fix-oriented, code-located)

In dependency order. Each item cites the code it touches.

1. **Task-id threading for edit** — thread the clicked `task.id` from the editor's task
   line (editor.js 383) into the wizard edit context so `_route` (wizard-core.js 642–646,
   651) can hydrate the correct task instead of `tasks[0]`. Foundation for both edit and
   correct replace. (Fixes BUG B.)
2. **`_saveDeviceCmd` → append, not overwrite** — commit one task via
   `insertStatement('task', task, {blockId})` (editor.js seam 1124–1136); on Add-more,
   reopen picker for the same block; on edit, replace by the threaded task id. Stop writing
   `tasks:[newTask]` / rebuilding the node (wizard-action.js 800–818). (Fixes BUG A.)
3. **Per-task delete** — add a remove-by-task-id path (editor.js, parallel to existing node
   delete) and wire the Delete button in the task editor to it. Remove empty action node if
   last task deleted (confirm with Jeremy — Section 3.3). (New.)
4. **Virtual tasks inside device blocks** — `+ add a new task` in a device block offers the
   `LOCATION_COMMANDS` list alongside device commands (one picker, WebCoRE's three groups,
   Section 5.2); choosing a virtual command appends a `kind:"virtual"` task (Section 2.3) to
   the block's `tasks[]` instead of a standalone/fake node. Editor render must handle a
   virtual task line (extend editor.js 378–384's `_friendlyCmd` rendering to virtual kinds).
   (Fixes BUG C — the real new construction.)
5. **Operand-valued task parameters** — task params accept Value/Variable/Expression, not
   just literals (Section 5.3); needed for variable-duration Wait and variable Set Volume
   from Jeremy's pistons. Reuse the operand shape already in `_saveLocationCmd` (457–461).
6. **Command classification + `target-boundary.json` verification** — SEPARATE deliverable
   (Section 4). Verify the boundary file exists or create it; classify the full command
   list native/pyscript/cannot-do; extend HA_LIMITATIONS.md with the cannot-do set
   (HSM, file I/O, etc.) and the HA adaptation notes.

Items 1–5 are the with-block framework and make Jeremy's pistons buildable. Item 6 is the
routing/classification that tells the compiler what each task becomes.

---

## 7. What this spec deliberately does NOT decide (open, for Jeremy or the coding session)

- The `kind` discriminator name/shape (Section 2.3) — ASSUMED, override freely.
- Whether a zero-task action node is removed or kept (Section 3.3) — needs Jeremy.
- Whether standalone `wait`/`set_variable`/`log` get top-level statement-picker cards to
  match WebCoRE's Execution group (Section 5.1) — ASSUMED gap.
- The full native/pyscript/cannot-do classification (Section 4 / item 6) — separate
  research deliverable against current HA; not done here.
- `emulated` device commands (Section 5.2 group 2) — flagged not-v1, not decided.
- Form-layout pixel fidelity of each task editor vs WebCoRE's `dialog-edit-task` — the JSON
  contract here does not depend on it; match the layout at coding time from webcore3.txt.

---

## 8. Summary — one line each

- **The with-block is an `action` node + ordered `tasks[]`.** Shape exists, editor renders
  it, the append seam exists. (VERIFIED.)
- **Three real bugs:** `_saveDeviceCmd` overwrites tasks; task-edit loads `tasks[0]`;
  virtual commands can't live inside a device block. (VERIFIED, located.)
- **The fix is wiring, not architecture** — drive the existing `'task'` append/replace seam
  by task id, and give virtual commands an in-block task form.
- **Order is load-bearing; render matches WebCoRE; storage is ours; framework holds all
  commands, implement Jeremy's.** (DECIDED.)
- **Routing (native/pyscript/cannot-do) is a separate classification deliverable** against
  current HA, extending HA_LIMITATIONS.md + the (unverified) boundary file.
