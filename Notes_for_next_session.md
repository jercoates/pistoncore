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

## Import Flow — Two Paths, Define Block Is Primary Interface

Confirmed from WebCoRE import sequence screenshots (screens.docx — save this file):

### Two Valid Import Paths

**Simple path** — for pistons with few devices:
- Automatic "Rebuild piston items" screen shows after import
- One row per unknown device role, each with a device picker dropdown
- User maps all roles at once then saves
- Good for simple pistons with 2-3 device variables

**Complex path** — for pistons with many device groups:
- Close/skip the automatic rebuild screen
- Open piston in editor
- Click each device variable in the define block individually
- "Edit variable" modal opens for just that variable with full device picker
- User maps one group at a time with full context visible
- Better for complex pistons where the automatic list loses context

Both paths must be supported. Neither is optional.

### Define Block Is the Primary Device Management Interface

The define block is not read-only. Every device variable in it is clickable.
Clicking a device variable opens the Edit Variable modal:
- Type picker (Device, String, Number, etc.)
- Variable name field
- Initial value picker — "Physical device(s)" dropdown with full device picker

This is how import mapping works AND how ongoing editing works. Same flow, same modal.
No separate "device management" screen needed — the define block IS the device manager.

### Device Picker Three-Section Model (confirmed from WebCoRE image 8)

When the device picker opens from Edit Variable, it shows three sections:
1. **Physical devices** — real HA devices, searchable, filtered by type-to-search
2. **Local variables** — device-type variables defined in this piston
3. **Global variables** — device-type globals (@Door_Contacts_Exterior, etc.)

Checkmarks show currently selected devices. SelectAll / DeselectAll buttons.
Search filters all three sections simultaneously.

This confirms the device picker separation design — device-type variables 
appear IN the device picker alongside physical devices, not in the variable picker.

### How device_map Gets Populated

When user picks devices in Edit Variable modal:
1. PistonCore updates the piston_text — device variable now shows selected friendly names
2. PistonCore updates device_map — role name → entity IDs mapping
3. Both happen simultaneously on Save in the modal

This answers the open question from COMPILER_SPEC.md planning:
"How does device_map get populated?" — through the define block edit flow.

### WebCoRE Internal ID vs PistonCore Role Names

WebCoRE stores device references as {:xxxxxxxxxxxxxxx:} internal IDs in piston text.
PistonCore uses role names like {Doors} instead — cleaner and more portable.
The import mapping step writes role names into piston_text, not internal IDs.
This is a deliberate improvement over WebCoRE's approach.

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

## UX Improvements — From External Reviews (Grok + Perplexity)

These are not new features — they are polish on existing planned features.
All fit within v1 scope without expanding what the product does.

### One-Click PyScript Promotion

When the wizard detects a complex pattern (break, cancel_pending_tasks, on_event),
don't just show a warning banner. Offer a one-click convert button inline:

  "This piston now requires PyScript."  [Convert — one click]

The convert action:
- Updates compile_target in the piston JSON to "pyscript"
- Updates the complexity indicator in the editor
- No other changes — piston logic is identical

This is a UX improvement on the existing PyScript detection flow, not a new feature.
The detection already exists — make acting on it frictionless.

### Quick Start Wizard — First Piston Experience

New users opening PistonCore for the first time should see a clear entry point.
Suggested: "New Piston → Quick Start" option that walks through a simple motion
light in 4 steps using the existing wizard:

1. Pick a motion sensor (trigger — changes to detected)
2. Pick a light (action — turn on)
3. Add a wait (5 minutes)
4. Turn the light off

Result: a working piston built in under 2 minutes using the real wizard.
This is not a separate tutorial — it is the real wizard with guided prompts.
Implement after the wizard is solid, not before.

### Example Pistons — Ship With the App

A small set of pre-built example pistons importable from the main menu.
Low effort, high value for new users learning the format.

Suggested examples (5-6 max):
- Motion activated light with timeout
- Sunset/sunrise outdoor lights
- Low battery notification across multiple devices
- Door left open alert after X minutes
- Morning routine (time-based, multiple actions)
- Presence-based thermostat adjustment

These ship as JSON files in the container at:
  pistoncore/examples/
    motion-light.json
    sunset-lights.json
    low-battery-alert.json
    door-open-alert.json
    morning-routine.json

Accessible from main menu: [Import] → "Browse Examples"
Uses the existing import flow — no new infrastructure needed.
Examples use roles only — no entity IDs — so they work for any user on import.

---

## Trace Mode — Revisit After Compiler Stabilizes

Previously assumed full WebCoRE-style trace wasn't possible in HA.
External review clarified it's closer than thought. Worth proper investment
after compiler is solid — this was one of WebCoRE's biggest selling points.

What's realistically achievable in v1:
- HA native script trace UI already captures action execution, timings,
  condition results — this is free, no extra work needed
- Custom events (PISTONCORE_LOG with statement IDs) add per-statement visibility
- variables: action can track state at key points
- PISTONCORE_RUN_COMPLETE already in the design
- Combining these gets close to WebCoRE-style trace without PyScript

Action: After compiler stabilizes, dedicate focused time to making Trace
excellent. Not a moonshot — just deliberate implementation of what's already
partially designed. This will be a major selling point.

---

## Example Pistons — Target 10-20 Canonical Examples

### Sources (three tiers)

**Tier 1 — Jeremy's own WebCoRE pistons (highest quality, real-world tested)**
Jeremy has a large library of pistons currently running in WebCoRE.
Workflow to convert them:
1. Take a screenshot of a WebCoRE piston backup/editor view
2. Paste screenshot into Claude with write-a-piston.md prompt
3. Claude generates piston JSON
4. Import into PistonCore and test
5. Fix any format issues found — each one improves the prompt and the importer

This workflow simultaneously:
- Tests the write-a-piston.md prompt against real complexity
- Tests the import flow
- Tests the compiler against real automation logic
- Produces a real example piston for the library
- Validates the role-based device mapping on import

**Tier 2 — WebCoRE community library**
Hundreds of community pistons exist. Same screenshot → JSON → import workflow.
Stress-tests the format against real-world variety.
Good source: WebCoRE community forum, SmartThings/Hubitat migration threads.

**Tier 3 — Canonical examples written fresh**
Simple, clean, well-commented examples covering common use cases:
- Motion activated light with timeout
- Sunset/sunrise outdoor lights
- Low battery notification across device group
- Door left open alert
- Morning routine (time-based sequence)
- Presence-based thermostat
- Vacation mode (random lights)
- Smoke detector alert with notification

### Storage
pistoncore/examples/
  motion-light.piston
  sunset-lights.piston
  low-battery-alert.piston
  ... etc

All use roles only — no entity IDs. Work for any user on import.

### Double Duty as Compiler Test Cases
Each example piston is also a golden master compiler test.
The full test suite basically writes itself once examples exist.
10-20 examples covers most compiler code paths with real-world logic.

---

## Docker Native Runtime Option for Docker HA Users

When updating COMPILER_SPEC.md, add as a planned future extensible output target.
Docker version should support opt-in native runtime as alternative to PyScript.
Most Docker HA users run both containers on same machine — localhost, zero latency.
Reduces dependency on PyScript staying maintained long term.
Config: runtime_mode: "pyscript" | "native" in Docker config.json.
Same runtime engine as addon v2 — Docker just reuses it.
Design the compiler output target routing to accommodate this from the start.
