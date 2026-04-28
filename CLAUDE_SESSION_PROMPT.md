# PistonCore — Claude Session Starter Prompt
# Session 15 — Updated end of Session 14

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
- Docker rebuild command:
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
- When Docker build uses cached layers and changes don't appear: use `docker build --no-cache`
- Browser cache can also hide changes — use Ctrl+Shift+R or incognito window
- Frontend: vanilla JS/HTML/CSS, no framework

---

## Three Pages — Confirmed Layout

1. **List page** — home screen, OK as-is
2. **Status/Debug page** — land here after saving or clicking a piston
3. **Editor page** — full width, no centering, fills viewport, continuous document renderer

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
- Simple/Advanced preference is saved to localStorage (`pc_simpleMode`)
- Default is Advanced (Jeremy prefers Advanced)

### Define block rendering — matches WebCoRE:
```
device light = Cave Light ;
```
- Lowercase type keyword (device, string, boolean, etc.)
- No $ prefix on variable name in define block
- `= DeviceLabel` for device variables with initial value
- Space before semicolon

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
NO curly braces. Keywords: if / then / else / end if;

### Comment format: `/* text */` — correct spacing

### Clicking an existing statement opens wizard pre-populated for editing

---

## Wizard — Confirmed Rules

### NEVER two modals open at once
- if_block selection from statement picker goes to condition builder FIRST
- Only inserts the if_block into document AFTER condition is completed
- Statement picker closes, condition wizard opens — never both at once

### Wizard backdrop — no dark overlay
- Backdrop is transparent (no rgba dimming)
- Modal is centered, floats over document without hiding it

### Condition builder layout — matches WebCoRE exactly:
- ONE screen, everything visible at once
- Row: `[Physical device(s) ▾]` `[device label ▾]` `[attribute ▾]` — all native selects
- Device picker opens a searchable panel BELOW the row (not full screen replacement)
- Attribute is a plain `<select>` populated from device capabilities — always visible
- When HA disconnected: attribute select shows generic fallback list for local vars
- "Which interaction" row appears below for trigger operators
- Operator dropdown below that
- Value row appears below operator when needed

### Attribute select — capability loading rules:
- Demo devices: load from DEMO_DEVICES capabilities array in wizard.js
- Local device variables: call HA API using the entity IDs in the variable's initial_value
  - If variable has multiple devices: show UNION of all capabilities
  - If HA disconnected: show generic fallback (switch, level, battery, etc.)
- Physical devices: call API.getCapabilities(entity_id)
- See COMPILER_SPEC.md Section 18, item 8 for backend implications

### Variable wizard initial value — matches WebCoRE layout:
- One combined blue bar: `[type dropdown] [value/picker on right]`
- Note text appears BELOW the combined bar (not above)
- Warning triangle icon appears next to label when a value is set
- Options: Nothing selected / Physical device(s) / Value / Variable / Expression / Argument
  - Physical device(s) → dedicated device picker (virtual + physical + local device vars, NO system vars, NO demo devices)
  - Value → text input on right side of bar
  - Variable → picker with Local / Global / System sections
  - Expression → textarea
  - Argument → text input

### var_type normalization:
- Wizard saves normalized lowercase keys: device, string, boolean, integer, decimal, long, datetime, date, time, dynamic
- NOT the display labels (Device, String (text), etc.)

### Condition device picker:
- Shows: Physical devices, Local device variables, Demo devices
- Does NOT show: Virtual devices, System variables
- Search filters all sections including demo devices
- Demo devices always show — filtered by query when search typed, never hidden entirely

---

## Session 14 — What Was Fixed

1. ✅ Demo devices no longer disappear when search query is typed
2. ✅ "Argument" option added to condition value type dropdown
3. ✅ "Add more" now resets completely — no carryover from previous condition
4. ✅ "Any of" no longer shows for single device conditions in editor
5. ✅ Device picker no longer replaces full modal body — expands inline below compare row
6. ✅ Attribute is now a plain `<select>` populated from device capabilities
7. ✅ CSS added for inline dropdown styling
8. ✅ COMPILER_SPEC.md updated — added open item 8 (local device variable attribute resolution)

