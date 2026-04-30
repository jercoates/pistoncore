# PistonCore — Claude Session Starter Prompt
# Session 16 — Updated end of Session 15

---

## CRITICAL RULES FOR CLAUDE

1. **WebCoRE screenshots = REFERENCE** for how PistonCore SHOULD look
2. **PistonCore screenshots = showing what is WRONG** and needs fixing
3. **Never confuse the two** — always ask "is this WebCoRE or PistonCore?" before acting
4. **Do not code without permission** — present the fix list, wait for "go"
5. **Do not update specs mid-session** — code first, specs after it works in browser
6. **One problem at a time** — confirm the full list before writing any code
7. **Always ask Jeremy to upload the WebCoRE reference screenshots at session start**
   - wizard_reference_screenshots.zip — condition builder, operator list, action picker
   - session screenshots from prior session if Jeremy has them
   - Read the ANNOTATIONS.md inside each zip before writing any code

---

## Project Overview

Building PistonCore — a WebCoRE-style visual automation builder for Home Assistant.
GitHub: https://github.com/jercoates/pistoncore

Jeremy has almost no programming background. He directs vision, Claude writes code.
Sessions are limited. This prompt is Claude's memory between sessions.
Real users are watching the GitHub repo.

---

## Infrastructure

- Unraid server at 192.168.1.226, port 7777
- Files are copied directly over the network to Unraid — NOT deployed via git pull
  (git pull has a caching issue that overwrites changes)
