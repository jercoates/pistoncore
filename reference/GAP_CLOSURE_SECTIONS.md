# Gap Closure Sections — Build-Ready Spec Text for EDITOR_WIZARD_SPEC.md

**What this is:** the six coverage gaps, written as finished spec sections at the depth the spec already uses (§8.7-level). Standalone here so they are written once, coherently. **Claude Code inserts them** into `EDITOR_WIZARD_SPEC.md` at the placement notes given — do not let chat place them; placement-in-context is Code's job so section numbers and cross-refs stay correct.

**Voice/tag rules followed:** every claim tagged `[VERIFIED]` / `[ASSUMED]` / `[DECISION]`. Button existence + `ng-click` target = extracted from `piston.module.html.txt`, tagged accordingly. Internal handler behavior = inferred (the editor controller `piston.module.js` was never available; the provided `app.js` is the dashboard layer and holds none of these handlers) — tagged `[DECISION: derived from WebCore behavior]`, written **complete** so code can be built without hand-patching. Machinery references (§9.4 commit sequence, §9.3 blank templates, §10.2 autoSave, §11 clipboard) use the spec's real shapes.

**Insertion note for Claude Code:** before inserting, verify each `ng-click` string by grepping `reference/Webcore/piston.module.html.txt` (the on-disk filename is dotted; my line numbers may be stale — match strings, not lines). Renumber sections to fit. Where a placeholder says "§X", replace with the real assigned number.

---

## SECTION 1 — NEW: Cross-Dialog Behaviors

> **PLACEMENT:** Insert as a new top-level section immediately AFTER §9 (Edit-Isolation Contract) and BEFORE §10 (Undo/Redo/Autosave) — it builds directly on §9's commit machinery and is referenced by the dialog sections. Assign it the next section number and update the cross-refs in §4, §6, §7, §11 to point here (one-line pointers, listed at the end of each gap below).
>
> **WHY ITS OWN SECTION (do not fold into dialogs):** these three behaviors each live on no single dialog — they apply across many. Folding them per-dialog is exactly how they were dropped in v2.1. They are specified ONCE here; each dialog points here.

### §X.1 "Add more" / Re-arm Commit

**Purpose.** Lets the user commit the current item and immediately start another of the same kind, without the dialog closing. The footer carries a second commit button, **"Add more"** (`btn-success`), beside the normal Add/Save button.

**Where it appears.** Five add-dialogs, new-mode only (`designer.$new`):

| Dialog | Normal commit | Re-arm commit | Target array |
|---|---|---|---|
| edit-event | `updateEvent()` | `updateEvent(true)` | `parent.c` |
| edit-condition | `updateCondition()` | `updateCondition(true)` | `parent.c` |
| edit-task | `updateTask()` | `updateTask(true)` | `parent.k` |
| edit-variable | `updateVariable()` | `updateVariable(true)` | `piston.v` |
| edit-global-variable | `updateGlobalVariable()` | `updateGlobalVariable(true)` | `globalVars` |

`[VERIFIED: piston.module.html.txt — "Add more" buttons calling updateEvent(true)/updateCondition(true)/updateTask(true)/updateVariable(true)/updateGlobalVariable(true), class btn-success, ng-if="designer.$new"]`

**NOT re-arm — do not add the button to these.** edit-statement, edit-restriction, edit-case, the two group dialogs. edit-case's `updateCase(true)` exists but its label is "Add a statement" — that is chaining into the case body (§7.4), a different behavior. Restriction has no `updateRestriction(true)` variant in the source.
`[VERIFIED: piston.module.html.txt — no btn-success "Add more" in edit-statement/edit-restriction/edit-case/group dialogs; updateCase(true) labeled "Add a statement"]`

**The re-arm argument.** Each `updateX()` handler takes one boolean, `rearm` (the `true`). It controls only what happens AFTER the commit — the commit itself is identical to the normal path.

**Commit-and-re-arm sequence.** Extends the §9.4 commit sequence. Steps 1–5 are the §9.4 path unchanged; step 6 branches on `rearm`:

