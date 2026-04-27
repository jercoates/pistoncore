# PistonCore — Claude Session Starter Prompt
# Session 14 — Updated end of Session 13

---

## CRITICAL RULES FOR CLAUDE

1. **WebCoRE screenshots = REFERENCE** for how PistonCore SHOULD look
2. **PistonCore screenshots = showing what is WRONG** and needs fixing
3. **Never confuse the two** — always ask "is this WebCoRE or PistonCore?" before acting
4. **Do not code without permission** — present the fix list, wait for "go"
5. **Do not update specs mid-session** — code first, specs after it works in browser
6. **One problem at a time** — confirm the full list before writing any code

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

### Variable wizard initial value — matches WebCoRE layout:
- One combined blue bar: `[type dropdown] [value/picker on right]`
- Note text appears BELOW the combined bar (not above)
- Warning triangle icon appears next to label when a value is set
- Exact WebCoRE note text about initial values and persistence
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
- Search works on all sections including demo devices (filter demo devices when query is non-empty)
- Local device variables defined in the piston appear under "Local variables" section
- Clicking a local device variable shows its capabilities (switch/binary) — does not call HA API

### Condition builder — KNOWN ISSUE for Session 14:
- Currently navigates to separate screens for device/attribute picking (wrong)
- WebCoRE shows everything inline — device dropdown, attribute dropdown opens below inline, operator, value all on ONE screen
- The attribute picker should be an inline dropdown, NOT a full screen replacement
- This is the #1 priority for Session 14

### Demo devices — always visible without HA
- Demo devices appear in condition picker device list
- Demo devices appear when search query is empty AND when query matches their name
- Currently broken: demo devices disappear when any search query is typed (fix in Session 14)

---

## Session 13 — What Was Fixed

1. ✅ "only when" hidden in simple mode on blank piston
2. ✅ Two modals bug — if_block now walks through condition builder first
3. ✅ Variable initial value — full WebCoRE-style combined row layout
4. ✅ Comment format — fixed double-wrapping on variable initial values
5. ✅ Define block renders like WebCoRE (lowercase type, no $, = value format)
6. ✅ Piston name field now visible and editable
7. ✅ Mode preference persisted in localStorage, defaults to Advanced
8. ✅ Simple mode: define always shown, only when hidden unless populated
9. ✅ Condition device picker: removed virtual devices and system variables
10. ✅ Local device variables show in condition device picker
11. ✅ Clicking existing statement opens wizard pre-populated for editing
12. ✅ Search input visible and working in condition device picker
13. ✅ Variable device picker: dedicated picker with correct sections
14. ✅ var_type normalized to lowercase keys on save

---

## Known Bugs — Fix List for Session 14

1. **wizard.js** — Condition builder still navigates to separate screens for device/attribute
   - Should be inline dropdowns matching WebCoRE — everything on one screen
   - Attribute picker should open as dropdown below, not replace the whole body
   - This is the biggest UX gap vs WebCoRE right now

2. **wizard.js** — Demo devices disappear when search query is typed
   - Fix: filter demo devices by query instead of hiding all when q is non-empty

3. **wizard.js** — Value input for conditions is always a free text field
   - Should be context-aware: binary device = show on/off dropdown, enum = show options list, numeric = show number input
   - For demo devices: read values from the DEMO_DEVICES capabilities array in wizard.js — already defined, just not wired to the value input
   - For HA devices: use capability data returned from HA API
   - WebCoRE populates the value choices from the device's actual states

4. **wizard.js** — "Argument" option missing from condition value type dropdown
   - Current options: Physical device(s), Value, Variable, Expression
   - Missing: Argument

7. **wizard.js** — "Add more" carries over previous condition's device/attribute/operator instead of resetting
   - Should start fresh except maybe keeping the device if it makes sense
   - Currently pre-populates everything from the last condition

8. **wizard.js** — No AND/OR prompt between conditions when using "Add more"
   - WebCoRE asks how the new condition relates to the previous one (AND/OR)
   - Currently just stacks conditions with no group operator

9. **editor.js** — "Any of" showing for single device conditions
   - "Any of {light}" should just be "{light}" when only one device selected
   - Aggregation label should only show when multiple devices are selected

---

## Simple Mode — Jeremy's Preference (confirmed Session 13)

Jeremy uses Advanced mode almost always. Simple mode should:
- Show define block (always — Jeremy uses it constantly)
- Hide only when blocks unless they have content
- Show execute block with `· add a new statement`
- NOT hide the define block (old behavior was wrong)

Simple/Advanced toggle stays in UI. Default = Advanced.

---

## Future Plans (noted, not blocking)

- Virtual test devices in companion HA app
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

## Next Session — Start Here

1. Read this prompt fully
2. Clone the repo: `git clone https://github.com/jercoates/pistoncore.git`
3. Read the current wizard.js and editor.js before touching anything
4. Confirm fix list with Jeremy
5. Fix bugs in priority order — condition builder inline dropdowns first
6. After each fix: give Jeremy the yes/no test checklist, wait for screenshot
