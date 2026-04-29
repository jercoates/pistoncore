# PistonCore — Session 14.5 Notes
# Between Session 14 and Session 15
# Written by Claude at end of lunch session

---

## What Happened This Session

This was an unplanned session between 14 and 15. Jeremy consulted Gemini about speeding
up frontend development. Gemini suggested using the original webCoRE dashboard as-is —
that advice was reviewed and rejected. The correct approach is what we are already doing.

**The big win this session:** We pulled the actual webCoRE source code from GitHub
(app.js and piston.module.html) and read it in full. This is more useful than screenshots
because it shows exactly how the wizard step flow, comparison template, and operand
template work. Future sessions should reference this conversation instead of asking
for screenshots to understand webCoRE behavior.

---

## Files Delivered This Session

Two fixed files are ready to drop into the repo:
- `wizard.js` — structural bugs fixed (see below)
- `editor.js` — structural bugs fixed (see below)

**Replace the existing files and rebuild Docker before Session 15 work begins.**

---

## What Was Fixed in wizard.js

1. **Step stack doubling** — `_pushStep()` now deduplicates. Same function never pushed
   twice in a row. Back button now works correctly.

2. **Device selection no longer triggers full re-render** — picking a device from the
   panel now updates the button label in place and loads capabilities without destroying
   the modal state.

3. **`_refreshConditionRows` fixed** — the second value input for "between" operators
   is now added/removed dynamically without a full re-render. No more stale HTML.

4. **Operator dropdown** — now shows Triggers first with ⚡ prefix, Conditions second.
   Matches webCoRE layout.

5. **`if_block` mechanism unified** — removed the competing `_sel.pending_if_id` system.
   Now uses `_extra['block-id']` exclusively. One mechanism, not two.

6. **`_commitCondition` and `_commitConditionAndMore`** — both now use `_extra['block-id']`
   consistently.

---

## What Was Fixed in editor.js

1. **`insertStatement` if_condition context** — conditions added to an if_block now go
   to the correct block's conditions array. Previously they went to the top-level
   conditions array instead.

2. **`service_call` rendering** — now renders as `with {device} do service;` in the
   document, matching the with/do keyword style.

3. **Trigger routing** — now checks `is_trigger` flag in addition to `type` field when
   deciding where to insert a node.

---

## Problems Found But NOT Fixed — Do These in Session 15

These are in priority order per the session prompt.

### PRIORITY 0 — Do this first, nothing else is testable without it
**HA Settings / Connection Page**
- There is NO UI to enter the HA URL and long-lived API token
- Frontend cannot connect to HA at all without this
- Jeremy has a long-lived token ready to enter
- Virtual test devices are set up in HA waiting
- Build this page FIRST before any wizard work

### 1. Device picker should be a native `<select>`, not a button+panel
- Current: button that opens a panel below
- Should be: three native `<select>` elements in a row (subject type / device / attribute)
- This is the webCoRE layout exactly
- This also makes items 2 and 3 below easier to implement
- WebCoRE source reference: `operand` template in piston.module.html

### 2. Value input is always a free text field
- Should be context-aware based on attribute_type:
  - binary → dropdown showing friendly labels (Open/Closed, Detected/Clear, etc.)
  - enum → dropdown of actual state values from HA
  - numeric → number input with unit label
- For demo devices: read values from DEMO_DEVICES capabilities array in wizard.js
- For HA devices: use capability data from API
- WebCoRE source reference: `comparison` template in piston.module.html

### 3. No AND/OR prompt between conditions when using Add more
- WebCoRE asks how the new condition relates to the previous one (AND or OR)
- Currently just stacks conditions with no group_operator set
- Fix: after first condition added, prompt for AND/OR before building next one

---

## Backend / Compiler Gaps Found — Fix AFTER Frontend Works

These do not affect the browser UI but will matter when Deploy button is wired up.

1. **Wizard produces `service_call`, compiler expects `with_block`**
   - Wizard `_saveDeviceCmd()` produces `{type:"service_call", devices:[entityId]}`
   - Compiler `_compile_sequence()` has no handler for `service_call`
   - Fix options: add `_normalize_action()` to compiler, or make wizard produce `with_block`

2. **Entity ID vs Role in device_map**
   - Wizard stores `entity_id` on subject but compiler resolves via `device_map[role]`
   - Need `_entityToRole()` in wizard and `Editor.registerDeviceRole()` to auto-populate
     `piston.roles` and `piston.device_map` when user picks a device

3. **Trigger format mismatch**
   - Wizard produces `{type:"trigger", operator:"changes to", compiled_value:"on"}`
   - Compiler `_compile_triggers()` expects `{type:"state", target_role:"...", to:"on"}`
   - Fix: add `_normalize_trigger()` pre-processing step in compiler

4. **Binary sensor compiled_value lookup must live in wizard**
   - The DEVICE_CLASS_LABELS table (door→Open/Closed, motion→Detected/Clear, etc.)
     must be in the wizard so it can set `compiled_value` before saving
   - Compiler always reads `compiled_value` and puts it directly into HA YAML
   - If wizard saves `display_value:"Open"` without setting `compiled_value:"on"`,
     the generated YAML will have `state: Open` which HA rejects silently

5. **`if_condition` block-id**
   - Fixed in editor.js `insertStatement()` this session
   - Wizard now passes `_blockId` via `_extra['block-id']` unified mechanism

---

## WebCoRE Source Reference

Full webCoRE source was read in the Session 14.5 chat. Key files:
- `app.js` — Angular app, wizard controller logic, all step functions
- `piston.module.html` — all ng-template wizard dialogs including:
  - `dialog-edit-condition` — condition/group first step
  - `comparison` — operator → value input chaining (THIS is the reference for fix #2)
  - `operand` — input type switching device/variable/constant/expression
  - `dialog-edit-task` — action device picker and command flow

Memory note saved pointing to Session 14.5 chat for this reference.

---

## Session 15 Start Checklist

1. Read this file
2. Read the session prompt (SESSION_15_PROMPT or equivalent)
3. Drop in the new wizard.js and editor.js from this session
4. Rebuild Docker
5. Verify basic flow works in browser (ghost text → wizard opens, device picks, operator works)
6. Build HA settings/connection page — PRIORITY 0
7. After HA connects and real devices appear, move to wizard fix list in order
8. Do NOT touch backend/compiler gaps until frontend is working end to end

---

## Jeremy's Infrastructure Reminder

- Unraid at 192.168.1.226, port 7777
- GitHub: github.com/jercoates/pistoncore
- Docker rebuild:
  ```
  cd /mnt/user/appdata/pistoncore-dev
  git pull
  docker build -t pistoncore .
  docker stop pistoncore && docker rm pistoncore
  docker run -d \
    --name pistoncore \
    --restart unless-stopped \
    -p 7777:7777 \
    -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata \
    -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize \
    pistoncore
  ```
- If changes don't appear: `docker build --no-cache`
- Browser cache: Ctrl+Shift+R or incognito

---

*End of Session 14.5 notes*