1. `autoSave()` — snapshot BEFORE the change (§10.2 bracket; the pre-change tree is undoable).
2. Resolve target node: new → build from `designer`; (re-arm is new-mode only, so always the new path).
3. Write fields back from `designer` onto the node.
4. Clear cached render on the parent (`$$html = null`).
5. Splice the committed node into the target array at the insert position (`insertIndex` if the dialog tracks one — see §7.3 for task; otherwise append).
6. **Branch on `rearm`:**
   - **`rearm === true` (Add more):** do NOT close the dialog. Rebuild `designer` as a fresh blank template for this dialog type (§9.3 blank templates — e.g. task `{c:'', a:'0', m:'', z:''}`). Advance the insert cursor: `insertIndex = insertIndex + 1` so the next item lands after the one just committed. Re-run validation so the new blank shows its initial disabled state. Dialog stays open, scrolled to the input, ready for the next entry.
   - **`rearm` falsy (Add/Save):** validate + close dialog (§9.4 step 6), then optional chaining (§9.4 step 7).

`[DECISION: derived from WebCore behavior — re-arm = commit via §9.4 then rebuild blank designer + advance insertIndex + hold dialog open; the alternative (close + reopen) is rejected because it loses insert position and scroll]`

**What carries vs. resets across a re-arm.** The committed node is independent; the new blank `designer` shares nothing with it. Nothing the user typed carries forward — each Add-more produces a fresh blank. The ONLY state that persists across the loop is `insertIndex` (advancing) and the parent scope (unchanged). This is deliberate: Add-more is "another one like this category," not "another one like that value."
`[DECISION: derived — fresh blank per §9.3; no field inheritance, matching the blank-template-on-open contract of §9.1]`

**Button enable/disable.** "Add more" uses the same disabled-gate as the dialog's normal commit button (e.g. condition: `!designer.type || (type=='condition' && !comparison.valid)`; variable: `!designer.name || !designer.operand.valid`). When the normal Add is enabled, Add more is enabled.
`[VERIFIED: piston.module.html.txt — btn-success ng-disabled mirrors the adjacent Add button per dialog]`

**Task dialog — positional re-arm.** The task dialog (§7.3) maintains `insertIndex` into `parent.k` and renders existing tasks as before/after previews split at the cursor. Add-more there MUST splice at `insertIndex` (step 5) and advance it (step 6), so successive Add-mores build a contiguous run at the cursor position — not all appended to the end. This is the one dialog where the cursor advance is user-visible.
`[DECISION: derived — §7.3 insertIndex model requires positional splice; end-append would reorder the user's intended sequence]`

**Pointers to add elsewhere:** edit-event, edit-condition, edit-task, edit-variable, edit-global-variable sections each get one line: "Footer includes **Add more** (re-arm) — see §X.1."

### §X.2 Inline Variable Creation ("create it")

**Purpose.** When the user types a variable name into an operand that is not yet declared, the operand's validation error offers an inline **"(create it)"** link that declares the variable on the spot and re-validates — without leaving the dialog or losing the in-progress edit.

**Where it appears.** Anywhere the operand widget (§4) renders, which is every value-taking slot: condition left/right/right2/within/time/time2 operands, restriction operands, for-loop start/end/step (`operand`/`operand2`/`operand3`), switch expression, exit value, case value, task parameters, variable initial value.
`[VERIFIED: piston.module.html.txt — autoAddVariable(...) appears at 20 operand sites, each paired with validateOperand(...)]`

**Trigger condition.** During operand validation (`validateOperand`), if the operand is an expression/variable reference (`data.t == 'e'` or `'x'`) that names an identifier not found in `piston.v` (locals), `globalVars`, or `systemVars`, validation fails with `expressionVar` set to the unresolved name. The error display then renders the "(create it)" link.
`[DECISION: derived from WebCore behavior — the error path exposes expressionVar; the link is shown only when an unresolved name is the validation failure]`

**Action on click.** The link calls, in order: `autoAddVariable(operand)` then `validateOperand(operand)`.
1. `autoAddVariable` reads the unresolved name from the operand (`operand.expressionVar` / the typed token).
2. It declares a new local variable: appends to `piston.v` a variable node `{t:'dynamic', n:<name>, v:{data:{}}, a:'d', z:''}` (the §9.3 variable blank template, with `n` set to the typed name and type defaulted to `dynamic`).
3. `validateOperand(operand)` re-runs; the name now resolves; the error clears; the operand becomes valid.
The user's dialog and all other in-progress fields are untouched — only `piston.v` gained a row.
`[DECISION: derived — default type dynamic because the create-it path has no type information at point of use; user can retype the variable later to set a concrete type. ASSUMED RISK low — verify default type against running editor.]`

