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
