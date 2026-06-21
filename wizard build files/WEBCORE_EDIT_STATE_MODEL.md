# WebCoRE Editor & Wizard — Edit/State Behavior (plain English)

Source: `dashboard/js/modules/piston.module.js` (`config.controller('piston', ...)`),
master branch of `ady624/webCoRE`. This describes **how WebCoRE handles edits while
you're working and what happens on commit** — the part that does not show up from the
templates or the renderers. Implementation is 2017-era AngularJS; what transfers to
PistonCore is the *behavioral contract*, not the mechanism.

---

## 0. The two modes

The controller is either in `view` mode or `edit` mode (`$scope.mode`). Almost every
edit handler begins with `if ($scope.mode != 'edit') return;` — nothing is editable in
view mode. `edit()` flips to edit mode and reloads; `cancel()` flips back to view and
reloads. The piston object lives in memory the whole time as `$scope.piston`.

---

## 1. The working copy: `$scope.designer`

This is the single most important object and the thing you were missing. **Every dialog
edits a scratch object called `$scope.designer`, never the real node directly.** A new
`designer` is built from scratch each time a dialog opens, and it is thrown away (or
committed) when the dialog closes.

The pattern is identical across statements, conditions, restrictions, tasks, cases,
events, variables, groups. Each `editX` function does five things:

1. **Decide new vs existing.** If no object was passed in, it's a new item and the
   handler builds a blank template object. A `$new` flag records which case it is.
   - statements/conditions/restrictions: `$new` is true when the object has no type yet
     (`statement.t ? false : true`).
   - tasks: `$new` is true when there's no command yet (`task.c ? false : true`).
2. **Keep a reference to the original.** `designer.$obj` (and a typed alias like
   `designer.$statement` / `designer.$condition` / `designer.$task`) points at the
   **actual node** in the piston tree. This is a reference, not a clone.
3. **Clone the editable sub-parts into the scratch.** Operands and comparisons are
   deep-copied with `$scope.copy(...)` (which is `fromJson(toJson(x))`) so edits to the
   form do **not** mutate the live node until commit. Example (editCondition):
   `left: {data: condition.lo ? $scope.copy(condition.lo) : {}}`. The copy is the buffer.
4. **Record the parent.** `designer.parent` is the array (or owning node) the item lives
   in or will be inserted into. This is how commit knows where to splice.
5. **Open the dialog** bound to `$scope` (so the form two-way-binds to `designer`).

Key consequence: while a dialog is open, the canvas still shows the **old** rendered
node. Nothing the user types lands on the tree until they hit the dialog's Save, which
calls the matching `updateX`.

---

## 2. Clone vs reference — the exact rule

WebCoRE does **not** deep-clone the whole node on edit. It does something more surgical:

- The **scalar/flag fields** (operator, negation, async, description, disabled, type) are
  copied out into flat `designer.*` properties and copied back on save. Editing them in
  the form doesn't touch the node until save.
- The **complex value fields** — operands (`lo`, `ro`, `to`, ...) and the comparison
  bundle — are **deep-copied** into `designer.operand*` / `designer.comparison` so the
  form can freely mutate them. On save they're written back.
- `designer.$obj` / `designer.$statement` etc. stay pointed at the **original live node**
  the entire time.

So on **Cancel**, the live node is untouched because nothing was written back — the
scratch copies just get discarded. On **Save**, the flat fields and the copied operands
are written onto the node (existing case) or onto a fresh node that's then pushed into
the parent (new case). There's no separate "undo the edit" step; isolation comes from the
copy-in / copy-out discipline.

---

## 3. Cancel / close

`closeDialog()` is the universal close. It does two things: `saveStack()` (persist the
undo/redo stack to local storage — see §8) and close the ngDialog. **It does not write
anything to the node.** Because the dialog only ever mutated `designer` (and the deep
copies inside it), closing without running an `updateX` leaves the live tree exactly as
it was. That's the whole cancel story — there is no rollback logic because there's
nothing to roll back.

(The dialogs are opened with `closeByDocument: false`, so a stray click outside doesn't
commit or lose work — you must use an explicit button.)

---

## 4. Commit / save — the splice contract

Each `updateX` is the commit path. They all share the same shape:

1. **`$scope.autoSave()` first** — pushes the current piston state onto the undo stack
   *before* applying the change (see §8). This is why every committed edit is undoable.