**Scope.** Always creates a LOCAL variable (`piston.v`), never a global. Globals are created only through the explicit global-variable dialog (§ global-variable). 
`[DECISION: derived — autoAddVariable targets piston.v; globals require the deliberate global dialog with its name-validation gate]`

**Pointer to add elsewhere:** §4 Operand gets one line: "An unresolved variable reference offers inline creation — see §X.2."

### §X.3 In-Dialog Clipboard Paste

**Purpose.** When the server clipboard (§11.2) holds a node and the user opens an add-dialog, a **"From clipboard"** section appears inside the dialog, letting them paste the held node directly into the array being edited — without going back to the canvas context menu.

**Where it appears.** The page-0 (type-picker) view of: edit-statement, edit-condition, edit-restriction, edit-task. Shown only when the clipboard is non-empty.
`[VERIFIED: piston.module.html.txt — "From clipboard" clipboard-item repeat blocks with pasteItem(item)/deleteClipboardItem(item) in those four dialogs]`

**Distinct from §11.6.** §11.6 is the clipboard preview in the statement *picker*. This (§X.3) is the same affordance generalized to the condition, restriction, and task add-dialogs. Both read the same §11.2 clipboard slot; they differ only in which dialog hosts them.
`[VERIFIED: piston.module.html.txt — clipboard-item blocks present in all four add-dialogs, not only the statement picker]`

