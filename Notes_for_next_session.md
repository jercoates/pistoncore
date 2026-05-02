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

## Docker Native Runtime Option for Docker HA Users

When updating COMPILER_SPEC.md, add as a planned future extensible output target.
Docker version should support opt-in native runtime as alternative to PyScript.
Most Docker HA users run both containers on same machine — localhost, zero latency.
Reduces dependency on PyScript staying maintained long term.
Config: runtime_mode: "pyscript" | "native" in Docker config.json.
Same runtime engine as addon v2 — Docker just reuses it.
Design the compiler output target routing to accommodate this from the start.