2. **Resolve the target node.** New item → build the final object from `designer`.
   Existing item → reuse `designer.$statement` (the live node) and overwrite its fields.
   The canonical line:
   `var statement = $scope.designer.$new ? {t: $scope.designer.type} : $scope.designer.$statement;`
3. **Write fields back** from `designer` onto the node (operator, negation, operands,
   description, async, etc.), per statement type.
4. **Clear the cached render.** `statement.$$html = null` forces the renderer to redraw
   that line. (WebCoRE memoizes each node's rendered HTML on `$$html`; nulling it is the
   "mark dirty for re-render" signal.)
5. **Insert if new** — the splice. The pattern is a three-way fallback against
   `designer.parent`:
   ```
   if (designer.parent instanceof Array)        parent.push(node);
   else if (parent.<childKey> is Array)          parent.<childKey>.push(node);
   else                                          parent.<childKey> = [node];
   ```
   The child key depends on type: statements push to `parent.s`, conditions to `parent.c`,
   restrictions to `parent.r`, tasks to `parent.k`, cases to `parent.cs`. For an existing
   item, nothing is inserted — the live node was edited in place, so it's already in the
   tree.
6. **Validate + close.** `doValidatePiston()` then `closeDialog()`.
7. **Optional chaining** — if `nextDialog` was passed, immediately open the next relevant
   dialog (e.g. after creating an `if` it opens the condition dialog; after an `action` it
   opens the task dialog). This is how WebCoRE "stays in the wizard" without a
   close/reopen fl: commit this node, then call `addCondition(...)` / `addTask(...)` /
   `addStatement(statement.s)` on the just-created child array.

There is **no remove-on-save and no replace-by-id**. New nodes are pushed; existing nodes
are edited in place through the retained `$obj` reference. (Tasks are the one exception
that also does reordering — see §6.)

---

## 5. New item insertion points (the blank templates)

When `editX(null, parent)` is called, the handler fabricates a blank node with sensible
defaults before opening the dialog. Examples:

- **Statement**: `{t:null, d:[], o:'and', n:false, rop:'and', rn:false, a:'0', di:false,
  tcp:'c', tep:'', tsp:'', ctp:'i', s:'local', z:''}`. Page starts at 0 (the type picker);
  once a type is chosen, page advances to 1.
- **Condition**: full operand skeletons for `lo/ro/ro2/to/to2`, plus `ts:[]`, `fs:[]`
  (the true/false sub-statement buckets), `o:'and'`, `n:false`, `z:''`.
- **Restriction**: like a condition but with restriction-flavored fields (`rop`, `rn`),
  no `ts`/`fs`.
- **Task**: `{c:'', a:'0', m:'', z:''}`; the command picker is page 0.
- **Variable**: `{t:'dynamic', n:'', v:{data:{}}, a:'d', z:''}`.

The "is this new?" test is always *content-based*, not a passed-in boolean for most types:
a statement is new if it has no `t`; a task is new if it has no `c`. Conditions/restrictions
combine that with the `defaultType` argument.

---

## 6. Tasks — the one with ordering

Tasks (`editTask`/`updateTask`) carry an extra concept: an **insert index**, because
WebCoRE lets you choose where in the `with`-block a new task lands.

- `designer.insertIndex` is seeded from `$scope.insertIndexes[parent.$$hashkey]` for a new
  task, or from the task's current position for an existing one.
- On commit, after the task object is built, WebCoRE pushes it (new) and then, if needed,
  **splices it to the chosen index** within `parent.k`:
  `tasks.splice(insertIndex, 0, tasks.splice(currentIndex, 1)[0])`.
- `selectTaskIndex(i)` lets the dialog set where the next task goes; the index is
  remembered (`insertIndexes[...] = insertIndex + 1`) so successive "add task" calls land
  in sequence.

This is the only edit path that moves an existing element's position as part of save.

---

## 7. Groups, and the "upgrade" path

A single condition can be wrapped into a group in place. `upgradeCondition()` (and the
restriction twin) runs the normal `updateCondition()`, then finds the just-committed
condition in its parent array by `indexOf`, builds a new `{t:'group', o:'and', n:false,
c:[oldCondition]}`, and **replaces the array slot** (`parent[index] = newGroup`). Groups
have their own light editors (`editConditionGroup`/`editRestrictionGroup`) that only edit
operator, negation, description, and the "followed by / within" timing — they don't
rebuild children.

