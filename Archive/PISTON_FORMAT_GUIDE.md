# PistonCore — Piston Data Model (Format Guide)

**What this document is:** the *narrative* layer for the piston JSON — the load-bearing
rules, the why, the worked examples, and how the pieces relate.

**What this document is NOT:** it does not define JSON structure. All node shapes, fields,
and array-order rules live in **one place only — PISTON_JSON_STRUCTURE_MAP.md (the Structure
Map).** This guide points to the map; it never restates a schema. If you want "what fields
does an `if` node have," that is the Structure Map, not here.

**Why the split:** duplicated structure is what rotted the prior spec — the same shapes
written in multiple places drifted apart and no copy could be trusted. There is now exactly
one structural authority. Every other document points at it and never copies it. You can
change a field in the map and nothing here becomes wrong, because nothing here restates the map.

---

## ⭐ THE LOAD-BEARING RULE — Device → Entity Resolution

**Read this before anything else. If this is wrong, nothing works — the editor shows pretty
text that compiles to nothing.**

### The two layers

**Layer 1 — Variables and globals are DEVICE LISTS.** They store device references (friendly
names). They NEVER store entity IDs. The friendly name is the lookup key.

**Layer 2 — Nodes (condition / action / for_each / trigger) store ENTITY IDs.** At the moment
the wizard commits a statement, it resolves the device list to the entity that carries that
attribute — one per physical device — and writes those entity IDs to the node. The compiler
reads these directly.

### Why resolution can only happen at the node

The same variable feeds multiple statements, each using a different attribute. There is no
single "entity_ids for this variable." So the variable stays a name list, and each node
resolves independently.

### Worked example

A device variable `Outdoor_Sensors` = `["Outdoor Motion", "Zooz outdoor"]`.

The **motion trigger** resolves that list to the motion entities; the **illuminance condition**
resolves the *same* list to the illuminance entities. Same `role`/`role_tokens`, different
`entity_ids`, because the attribute differs. (Exact node shapes: see Structure Map — CONDITION
and the field-level `entity_ids`/`role_tokens` notes.)

### The rules in one line each

1. Variables and globals store device names (friendly names). Never entity IDs.
2. Nodes store entity IDs — the attribute-bearing entity, one per device, for the chosen function.
3. Resolution happens at the node, at commit time, because the attribute is only known there.
4. `role` / `role_tokens` on the node keep the variable/device name for display and re-resolution.
5. The picker's transient `sel.tokens` may hold ALL entities of a device for capability
   intersection — but only the attribute-bearing entity per device is written to the node.

The complete worked piston is REFERENCE_PISTON_V2.json (the diff anchor — a real save looks like this).

---

## The Two Formats — One Purpose Each

**Internal stored format** — the structured JSON defined by the Structure Map. The source of
truth for everything PistonCore does with a piston.

**Snapshot / export format** — structured JSON with role-name placeholders and no entity IDs.
Used for AI import, community sharing, and WebCoRE migration (DESIGN.md §6.2). Generated on
export, never stored as the internal format.

---

## The Structure (pointer, not a copy)

Every piston is one root object containing metadata plus five arrays — `variables`, `triggers`,
`conditions`, `restrictions`, `statements` — and a nested statement tree. Statement nodes nest
(blocks contain child statement arrays); an action's `tasks` is a flat ordered list inside it.

**All of it — every node type, every field, every array's order rule — is defined in the
Structure Map. This guide does not reproduce it.** When a section below needs to refer to a
node, it names the map entry (e.g. "Structure Map — ACTION") rather than restating the schema.

What the map covers, by name, so you know where to look: PISTON ROOT, VARIABLE, TRIGGER,
CONDITION, RESTRICTION, IF, ELSE_IF, DO, ON_EVENT, WHILE, REPEAT, EVERY, SWITCH, CASE, FOR,
FOR_EACH, BREAK, EXIT, ACTION, TASK, VIRTUAL TASK, SET_VARIABLE, WAIT, WAIT_FOR_STATE,
LOG_MESSAGE, CALL_PISTON, CANCEL_PENDING_TASKS, VALUE OBJECT, CONDITION GROUP.

---

## How the pieces relate (the narrative the map omits)

**Statements form a tree; tasks form a flat ordered list.** A block statement (do/if/while/etc.)
holds child statement arrays — that is the nesting. An `action` holds a flat `tasks` array — that
is the ordered command sequence for one device. These are two different layers; do not conflate
"nested" (the statement tree) with "flat ordered" (the task list and the picker fall-tables).
Order significance for every array is stated in the Structure Map.

**A device anchors an action; the action's tasks are what that device does, in order.** A task is
one step. A step is either a real HA service call or a piston-level (virtual) operation; the map
distinguishes them by `domain`. The position of each task in the list is execution order and is
load-bearing (see Structure Map — ACTION, tasks ordering).

**Conditions are a flat collection joined by operators**, not a nested boolean tree. The enclosing
block carries `condition_operator`; each condition carries `group_operator` connecting it to the
previous one. This mirrors WebCoRE's flat collection model. (Structure Map — CONDITION, CONDITION GROUP.)

**Values that are evaluated at runtime use the Value Object** (literal / expression / variable),
wherever a runtime value is needed — set_variable, exit, switch expression, expression conditions.
Task parameters are an exception: plain values, not wrapped. (Structure Map — VALUE OBJECT.)

---

## What This Format Is Not

- **Not Snapshot JSON** — Snapshot is the export/share format, generated on export, not stored internally.
- **Not compiled YAML** — produced by the compiler from this format. Never stored here.
- **Not a UI state object** — wizard context, scroll position, etc. are transient UI state.
- **Not the routing/compiler spec** — which field values force native-vs-PyScript, how a node
  becomes YAML or Python, and what the compiler emits are COMPILER SPEC concerns. The JSON stores
  values; it does not know or care where they go. None of that lives here or in the Structure Map.

---

## Out of scope for this guide (filed elsewhere)

- **JSON schemas / field tables / array shapes** → Structure Map (the single structural authority).
- **Editor rendering** (how a node draws on screen) → FRONTEND_SPEC / WIZARD_SPEC.
- **Compiler output / native-vs-PyScript routing** → COMPILER SPEC (currently frozen until D-S6).
- **Wizard flows and pickers** → WIZARD_SPEC.

---

## Keeping This Document In Sync

This guide must stay consistent with:
- **PISTON_JSON_STRUCTURE_MAP.md** — the structural authority this guide points to. If the map
  changes, check that this guide's *narrative* still reads true (it should not need field edits,
  because it states no fields — if it does, that is duplication and must be removed).
- **WIZARD_SPEC.md** — wizard flows, editor rendering, operator/value lists.
- **COMPILER_SPEC.md** — how the compiler reads this format (FROZEN until D-S6).
- **DESIGN.md** — architecture decisions that drive format choices.
- **REFERENCE_PISTON_V2.json** — the canonical diff anchor; a real save looks like this.

---

*STATEMENT_TYPES.md is retired. The Structure Map is the single source of truth for all piston
JSON schemas, fields, and array-order rules. This guide carries the narrative and the
load-bearing rules only — it duplicates no structure.*
