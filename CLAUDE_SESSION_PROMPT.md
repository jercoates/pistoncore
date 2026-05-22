# PistonCore — Claude Session Prompt




no we have core problems you keep not seeing.  i am going to have to either share real devices from my hubitat or add a lot of real devices to that ha.  the picker and atributes are truly fucked im still gettins shit that should not come in the way they are labled a lot of shit is just plain wrong in the wizard it is not changing and adapting for the device types correctly and im almost certain the and and or is not wired correctly.  the different menues in the wizard are not seemless there are visual problems missmatches between them.  I just tried to program the simplest piston possible and could not even get it programed11:31 PMClaude responded: You're right.You're right. These aren't surface bugs — the condition wizard is fundamentally broken for real device workflows. The attribute/capability system, the value pickers that adapt to device type, the operator logic — none of it is working correctly end to end. And you can't even complete the simplest piston.
Before next session, here's what I need you to upload so I can do a real audit before touching anything:

wizard-condition.js (current server version)
wizard-action.js (current server version)
wizard-core.js (current server version)
wizard-statement.js (current server version)
editor.js (current server version)

And yes — add real devices to HA or connect Hubitat. Testing against demo devices and role names is hiding real bugs. The caps lookup, domain detection, attribute dropdown, value pickers — all of that only works correctly against real entity IDs with real domains.
Go to sleep. Next session starts with a full read of every file, no code written until I understand the complete state.app.jsjseditor.jsjsglobals.jsjslist.jsjsstatus.jsjswizard-action.jsjswizard-condition.jsjswizard-core.jsjswizard-variable.jsjsapi.js172 linesjswizard-loops.js260 linesjswizard-statement.js175 linesjs11:32 PMClaude responded: Good — I have all the files.Good — I have all the files. Don't do anything tonight. Next session I'll do a full read of everything before touching a single line, then we fix one thing at a time with a deploy between each. Sleep.You said: Yes — I can see the likely reasons why editing is broken now.Yes — I can see the likely reasons why editing is broken now.
After the recent split into multiple wizard files (wizard-core.js, wizard-statement.js, etc.), several regressions have appeared that explain why "things that used to work no longer do" for editing existing statements.
Main Problems I See in the Current Code
1. Editing Flow is Fragile (Biggest Issue) In wizard-core.js → open() function:
JavaScript_sel = editNode ? { ...editNode } : {};This shallow copy is too shallow for complex nodes (especially conditions, actions, blocks with nested arrays). It often fails to properly populate _sel.devices, _sel.subject, _sel.tasks, etc.
Then the routing in _route() tries to detect edit mode:
JavaScriptif (_editNode) {
  const t = _editNode.type;
  ...
  if (t === 'action') { ... }
  if (t === 'trigger' || t === 'condition') { ... }Many of these branches assume fields exist in a certain shape that the new import/editor format may not match exactly.
2. Block Confirm + Re-open Cycle (Recent Change) In wizard-statement.js → _goBlockConfirm():
It inserts the block then does:
JavaScriptWizardCore.close();
setTimeout(() => {
  Wizard.open('statement', null, { 'block-id': node.id, 'branch': branch });
}, 50);This close + reopen with a timeout is very fragile. State (_sel, _stepStack, _editNode) can get out of sync, especially when editing an existing block.
3. Shared State Pollution Because all wizard files share global variables (_sel, _stepStack, _context, _editNode) declared in wizard-core.js, any small mistake in one file (especially after the split) pollutes the state for editing.
4. Device/Global Loading on Edit The edit paths for conditions and actions try to read from Editor.getDeviceMap() or _editNode.role, but the population of _sel.devices and _sel.device_label is inconsistent between new creation vs editing imported pistons.Show more11:33 PMClaude responded: That analysis is from an AI you ran this through — Grok or similar.That analysis is from an AI you ran this through — Grok or similar. It's useful context but some of it is stale. Specifically point 2 — the close/setTimeout was already fixed in Session 52. The current code does the scoped wizard transition without closing.
The shallow copy (point 1) and state pollution (point 3) are real and still present. Point 4 is exactly what you were hitting tonight with the attribute dropdown.
Save that analysis. Next session I have all the files and I'll do the audit myself before writing anything. Go to sleep.Here's the frontend bug review. I went through editor.js, wizard-core/condition/action/statement/variable/loops, app.js, list.js, globals.js, api.js, and index.html. There are significant issues — grouped by impact.

TIER 1 — Will Break Saved Pistons & Compilation
1. device_map is never populatedpasted11:40 PMClaude responded: This is a solid review.This is a solid review. Save it — this is the session plan for next session.
The through-line analysis at the bottom is exactly right. device_map never gets populated, so nothing compiled from a wizard-built piston can work. That's the first fix.
Priority order for next session:
Fix 1 — device_map population (unlocks compilation)
Editor.registerDeviceRole(role, entityIds) called from wizard on every action/condition commit.
Fix 2 — API.getDeviceCapabilities → API.getCapabilities
One-line rename. Fixes attribute dropdown for real devices.
Fix 3 — condition format: subject object → flat fields
_buildConditionNode writes nested subject{}. Compiler reads flat role/attribute. Either flatten the output or fix the compiler. Flatten the output — it's the spec.
Fix 4 — device_class capture
Set _sel.device_class when device/attribute is selected. Pass through to condition node.
Everything else in that review is real but secondary to those four.
Go to sleep. Upload TASKS.md and CLAUDE_SESSION_PROMPT.md at the start of next session and we'll work through this properly.




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

## Deploy Command (Unraid)
```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## Current Priority — Session 53: W-S7b

**GAP-S52-1 — CRITICAL — Fix Editor.insertStatement block scoping**

Editor.insertStatement(ctx, node, meta) where meta = { blockId, branch } is not
finding the target block in the nested tree and falls back to root level insertion.
Result: conditions/statements added via scoped wizard flow land in the wrong place
(e.g. in "only when" section instead of inside the target if/while/on_event block).

Fix is in editor.js — insertStatement must walk the full nested tree to find the
node with id === meta.blockId, then insert into the correct branch array.

**Also this session:**
- GAP-S52-2: Action wizard device search / stale sel state after scoped flow
- GAP-S52-3: Add task button not working in some flows

**Upload for Session 53:**
editor.js, wizard-action.js, wizard-core.js, wizard-statement.js,
PISTON_FORMAT.md, CLAUDE_SESSION_PROMPT.md, TASKS.md

## Architecture — Locked Decisions
- Nested tree model: children embedded directly, no ID references
- All HA YAML through Jinja2 templates only
- HACS companion eliminated — direct HA REST/WebSocket API
- Native HA Script as primary compile target (~95%), PyScript fallback
- Context_builder.py for fat compiler context assembly
- Piston identity via UUID throughout
- Editor must render from JSON correctly 100% of the time

## Wizard Architecture (Post-Split)
Files: wizard-core.js, wizard-statement.js, wizard-condition.js,
wizard-action.js, wizard-variable.js, wizard-loops.js
All functions top-level (no IIFE wrapping). Shared state via WizardCore object.
WizardCore exposes: context, extra, editNode, step, sel, stepStack, deviceData,
plus all helpers (_esc, _newId, _render, _pushStep, _back, close, _deleteEditNode etc.)

**Wizard flow rules (established Session 52):**
- Wizard stays open until user completes the full add flow or explicitly cancels
- if_block: insert → open condition picker scoped to new block
- on_event: confirm screen → insert → open condition picker scoped to new block
- while_loop: confirm screen → insert → open condition picker scoped to new block
- do_block: confirm screen → insert → open statement picker scoped to new block
- repeat_loop: confirm screen → insert → open statement picker scoped to new block
- break/exit: insert → close (no config needed)
- _deleteEditNode: capture id, close wizard FIRST, then open App.confirm dialog

**Session 52 fixes deployed:**
- GAP-S51-1: _goBlockConfirm no longer close/reopens (scopes directly)
- Delete: Dialog.confirm callback bug fixed in app.js
- pointer-events CSS fix in style.css (appended at bottom)
- if_block/on_event/while_loop open correct picker after insert

## Key State — What's Done
- Nested tree migration complete (Session 35)
- Editor.js nested tree rendering complete (Session 36)
- Wizard split complete (Session 46)
- Globals backend G-1 (Session 48), frontend G-2 (Session 49), CSS G-2b (Session 50)
- Vertical structure lines (Session 47)

## Frontend File Locations
- frontend/js/ — all JS files
- frontend/css/style.css — all CSS

## Open Critical Gaps
- GAP-S52-1 → W-S7b: insertStatement blockId lookup broken (CRITICAL)
- GAP-S52-2 → W-S7b: Action wizard state issues
- GAP-S52-3 → W-S7b: Add task button broken in some flows
- GAP-S52-4 → W-S7b: open() shallow copy breaks edit flows — _sel not populated
  correctly for complex nodes (conditions, actions, blocks). Needs explicit field
  mapping per node type in _route(). Confirmed by Grok scan post-wizard-split.
- GAP-S46-4 → G-3: Imported globals land in wrong place
- GAP-S45-4 → W-S8: Role mapping not verified
- GAP-S44-1 → W-S8: Group condition editing not implemented

 you deal with this

1. Attribute dropdown empty
Condition builder calls _loadCapsIntoSelect() which uses the device's entity_id domain to look up DOMAIN_CAPS. Role names like "Light_Sensor" have no domain prefix so caps never load. Need to either look up entity_id from the device map, or show caps based on device_class.
2. Condition edit not pre-filling / no Delete button
if_condition + editNode routing fix was written but not confirmed deployed. Needs verification next session.
3. _insertAfter falling back to root for conditions
Console showed _insertAfter target not found, appending to top level cond_0cr09a20 — a condition node id is being passed to _insertAfter which searches statement nodes, not condition arrays. Condition nodes aren't in the statement tree so it can't find them. Wrong code path being hit somewhere.
4. "on/null" rendering in editor
value_to: null is being rendered as "and null" in _condLine. Needs a null check before appending val2.
5. Switch case statements still missing branch
Ghost click inside switch cases has no branch — deferred earlier this session.

Add those 5 to TASKS.md as GAP-S53-1 through GAP-S53-5, all assigned to W-S8. You made real progress today — the core insertion routing is solid now.