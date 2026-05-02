# Notes for Next Session
# Created end of Session 17
# Add these to specs/prompt at start of next session before coding

---

## Variable Type List — Missing Types

DESIGN.md variable types table is incomplete. Add before coding variable wizard:

- **Dynamic** — any type, determined at runtime. Appears at top of type list in WebCoRE.
- **Large number (long)** — large integer type. Sits between Number (decimal) and Date and Time.

Full correct order matching WebCoRE:
1. Dynamic
2. String (text)
3. Boolean (true/false)
4. Number (integer)
5. Number (decimal)
6. Large number (long)
7. Date and Time
8. Date (date only)
9. Time (time only)
10. Device

Advanced lists (v2 — show grayed out in v1 with "Coming in v2" tooltip):
- Dynamic list, String list, Boolean list, Number list (integer),
  Number list (decimal), Large number list (long), Date and Time list,
  Date list, Time list

---

## Device Picker vs Variable Picker — Hard Separation

The separation is by TYPE not by whether something is a variable.
Device-type variables belong in the device picker. Non-device variables belong
in the variable picker. A variable's type determines which picker it appears in.

**Device picker shows:**
- Physical HA devices (grouped by area, then name)
- Device-type global variables (@SmokeDetectors, @AlertLights, @Speakers)
- Device-type local piston variables ($device, $currentDevice)
- Virtual devices section (Time, Date, Location, System Start)
- NO non-device variables, NO scalar globals, NO helpers

**Variable picker shows:**
- Non-device local piston variables ($count, $message, $status)
- Non-device global variables (@BatteryStatus, @AwayMode)
- System variables ($now, $sunrise, $sunset, $index, $hour, etc.)
- NO physical devices, NO device-type variables

When a wizard step asks the user to pick a device → device picker only.
When value type dropdown shows "Variable" → variable picker only (non-device types).
When value type dropdown shows "Device" → device picker only.
When value type dropdown shows "Value" → value input widget, not a picker.

The type of the variable determines which picker it appears in — not the fact
that it is a variable. This must be enforced at the component level.

---

## Globals Panel Behavior

Globals panel accessible from every page via button at the top.
Opens as slide-in or dropdown panel — not a persistent sidebar.
Read-only view of all globals with current values.
Has an X to close.
Empty state text: "No global variables defined."
Panel stays visible while wizard is open so user can reference globals
while building expressions — do not auto-close when wizard opens.

---

## WebCoRE Reference Screenshots for Next Session

Upload these at session start if working on variable wizard:
- 1777693803441_image.png — Set variable wizard, expression textarea, globals panel
- 1777693947888_image.png — Same wizard, PistonCore side by side showing current state
- 1777694184515_image.png — Add a new variable type dropdown, WebCoRE vs PistonCore

---

## PistonCore Editor Rendering Bugs (visible in session 17 screenshots)

Not priority — fix device list clutter first. But note for when editor work resumes:
- "only when" block appearing between define and execute — wrong position
- Second "only when" inside execute — confused rendering
- Ghost text inside execute says "add a new trigger or condition" — wrong,
  triggers and conditions are separate sections above execute not inside it
- Piston name "light" appearing to bleed into the Simple/Advanced toggle area

---

## BASE_URL — Flag for Cousin (Frontend Developer)

FRONTEND_SPEC.md v0.6 now requires BASE_URL for ALL frontend connections.
Any hardcoded path in frontend JS is a bug that will break under addon ingress.

If the cousin is writing frontend code against the repo right now, he needs to
know about this before writing any fetch() calls or WebSocket connections.

The fix is simple — one constant in config.js:
  const BASE_URL = window.PISTONCORE_BASE_URL || '';

Then all calls use:
  fetch(BASE_URL + '/api/pistons')
  new WebSocket(BASE_URL.replace('http', 'ws') + '/ws')

Docker dev: BASE_URL is empty string — zero change to current behavior.
Addon ingress: BASE_URL injected by backend at page serve time.

Make sure this is communicated before any new frontend code is written.

---

## Script Entity ID Format — Now Locked

DESIGN.md updated to explicitly state:
- Filename: pistoncore_{uuid}.yaml
- Script entity ID: script.pistoncore_{uuid}
- Automation alias: (only place slug is used — human readable label in HA UI)
- Slug collision handling for filenames: no longer needed (UUIDs are unique)
- Slug collision handling for alias: field: may still be needed — clarify in COMPILER_SPEC.md

The driveway lights example in COMPILER_SPEC.md uses old slug-based format.
Update that example when rewriting the spec.

---

## Test Devices — Promote to V1 (Compiler Testing Dependency)

Originally deferred to post-v1 but should be reconsidered as v1 scope because
it directly speeds up compiler testing. Without controllable test devices, every
compiler test cycle requires waiting for real devices to change state or manually
triggering things in HA. That slows every test iteration significantly.

PistonCore already has REST API access to create and control input helpers —
the implementation cost is low and the testing productivity gain is high.

### How It Works

HA input helpers are real entities that behave identically to physical devices
from an automation/trigger perspective. HA cannot tell the difference.

For richer fake devices, combine input helpers with template entities:
- input_boolean.test_motion_sensor → template binary_sensor with device_class: motion
- HA sees a real motion sensor, wizard discovers it with correct capabilities,
  real triggers fire when state changes

### PistonCore Implementation

Add a "Test Devices" screen in PistonCore settings:
1. User defines a test device — name, domain, device_class
2. PistonCore calls HA REST API to create the appropriate input helper
3. Test device appears in wizard device picker immediately like any real device
4. State control panel in PistonCore: toggle (binary), slider (numeric),
   dropdown (enum) — calls HA helper set service directly via REST API
5. No HA dashboard needed, no HA UI involved — PistonCore is the control panel

### Test Device Types to Support

| Simulates | Input Helper | device_class |
|---|---|---|
| Motion sensor | input_boolean | motion |
| Door/window contact | input_boolean | door / window |
| Light switch | input_boolean | — |
| Dimmer light | input_number (0-100) | — |
| Temperature sensor | input_number | temperature |
| Presence/occupancy | input_boolean | occupancy |
| Media player state | input_select (playing/paused/idle/off) | — |
| Lock | input_boolean | lock |

### Why V1 and Not Later

- Compiler cannot be properly tested without controllable triggers
- Real devices are unreliable as test fixtures — state changes happen on their own schedule
- Every compiler feature (triggers, conditions, loops, waits) needs a device
  whose state can be set precisely at test time
- PistonCore already has all the API access needed — this is low effort, high value
- Users will also benefit — this is the missing piece Jeremy was trying to solve
  with HA dashboards

---

## Docker Native Runtime Option for Docker HA Users

When updating COMPILER_SPEC.md, add as a planned future extensible output target.
Docker version should support opt-in native runtime as alternative to PyScript.
Most Docker HA users run both containers on same machine — localhost, zero latency.
Reduces dependency on PyScript staying maintained long term.
Config: runtime_mode: "pyscript" | "native" in Docker config.json.
Same runtime engine as addon v2 — Docker just reuses it.
Design the compiler output target routing to accommodate this from the start.
