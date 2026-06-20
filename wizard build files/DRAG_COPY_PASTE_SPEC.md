# DRAG / COPY-PASTE SPEC (standalone)

Status: wish-feature. Standalone. Referenced by the main wizard spec, NOT merged into it.

## Verification status of this document
This spec is MIXED. Every claim is tagged:
- **[VERIFIED]** — observed directly in WebCoRE source (`piston.module.html` dnd directives, grepped and read).
- **[ASSUMED: Claude]** — inferred by Claude, with basis stated. NOT confirmed in source. Must be checked before building.

How the verified parts were verified: grep of `piston_module_html.txt` for all `dnd-*` directives, returning the exact lines showing list bindings, draggable items, type declarations, and move handlers. The verified claims below quote those directives.

## Scope (deliberately narrow)
Covers ONLY: dragging statements/tasks/conditions to reorder or re-parent, and copy/paste of nodes. Does NOT cover wizard flow, menu population, condition logic, or compilation.

## Hard dependency: nested structure
[VERIFIED] WebCoRE binds each block branch to its own array as a drop zone. Observed bindings: `dnd-list="statement.s"` (block body), `dnd-list="elseIf.s"` (else-if body), `dnd-list="statement.e"` (else body), `dnd-list="case.s"` (switch case body), `dnd-list="statement.k"` (action task list), `dnd-list="piston.s"` (top level).

[ASSUMED: Claude — RISK: LOW, checkable locally against live PistonCore JSON] Mapping WebCoRE's short field names to the PistonCore JSON names: WebCoRE `.s` → PistonCore `statements[]`/`then[]`, `.e` → `else[]`, `.ei`/`elseIf.s` → `else_ifs[].statements[]`, `.k` → `tasks[]`. Basis: structural correspondence between the two formats. NOT a 1:1 confirmed mapping — verify field names against the live PistonCore JSON before building.

[VERIFIED] Each statement array is an independent drop zone; the action task list (`statement.k`) is its own drop zone. (Multiple distinct `dnd-list` bindings observed.)

## The drag model
[ASSUMED: Claude — RISK: NONE, name only, no build impact (PistonCore drag is built fresh in vanilla JS; WebCoRE's library identity is irrelevant)] The directive library is `angular-drag-and-drop-lists`. Basis: the `dnd-` prefix convention. NOT confirmed by name in source — verify before relying on library-specific behavior.

[VERIFIED] Three pieces per draggable area, all observed in source:
1. Drop zone — `dnd-list="<array>"` + `dnd-allowed-types="['<type>']"`.
2. Draggable item — `dnd-draggable="<node>"` + `dnd-type="'<type>'"`.
3. Move handler — `dnd-moved="drag(<array>, $index)"`.

[VERIFIED] Node types observed in `dnd-type`: `statement`, `task`, `condition`, `restriction`, `variable`, `event`.

[ASSUMED: Claude — RISK: LOW, only one plausible behavior; confirm by reading handler body in app_js.txt] The `drag(array, $index)` handler removes (splices) the item from the source array at that index, and the library inserts it into the target. Basis: standard behavior of this directive pattern and the handler signature. The handler BODY was not read from source — only its invocation. Verify the handler implementation in `app_js.txt` before building.

## Type gating (the integrity rule)
[VERIFIED] Drop zones declare accepted types via `dnd-allowed-types`. Observed: statement arrays use `['statement']`, task list uses `['task']`, condition collections use `['condition']`, restriction collections use `['restriction']`.

[ASSUMED: Claude — RISK: LOW, mechanism is verified; this is its interpretation] Therefore a node may only drop into a zone whose allowed-type matches its type, which prevents illegal structures (e.g. an if-block cannot drop into a task list). Basis: that is the purpose of `dnd-allowed-types`. Mechanism is verified; the *consequence* (prevents invalid trees) is Claude's interpretation — sound, but stated as inference.

## Move semantics
[ASSUMED: Claude — RISK: LOW, only one plausible behavior; confirm against drag() body] Reorder within an array = splice out at old index, insert at new index. Re-parent across arrays = splice out of source, insert into target; node object unchanged, only its containing array changes. Basis: inference from the move-handler pattern. Verify against the `drag()` body.

[ASSUMED: Claude — RISK: LOW, self-evident (a move is not a new node)] Node `id` is unchanged on a move (same node relocated), preserving round-trip identity. Basis: a move does not create a new node. Sound, but inferred.

## Copy / paste semantics
[VERIFIED] Copy is the same drag system with a copy effect: `dnd-effect-allowed="copyMove"` observed on draggable items. A `dnd-copied` handler is also observed (e.g. `dnd-copied="copyVariable(variables, $index)"`).

[ASSUMED: Claude — RISK: LOW, only one plausible behavior; confirm copyVariable body] Copy = clone the node and insert the clone; source stays in place. Basis: meaning of copy vs move in this directive set. The `copyVariable` handler body was not read — verify.

[ASSUMED: Claude — RISK: HIGH if wrong, but checkable locally (this is a PistonCore invariant, not a WebCoRE question — verify against editor's id-based find/replace/remove)] CRITICAL: a cloned node and every nested node inside it MUST get fresh unique `id`s before insertion, or duplicate `id`s break find/replace/remove. Basis: PistonCore round-trip keys on unique `id` (established earlier this session from the architecture read). This is Claude's reasoning from the PistonCore invariant, NOT from WebCoRE source. It is the single most important thing to confirm before building copy/paste.

[ASSUMED: Claude — RISK: design proposal, not a claim; nothing to verify, only to decide] Clipboard paste = copy without the drag gesture: hold a cloned, re-id'd node in a buffer, insert into a chosen target array on paste, type-gated the same way. Basis: extension of the verified copy mechanism. Entirely a design proposal, not observed.

## What must NOT happen (anti-cross-contamination)
[VERIFIED-by-design] This spec does not define node building (wizard) or rendering (editor); it assumes nodes already have `type` and `id`. It does not redefine node structure; it references existing structure as authority. It introduces no flat/nested rule beyond its stated dependency.

## Open items (not decided — no assumption made)
- Visual drop-indicator styling: editor concern.
- Single-item clipboard vs stack: product decision, deferred.
- Touch/mobile drag behavior: deferred.

## Pre-build verification checklist (resolve every [ASSUMED] before coding)
1. Confirm library name (or that it's vendored/custom).
2. Read the `drag()` handler body in `app_js.txt` — confirm splice-out behavior.
3. Read the `copyVariable`/copy handler body — confirm clone behavior.
4. Confirm PistonCore JSON field names (`statements`/`then`/`else`/`else_ifs`/`tasks`) against live JSON.
5. Confirm the re-id-on-clone requirement against the editor's id-based find/replace/remove.