---

## Known Bugs — Fix List for Session 15

### PRIORITY 0 — Must do first, nothing else works without it

**Frontend settings/connection page — HA URL and API key entry**
- The frontend has NO UI to enter the HA URL and API key — it was never built
- Without it the frontend cannot connect to HA regardless of what's in the backend
- Jeremy already has a long-lived HA API key ready to enter
- Virtual test devices are already set up in HA and available for testing once connected
- Real physical devices will appear automatically once connected
- BUILD THIS FIRST before any wizard work in Session 15

---

1. **wizard.js** — Attribute select for local device variables only shows `switch`
   - Should call HA API using the entity IDs from the variable's initial_value
   - If multiple devices: show union of all capabilities
   - If HA disconnected: show generic fallback list

2. **wizard.js** — Value input for conditions is always a free text field
   - Should be context-aware: binary = on/off dropdown, enum = options list, numeric = number input
   - For demo devices: read values from DEMO_DEVICES capabilities array
   - For HA devices: use capability data from HA API
   - WebCoRE populates value choices from device's actual states (see session13_screenshots/26)

3. **wizard.js** — No AND/OR prompt between conditions when using "Add more"
   - WebCoRE asks how the new condition relates to the previous one (AND/OR)
   - Currently just stacks conditions with no group operator

4. **wizard.js** — Device picker still opens as panel below — should become native `<select>`
   - In WebCoRE all three (subject type, device, attribute) are native selects in a row
   - Device select opens a searchable list — but it IS a select, not a button+panel

---

## Device Variable Attribute Resolution — Important Design Note

Local device variables can contain multiple HA entities (e.g. `device light = Cave Light, Dining Light`).
HA integrations use inconsistent naming for the same capability across device types.
The wizard shows the UNION of all capabilities for the group — user picks the attribute.
The COMPILER handles per-device resolution at compile time (see COMPILER_SPEC Section 18, item 8).
Users mixing incompatible types (contact sensors + lights) is an edge case — most groupings are
same-type devices. Cross-type attributes like battery work cleanly across any group.

---

## Simple Mode — Jeremy's Preference (confirmed Session 13)

Jeremy uses Advanced mode almost always. Simple mode should:
- Show define block (always — Jeremy uses it constantly)
- Hide only when blocks unless they have content
- Show execute block with `· add a new statement`

Simple/Advanced toggle stays in UI. Default = Advanced.

---

## Future Plans (noted, not blocking)

- Virtual test devices in companion HA app (Grok has partial working version)
- Windows app via PyInstaller
- Login system (post-v1)
- Cloud hosting (after login)
- WebCoRE-style toolbar icons (properties panel, etc.) — noted, not v1

---

## Session Log Summary

Sessions 1-11: Design, backend, Docker, frontend scaffold.
Session 12: Editor + wizard rewrites. Demo devices. Multiple bugs found, partially fixed.
Session 13: Major wizard and editor fixes. Variable wizard layout, define block rendering,
            mode persistence, condition picker improvements, edit-in-place for statements.
Session 14: Condition builder inline device/attribute pickers. Demo device search fix.
            Argument option added. Add more reset. Any-of single device fix. CSS for dropdowns.
            Attribute changed to native select. COMPILER_SPEC open item 8 added.

---

## Next Session — Start Here

1. Read this prompt fully
2. **Ask Jeremy to upload wizard_reference_screenshots.zip and any session screenshots**
   - Read ANNOTATIONS.md inside each zip before touching any code
3. Ask Jeremy to upload current wizard.js, editor.js, and any other files that need changes
4. Confirm fix list with Jeremy — Priority 0 is the HA settings/connection page
5. Build the settings page FIRST — no wizard work until HA can actually connect
6. After settings page works and HA connects, move to wizard fix list in priority order
7. After each fix: give Jeremy the yes/no test checklist, wait for screenshot
8. Generate updated session prompt at end of session