- Jeremy pushes to GitHub manually after a session's fixes are confirmed working
- Docker rebuild command:
  ```
  cd /mnt/user/appdata/pistoncore-dev
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
- When Docker build uses cached layers: use `docker build --no-cache`
- Browser cache: Ctrl+Shift+R or incognito window
- Frontend: vanilla JS/HTML/CSS, no framework
- Backend: Python FastAPI, port 7777

---

## Three Pages — Confirmed Layout

1. **List page** — home screen, OK as-is
2. **Status/Debug page** — land here after saving or clicking a piston
3. **Editor page** — full width, no centering, fills viewport, continuous document renderer

---

## HA Connection — Working as of Session 15

- HA settings modal opens by clicking the "HA Disconnected" badge in the header
- Saves ha_url and ha_token via `PUT /config`
- Tests connection via `GET /devices`
- Badge updates to "HA Connected" on success
- Jeremy's HA is at http://192.168.1.65:8123
- Long-lived token is saved in config — Jeremy has it ready if needed

---

## Device Picker — Current State

The condition wizard device panel now:
- Connects to real HA and shows live devices ✅
- Filters to useful domains only (light, switch, binary_sensor, sensor, etc.) ✅
- Parses entity_id to disambiguate duplicate friendly names ("Basement — Volume") ✅
- Sorts by area then name ✅

---

## Known Bugs — Fix List for Session 16

### PRIORITY 1 — HA Device List Quality

**Problem:** Even with domain filtering, the device list still has issues:
- Some entities that shouldn't appear are still showing (HA auto-discovered integrations
  like Sonos that Jeremy didn't set up — these appear as media_player entities)
- Virtual test devices Jeremy set up in HA are not showing correct state/attributes
  in the attribute picker (may be a virtual device config issue, not a PistonCore bug —
  verify with real physical devices first)
- HA has entities for devices "not actually set up" — these come from HA's auto-discovery
  (mDNS/SSDP). No clean way to filter these without user input. Options to discuss:
  1. Add an "Only show devices in areas" filter toggle — devices without an area assigned
     are often auto-discovered junk
  2. Let user hide specific entities from the picker (My Device Definitions screen)
  3. Accept it as a known HA limitation and document it

**DESIGN.md note:** Section 5 says "no entity IDs ever visible to the user" — this needs
to be updated. The compromise reached in Session 15: show friendly name prominently,
append parsed entity suffix to disambiguate ("Basement — Volume"). No raw entity_id
shown. Update DESIGN.md Section 5 wording to match this approach before coding.

### PRIORITY 2 — Wizard: AND/OR prompt between conditions (Add more)

From SESSION_14_5_NOTES:
- WebCoRE asks how new condition relates to previous one (AND or OR)
- Currently just stacks conditions with no group_operator set
- Fix: after first condition is added, prompt for AND/OR before building next one

### PRIORITY 3 — Wizard: Operator order still wrong

- Triggers should appear FIRST with ⚡ prefix
- Conditions second
- Currently reversed in PistonCore

### PRIORITY 4 — Wizard: Orange "Any of the selected devices" banner

- Should appear above compare row when ANY device is selected (not just multi-device)
- Currently hidden until multiple devices selected
- Partially fixed in Session 15 but needs verification with real devices

### PRIORITY 5 — Wizard: Value input for binary/enum attributes from real HA devices

- When a real HA device is selected (not demo), attribute type comes from
  `API.getCapabilities(entity_id)` — but the value widget isn't updating correctly
  for binary/enum types from real devices
- For demo devices this works. For real HA devices verify it works after HA connects.

---

## Backend / Compiler Gaps — Fix AFTER Wizard Works End to End

These don't affect the browser UI but matter when Deploy is wired up.
From SESSION_14_5_NOTES:

1. **Wizard produces `service_call`, compiler expects `with_block`**
   - `_saveDeviceCmd()` produces `{type:"service_call", devices:[entityId]}`
   - Compiler `_compile_sequence()` has no handler for `service_call`
   - Fix: add `_normalize_action()` to compiler, or make wizard produce `with_block`

2. **Entity ID vs Role in device_map**
   - Wizard stores `entity_id` on subject but compiler resolves via `device_map[role]`
   - Need `_entityToRole()` in wizard and `Editor.registerDeviceRole()` to auto-populate
     `piston.roles` and `piston.device_map` when user picks a device

3. **Trigger format mismatch**
   - Wizard produces `{type:"trigger", operator:"changes to", compiled_value:"on"}`
   - Compiler expects `{type:"state", target_role:"...", to:"on"}`
   - Fix: add `_normalize_trigger()` pre-processing step in compiler

4. **Binary sensor compiled_value lookup must live in wizard**
   - DEVICE_CLASS_LABELS table (door→Open/Closed, motion→Detected/Clear, etc.)
     must be in wizard so it sets `compiled_value` correctly before saving
   - Compiler reads `compiled_value` directly into HA YAML — wrong value = silent HA failure

---

## Editor Document — Confirmed Rendering Rules

### Simple mode shows:
- Comment header block
- settings / end settings
- define block — ALWAYS shown in both Simple and Advanced (Jeremy uses it constantly)
- execute block with `· add a new statement`
- NO "only when" blocks unless they have content

### Advanced mode shows everything including:
- only when (restrictions) block with ghost text
- only when inside execute (triggers/conditions) with ghost text

### Mode persistence:
- Simple/Advanced preference saved to localStorage (`pc_simpleMode`)
- Default is Advanced (Jeremy prefers Advanced)

### Define block rendering — matches WebCoRE:
```
device light = Cave Light ;
```

### If block — correct keywords:
```
if
  · add a new condition
then
  · add a new statement
else
  · add a new statement
