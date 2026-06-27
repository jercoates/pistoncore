# Spec Coverage Check — WebCore Source vs EDITOR_WIZARD_SPEC.md

**What this is:** a mechanical diff. Every button, every menu surface, and every command in the WebCore source files, lined up against the spec. Anything in the source but not in the spec is a gap — a thing that will get missed at build time the way "Add more" got missed, unless it's written in.

**How it was made:** enumerated all 70 button handlers from `piston_module_html.txt`, all 59 location commands from `webcore_vocab.json`, then searched `EDITOR_WIZARD_SPEC.md` for each. Not by topic — exhaustively, one at a time. This is the "did we miss anything else" answer turned into a list.

**Not provably complete** (per the Cross-Cutting Inventory's own rule), but it converts unknown misses into named rows. Three of these are the same class as Add more: a small surface that applies across many dialogs and owns no single menu.

---

## TIER 1 — Confirmed architecture gaps (in source, NOT in spec, real)

These are true misses. Each needs a spec section before Claude Code can build it.

### GAP-A — "Add more" / re-arm  ⭐ (the one you already hit)
**Source:** `updateEvent(true)`, `updateCondition(true)`, `updateTask(true)`, `updateVariable(true)`, `updateGlobalVariable(true)`, `updateCase(true)` — the `true` argument is the re-arm flag.
**Spec:** absent. Zero mentions of "add more" or "re-arm" anywhere in 1135 lines.
**What it is:** a footer button that commits the current item, keeps the dialog open, resets the scratch buffer, and advances the insert cursor — so the user adds several of the same thing without the dialog closing. Lives on 6 dialogs.
**Why missed:** it's a footer behavior, not a field. Cross-cutting — owns no single menu.
**Note:** the spec HAS the machinery it needs (`insertIndex` §7.3, edit-isolation §9) but never specifies the behavior that uses it. §7.4 "Chaining" is a DIFFERENT thing (auto-opening a child dialog), not re-arm.

### GAP-B — Inline "create it" variable creation (`autoAddVariable`)  ⭐ same class as Add more
**Source:** `autoAddVariable()` — appears 20 times across operand, comparison left/right/right2/within/time, for-loop operands. The "(create it)" link next to an operand error when you type a variable name that doesn't exist yet.
**Spec:** absent.
**What it is:** when a user references a variable that isn't declared, the operand shows an error with a "create it" link that declares the variable on the spot without leaving the dialog.
**Why missed:** it's an inline affordance attached to the operand widget, applies everywhere an operand appears — owns no menu. Exactly the Add-more signature.

### GAP-C — Clipboard paste / delete inside dialogs (`pasteItem`, `deleteClipboardItem`)
**Source:** `pasteItem(item)`, `deleteClipboardItem(item)` — the "From clipboard" section at the bottom of edit-statement, edit-condition, edit-restriction, edit-task page 0.
**Spec:** clipboard is mentioned (14 hits) but as the editor-canvas copy/paste (§11). The **in-dialog clipboard section** — pasting a copied statement/condition/task from within the add dialog — is not specified.
**What it is:** when you open "add a statement" and you have something on the clipboard, a paste-this-here section appears in the dialog.
**Why missed:** it's a sub-section that appears in 4 different add-dialogs conditionally — cross-cutting.

### GAP-D — Custom command parameter builder (`addParameter` / `deleteParameter`)
**Source:** `addParameter('string'|'integer'|'decimal'|'boolean'|'datetime')`, `deleteParameter()` — the dropdown in the task dialog footer that lets a user add/remove parameters on a custom command.
**Spec:** absent.
**What it is:** for custom/user-defined commands, a builder to add typed parameters.
**Why missed:** appears only when `designer.custom` is true — an edge surface inside the task dialog.

### GAP-E — Group upgrade for statements and restrictions (`upgradeStatement`, `upgradeRestriction`)
**Source:** `upgradeStatement()`, `upgradeRestriction()`, `upgradeCondition()` — "Convert to new group" button.
**Spec:** PARTIAL. §9.5 specifies `upgradeCondition()` only. The statement version (wrap an if/while/repeat into a group) and the restriction version are not specified.
**What it is:** a button that wraps a single condition/restriction/statement into a group in place.
**Why missed:** condition got specced; the two siblings got dropped — classic menu-by-menu miss.

### GAP-F — The 59 location/virtual commands (the do-list)
**Source:** `webcore_vocab.json` virtualCommands — 59 non-device "do" actions.
**Spec:** §5 lists ~6 (SET_VARIABLE, WAIT, WAIT_FOR_STATE, LOG, CALL_PISTON, CANCEL_PENDING_TASKS). The other ~53 are not enumerated as available do-list items.
**The uncovered set includes:** all the fade/flash/adjust light effects (adjustLevel, fadeHue, flashColor…), tile commands (setTile, setTileText, clearTile…), state save/restore (saveStateLocally, loadStateGlobally…), HTTP/network (httpRequest, wolRequest, iftttMaker, writeToFuelStream), LIFX block (lifxBreathe, lifxPulse, lifxScene…), the notification family (sendEmail, sendSMSNotification, sendPushNotification…), setLocationMode, setAlarmSystemStatus, executeRoutine, toggle/toggleLevel/toggleRandom, parseJson, waitForTime/waitForDateTime/waitRandom, and more.
**Why missed:** the spec treated do-list items as a short hand-listed set instead of "everything in virtualCommands." Per the locked rule — the wizard surface is ALL of WebCore — these all belong. v1 *compiler* scope can defer routing them, but the *wizard* must offer them.
**Decision needed:** confirm these are vocab-driven (the do-list is built from virtualCommands at runtime, not hand-listed in §5), same as the device command picker is vocab-driven.

---

## TIER 2 — Covered, but under different wording (NOT gaps — verified present)

Checked these because the keyword search flagged them; they ARE specified, just named differently. Listed so they don't get re-opened by mistake.

| Source handler | Where it lives in spec |
|---|---|
| `chooseVersion` (crash recovery) | §10.5 Crash Recovery |
| `doRebuildPiston` (reconciliation) | §8.7 Edit-Load Device Reconciliation |
| `upgradeCondition` | §9.5 Group Upgrade Path (condition only — siblings are GAP-E) |
| `toggleAdvancedOptions` | §1.3 (global simple/advanced) + per-dialog advanced panels referenced |
| `insertIndex` / task ordering | §7.3 Task Ordering |
| physical-device aggregation | §4.6 |
| `followed_by` / within | §6 (within: 9 hits) |
| editor-canvas clipboard copy/paste | §11 (distinct from in-dialog paste, which IS GAP-C) |

---

## TIER 3 — Navigation / page-state handlers (verify, likely thin in spec)

These are the dialog-navigation verbs. They may be implied but aren't specified as a state machine. Lower risk than Tier 1 but worth a confirm.

| Handler | What it does | Spec status |
|---|---|---|
| `setDesignerType` | page 0 → page 1 with a chosen type | not named |
| `prevPage` | the "Back" button on multi-page dialogs | not named |
| `selectTaskIndex` | click a task preview to set insert position | not named (but insertIndex is §7.3) |
| `editConditionGroup` / `editRestrictionGroup` | open the group-edit dialog (operator + negation) | group dialogs not separately specced |
| `addCase` / `editCase` / `updateCase` | switch-case add/edit | case dialog thinly covered |
| `addEvent` / `editEvent` / `updateEvent` | the `on`-block event dialog | event dialog not separately specced |

**Decision needed:** whether the page-navigation contract (page 0/1, Back, type-select) gets one shared spec section or is folded per-dialog.

---

## The pattern across all the misses

Every Tier 1 gap except F is the **same signature as the Cross-Cutting Inventory predicted**: a surface that applies across many dialogs and owns no single menu — re-arm (GAP-A), create-it (GAP-B), in-dialog paste (GAP-C), group-upgrade (GAP-E). They get missed because directing work menu-by-menu never lands on them. GAP-F is a different miss: a hand-listed set that should have been "read everything from the data file."

**The fix for the recurring class:** the same one the Inventory already states — these belong in their own spec section (a "cross-dialog behaviors" section), referenced by each dialog, NOT folded into any one menu. That's how they stop falling out.

---

## What to do with this list

1. **Tier 1 = write spec sections.** Six gaps. GAP-A (re-arm) and GAP-B (create-it) and GAP-C (in-dialog paste) should go in one new "Cross-Dialog Behaviors" section so they don't drop again. GAP-E folds into §9.5. GAP-F is a rewrite of §5 to be vocab-driven. GAP-D is a sub-section of §7.
2. **Tier 2 = leave alone.** Confirmed present.
3. **Tier 3 = one decision** on whether navigation gets a shared section.

This is the coverage answer. The unknown misses are now named rows.