**Rendering.** Each clipboard entry renders a read-only preview of the held node (via the node's normal render function — `renderStatement`/`renderCondition`/`renderRestriction`/`renderTask`) plus two buttons: **[Paste this <type>]** (`pasteItem(item)`) and **[Delete from clipboard]** (`deleteClipboardItem(item)`).
`[VERIFIED: piston.module.html.txt — preview + pasteItem + deleteClipboardItem per clipboard-item]`

**Paste action (`pasteItem`).** Follows the §11.4 / §11.5 paste contract exactly:
1. Deep-copy the clipboard JSON.
2. Regenerate every `id` in the copied subtree with a fresh UUID (§11.5 — no UUID may appear twice in the piston).
3. Splice the copy into the dialog's current target array at the insert position (the array the dialog is editing — `.s`/`.c`/`.r`/`.k`), same target resolution as §9.4 step 5.
4. The clipboard slot persists (§11.4) — the user may paste again.
5. Close the dialog (the paste IS the commit; there is no further field entry).
`[DECISION: derived from WebCore behavior — pasteItem reuses the §11.4/§11.5 canvas-paste contract; the only difference is the target array is the open dialog's array rather than "after selected node"]`

**Delete action (`deleteClipboardItem`).** Calls the §11.2 clipboard `DELETE`; the "From clipboard" section disappears when the slot empties. Does not affect the piston.
`[VERIFIED: piston.module.html.txt — deleteClipboardItem(item); §11.2 clipboard API]`

**Pointer to add elsewhere:** §11 gets one line: "Add-dialogs also expose an in-dialog paste path — see §X.3."

---

## SECTION 2 — EXTEND §9.5 (Group Upgrade Path)

> **PLACEMENT:** §9.5 currently specifies `upgradeCondition()` only. Append the statement and restriction variants below to the existing §9.5 so all three live together.

### §9.5 Group Upgrade Path (extended)

The existing condition case stands. Two siblings use the identical pattern on different node types and arrays:

**Statement upgrade (`upgradeStatement`).** Available on a committed IF / WHILE / REPEAT statement (the decisional/loop statements that own a condition list). Wraps the statement's single condition into a group in place:
1. Run `updateStatement()` to commit any pending edit.
2. Locate the committed condition in the statement's condition array (`indexOf`).
3. Build a group node `{t:'group', o:'and', n:false, c:[oldCondition]}`.
4. Replace the array slot with the group.
`[VERIFIED: piston.module.html.txt — upgradeStatement() button "Convert to new group" on if/while/repeat]`
`[DECISION: derived from WebCore behavior — mechanics identical to the documented upgradeCondition() in §9.5; only the host node type differs]`

**Restriction upgrade (`upgradeRestriction`).** Available on a committed restriction. Wraps it into a restriction group in place, operating on the restriction array (`.r`) and using the restriction group fields (`rop`/`rn`) rather than condition fields:
1. Run `updateRestriction()` to commit.
2. Locate the committed restriction (`indexOf`) in its `.r` array.
3. Build `{t:'group', rop:'and', rn:false, r:[oldRestriction]}`.
4. Replace the array slot.
`[VERIFIED: piston.module.html.txt — upgradeRestriction() "Convert to new group" button]`
`[DECISION: derived from WebCore behavior — parallel to upgradeCondition(); restriction group uses rop/rn and the .r array per §6.1]`
`[ASSUMED: restriction-group field spelling rop/rn — RISK low — verify against §6.1 and the restriction blank template at build time]`

---

## SECTION 3 — NEW SUBSECTION under §7 (Custom Command Parameter Builder)

> **PLACEMENT:** Insert as a new subsection in §7 (Action Statement and Task Dialog), after §7.5. Number it §7.6.

### §7.6 Custom Command Parameter Builder

**Purpose.** For a custom / user-defined command (one not carrying a fixed `p` parameter list from `webcore_vocab.json`), the task dialog lets the user define the command's parameters by hand. Shown only when the task is in custom mode (`designer.custom`).
`[VERIFIED: piston.module.html.txt — addParameter(...)/deleteParameter(...) controls gated on designer.custom]`

**Where it appears.** A dropdown in the task-dialog footer, labeled "Parameters", present only while `designer.custom` is true.
`[VERIFIED: piston.module.html.txt — footer dropdown with addParameter entries under designer.custom]`

**Add a parameter (`addParameter(type)`).** The dropdown offers five typed adders; each appends a new parameter slot of the chosen type to `designer.parameters`:
- `addParameter('string')` — text parameter
- `addParameter('integer')` — integer parameter
- `addParameter('decimal')` — decimal parameter
- `addParameter('boolean')` — boolean parameter
- `addParameter('datetime')` — datetime parameter

Each appended slot is an operand-typed parameter rendered by the operand/parameter widget (§4) at the chosen type, so the user fills its value with the same widget machinery as any other parameter.
`[VERIFIED: piston.module.html.txt — addParameter('string'|'integer'|'decimal'|'boolean'|'datetime')]`
`[DECISION: derived from WebCore behavior — appended slot is a §4 operand at the chosen datatype; the builder defines parameter shape, the operand widget fills value]`

**Delete a parameter (`deleteParameter(parameter)`).** Each existing parameter has a delete entry in the same dropdown (listed below a divider). Removes that slot from `designer.parameters`.
`[VERIFIED: piston.module.html.txt — deleteParameter(parameter) per existing parameter, below a divider]`

**Commit.** On task commit (§9.4 / §X.1), the custom parameters travel with the task node as its parameter list, same as fixed-command parameters. The compiler treats a custom command's parameters identically to a vocab command's `p` list.
`[DECISION: derived — custom parameters serialize into the task node's parameter array like vocab params; compiler routing of custom commands is a compiler-scope concern, not wizard]`

---

## SECTION 4 — REWRITE §5 (Statement Type Picker) do-list to be vocab-driven

> **PLACEMENT:** Replace the hand-listed location/do-command portion of §5. Keep the statement-block types (IF/DO/ON/WHILE/REPEAT/EVERY/SWITCH/FOR/FOR_EACH/BREAK/EXIT/ACTION) as they are — those are structural statement types. The change is to how non-device "do" commands are sourced.

### §5.x Do-List Commands Are Vocab-Driven (not hand-listed)

The do-list — the non-device "Location commands (non-device)" actions available inside a with-block / action — is **built at runtime from `webcore_vocab.json` `virtualCommands`**, not hand-enumerated in this spec or in code. This is the §0.6 vocab-as-runtime-data rule applied to the do-list, exactly as §7.2 applies it to the device command picker.

`virtualCommands` contains 59 entries. Each renders as a do-list item using its own fields: `n` (display name), `d` (display format string with `{N}` placeholders filled by parameter values), `p` (parameter list, each parameter an operand of the given type rendered via §4).
`[VERIFIED: webcore_vocab.json virtualCommands — 59 entries with n/d/p fields]`

**The wizard offers ALL 59** — no curation, no v1 subset. Per the all-of-WebCore rule, the wizard surface exposes the entire vocabulary. Whether the compiler can yet *route* a given command to HA is a separate, compiler-scope question (§12 / HA_LIMITATIONS); an unroutable command may still be authored and is flagged at compile time, not hidden from the wizard.
`[DECISION: do-list is the full virtualCommands set, vocab-driven per §0.6; v1 scoping is compiler-only and never removes commands from the wizard surface]`

**Families present** (for orientation only — the list is read from the file, not from this enumeration): light effects (`adjustLevel`, `adjustHue`, `adjustSaturation`, `adjustColorTemperature`, `adjustInfraredLevel`, `fadeLevel`, `fadeHue`, `fadeSaturation`, `fadeColorTemperature`, `fadeInfraredLevel`, `flash`, `flashColor`, `flashLevel`); tile commands (`setTile`, `setTileText`, `setTileTitle`, `setTileFooter`, `setTileColor`, `clearTile`); piston state/control (`setState`, `pausePiston`, `resumePiston`, `executePiston`, `cancelTasks`, `setVariable`, `setSwitch`, `toggle`, `toggleLevel`, `toggleRandom`); waits (`wait`, `waitRandom`, `waitForTime`, `waitForDateTime`); state store/restore (`saveStateLocally`, `saveStateGlobally`, `loadStateLocally`, `loadStateGlobally`, `storeMedia`); network/integration (`httpRequest`, `wolRequest`, `iftttMaker`, `writeToFuelStream`, `parseJson`); LIFX (`lifxState`, `lifxScene`, `lifxToggle`, `lifxBreathe`, `lifxPulse`); notifications (`sendNotification`, `sendPushNotification`, `sendSMSNotification`, `sendEmail`, `sendNotificationToContacts`); location/system (`setLocationMode`, `setAlarmSystemStatus`, `executeRoutine`, `setHSLColor`, `log`, `noop`).
`[VERIFIED: webcore_vocab.json virtualCommands — family grouping from the 59 entry keys]`

**Display and commit.** A do-list item renders via §7.2's command-display rule (`d` format with `{N}` placeholders, else `n`). On commit it becomes a TASK node carrying the command token and its parameter values — the token is the vocab key, stored verbatim and never deleted (the agreed-token rule).
`[VERIFIED: webcore_vocab.json — virtualCommands d/n/p; §7.2 command display]`
`[DECISION: do-list item commits as a TASK with the vocab key as command token]`

---

## SECTION 5 — Tier-3 decision flag (navigation state machine)

> **PLACEMENT:** Add to §13 Known Gaps as EDITOR-GAP-6. This is NOT spec text to build from — it is a flagged decision for Jeremy.

**EDITOR-GAP-6 — Dialog page-navigation state machine (DECISION PENDING).**
Multi-page dialogs (edit-statement, edit-condition, edit-restriction) use page 0 (type picker) → page 1 (form) via `setDesignerType(type, true)`, with `prevPage()` as Back. The page-state machine (which dialogs are multi-page, what each page shows, how Back behaves, how the type cards on page 0 map to page-1 forms) is not yet specified as a contract. **Decision for Jeremy:** one shared "dialog navigation" section vs. folded per-dialog. Do not build until decided.
`[VERIFIED: piston.module.html.txt — setDesignerType/prevPage, page 0/1 ng-if blocks in edit-statement/edit-condition/edit-restriction]`
`[DECISION PENDING — surface to Jeremy, do not silently choose]`

---

## Definition of done (for Claude Code)

1. SECTION 1 inserted as a new section after §9; its three subsections (Add more, create-it, in-dialog paste) intact; the five/one/one pointer lines added to §4, §6/§7 dialogs, §11.
2. SECTION 2 appended to §9.5 (statement + restriction upgrades).
3. SECTION 3 inserted as §7.6.
4. SECTION 4 replaces the hand-listed do-list in §5 with the vocab-driven rule.
5. SECTION 5 added to §13 as EDITOR-GAP-6.
6. Every `ng-click` string re-verified by grep against `reference/Webcore/piston.module.html.txt` before trusting any line number. All section-number placeholders (§X) replaced with real numbers. No live PistonCore `.js` cited anywhere.