end if;
```

---

## Wizard — Confirmed Rules

### NEVER two modals open at once
- if_block selection goes to condition builder FIRST
- Only inserts if_block AFTER condition is completed
- Uses `_extra['block-id']` exclusively — unified mechanism

### Wizard backdrop — no dark overlay
- Backdrop is transparent
- Modal is centered, floats over document

### Condition builder layout:
- ONE screen, everything visible at once
- Row: `[Physical device(s) ▾]` `[device picker button]` `[attribute ▾]`
- Device picker opens inline panel BELOW the row with search
- "Which interaction" row always visible (not conditional on device selection)
- Operator dropdown below that (Triggers first ⚡, Conditions second)
- Value row appears below operator when needed — textarea for free text types

### Modal size:
- 720px wide, fills most of screen height
- wiz-body scrolls, modal does not grow

### Value inputs:
- Binary/enum attributes → dropdown of actual values
- Numeric attributes → number input with unit
- Free text (Value/Variable/Expression/Argument) → textarea that wraps

---

## Session 15 — What Was Fixed

1. ✅ Device picker changed to inline panel with search
2. ✅ Static domain capability map added (DOMAIN_CAPS) for offline/local variable use
3. ✅ Local device variable caps now derived from entity domain instead of hardcoded "switch"
4. ✅ Modal size increased to 720px wide, full height
5. ✅ Value inputs changed to textareas for free-text types
6. ✅ Orange "Any of the selected devices" banner added (shows on device select)
7. ✅ "Which interaction" row always visible
8. ✅ HA settings modal built — click badge to open, save URL+token, test connection
9. ✅ HA WebSocket connection working — real devices loading in wizard
10. ✅ Domain filter added to ha_client.py — junk entities removed
11. ✅ Entity label parser added — "Basement — Volume" disambiguation
12. ✅ Devices sorted by area then name

---

## Files Changed in Session 15

- `frontend/js/wizard.js` — device picker, caps, modal size, value inputs, banner
- `frontend/css/style.css` — modal size, wiz-body scrolling, spacing
- `frontend/js/app.js` — HA badge click, HASettings module, checkHAConnection
- `frontend/index.html` — HA settings modal markup
- `backend/ha_client.py` — domain filter, label parser, area sort

---

## Design Doc Updates Needed (do at start of Session 16)

1. **DESIGN.md Section 5** — "No entity IDs ever visible to the user" needs updating.
   Compromise: show friendly name + parsed entity suffix to disambiguate
   ("Basement — Volume"). No raw entity_id shown. Update wording to match.

2. **README.md** — Check if it's stale. It was flagged in Session 13 notes as needing
   update to reflect: current status, how to run on Unraid, remove "planned" language
   for things already built. Check before session 16 coding starts.

---

## Future Plans (noted, not blocking)

- AND/OR prompt between conditions (Priority 2 above)
- Virtual test devices in companion HA app
- Windows app via PyInstaller
- Login system (post-v1)
- Cloud hosting (after login)
- "Only show devices in areas" filter toggle for device picker
- My Device Definitions screen (hide/rename entities from picker)
- WebCoRE-style toolbar icons

---

## Session Log Summary

Sessions 1-11: Design, backend, Docker, frontend scaffold.
Session 12: Editor + wizard rewrites. Demo devices. Multiple bugs found, partially fixed.
Session 13: Major wizard and editor fixes. Variable wizard layout, define block rendering,
            mode persistence, condition picker improvements, edit-in-place for statements.
Session 14: Condition builder inline device/attribute pickers. Demo device search fix.
            Argument option added. Add more reset. Any-of single device fix. CSS for dropdowns.
            Attribute changed to native select. COMPILER_SPEC open item 8 added.
Session 14.5: wizard.js and editor.js structural bug fixes. Step stack, device selection,
              refreshConditionRows, operator order, if_block unified mechanism.
Session 15: Wizard improvements (larger modal, device search panel, domain caps map,
            context-aware value inputs, agg banner). HA settings page with WebSocket
            connection. Real devices loading. Domain filter + label disambiguator in backend.

---

## Next Session — Start Here

1. Read this prompt fully
2. Update DESIGN.md Section 5 wording (entity ID compromise) — do this BEFORE coding
3. Check README.md for staleness
4. Ask Jeremy to upload current wizard.js, ha_client.py, and any other files that need changes
5. Confirm fix list with Jeremy — Priority 1 is HA device list quality
6. Work through fix list in priority order
7. After each fix: give Jeremy the yes/no test checklist, wait for screenshot
8. Generate updated session prompt at end of session