The "else if" insertion is also here: a new condition created with `newElseIf` is wrapped
in `{o:'and', n:false, c:[], s:[]}` and pushed to the else-if list rather than the
condition list.

---

## 8. Undo / redo / autosave (the safety net)

This is separate from the dialog working-copy and sits underneath all edits.

- `$scope.stack = {undo:[], redo:[]}`. Each entry is a snapshot:
  `{hash, timestamp, data}` where `data` is a compiled deep copy of the whole piston and
  `hash` is its md5 (`getStackData()`).
- **`autoSave()`** is called at the *start* of every `updateX`. It snapshots the current
  piston and pushes it to the undo stack — but only if the hash differs from the top of
  the stack (dedupe). It clears the redo stack on a real edit. Stack is capped at
  `MAX_STACK_SIZE` (10).
- **`undo()`** pushes current onto redo, pops undo, replaces `$scope.piston` with that
  snapshot's data, re-validates, re-persists. **`redo()`** is the mirror.
- **`saveStack()`** persists the whole stack (plus a `current` snapshot) to local storage
  under `stack<pistonId>`, keyed to the piston's build number. `loadStack()` restores it
  on entering edit mode.
- **Crash/restore**: on load, if a stored `current` snapshot exists, is newer than the
  server's `modified` time, and matches the build, WebCoRE offers a "choose version"
  dialog (`dialogChooseVersion` → `chooseVersion(keepLocal)`) to recover unsaved local
  edits. This is browser-local autosave, not a server save.

So there are **two independent layers**: (a) the per-dialog working copy that isolates an
in-progress edit, and (b) the per-edit undo snapshot stack that lets any committed edit be
reversed. They don't interact — the dialog commits to the live tree, and the commit is
bracketed by a stack snapshot.

---

## 9. The actual save-to-backend

`$scope.save()` is the real persist, and it is **completely separate** from all the dialog
commits above. Editing nodes never touches the server. `save()`:

1. Calls `compilePiston({...})` to produce the serializable piston (resolves expressions,
   strips runtime junk, applies the device legend, deletes false/null/empty fields).
2. Sends it via `dataService.setPiston(...)` (chunked if large).
3. On success, updates `meta.build/active/modified`, calls `saveStack(true)` (marks the
   stack as just-saved), flips back to `view` mode, and reloads via `init()`.

Imported pistons are force-paused after save. There is no "dirty dot" concept like
PistonCore's — the local autosave stack is the unsaved-work mechanism instead.

---

## 10. Render invalidation

WebCoRE memoizes each node's rendered HTML on a `$$html` property (and `$$html2` for
cases). Any commit sets the relevant `$$html = null` so Angular's `||` re-render trick
recomputes that one line. This is the equivalent of PistonCore calling `render()` after a
mutation — but scoped to the touched node rather than the whole tree.

---

## Summary contract (what to carry into PistonCore)

1. **One scratch buffer per open dialog** (`designer`), built fresh on open, discarded on
   close. The live tree is read to seed it and written only on explicit commit.
2. **Reference the original node + deep-copy its value fields.** Cancel = discard scratch
   (no rollback needed). Save = copy fields back (existing) or push a built node (new).
3. **Commit knows its target via a retained `parent`** (the owning array/node) plus a
   per-type child key (`s`/`c`/`r`/`k`/`cs`). New → push; existing → edit in place.
4. **Bracket every commit with an undo snapshot** taken *before* applying the change.
5. **Mark only the touched node dirty** for re-render.
6. **Chaining** ("stay in the wizard") = commit this node, then immediately open the next
   dialog scoped to the new child array. No close/reopen.
7. **Backend save is a separate, explicit action** that compiles the whole piston; node
   edits are local-only until then, protected by a browser-local autosave stack.

The big gaps WebCoRE's model exposes in the current PistonCore wizard: PistonCore's
`insertStatement` only inserts/replaces (no in-place edit-via-retained-reference, no
ordered task splice, no remove-by-id), and PistonCore has no undo-snapshot bracket around
commits. WebCoRE gets edit isolation from the copy-in/copy-out discipline plus the
snapshot stack, not from a single deep clone.
