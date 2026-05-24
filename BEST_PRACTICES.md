# PistonCore — Best Practices

**Version:** 1.0
**Status:** Draft — patterns locked, prose to be expanded for v1 release
**Last Updated:** May 2026 (Session 60 — written from MISSING_SPECS Item 12)

These are patterns that experienced WebCoRE users know intuitively but
new users discover slowly and painfully. Documenting them saves hours.

---

## Pattern 1 — Globals for Cross-Piston Device Management

Use global device variables for any device or group that appears in more than one piston.

**Why:** When you add a new water sensor, update `@Water_Sensors_All` and redeploy — every
piston that references that global picks up the change automatically. Without globals, you
hunt through every piston individually and risk missing one.

**How:** Create a global in Settings → Global Variables. Give it a clear name like
`@Water_Sensors_All`. In any piston that should use that device group, reference the
global in the device picker instead of picking individual devices.

**Reference naming convention:** See DESIGN.md Section 7.1 for the standard global names
used by sample pistons (`@Battery_Devices`, `@Smoke_Detectors`, etc.).

---

## Pattern 2 — Define Block for Single-Piston Device References

Even for devices used in only one piston, define them in the define block at the top
using a device variable, then reference the role name throughout the logic.

**Why:** All device references stay in one place. When a device changes, update the
define block — not every condition and action that references it.

**How:** Add a variable to the define block with type Device. Name it something clear
like `motionSensor`. Use that role name in every condition and action that refers
to that device. The device picker is shown once, at define time.

---

## Pattern 3 — Role Names Beat Hardcoded Entity Lists

Conditions and actions should reference role names like `{Doors}` not hardcoded entity
lists buried deep in if/then logic.

**Why:** Readable, maintainable, and works correctly with the missing device handler.
When an entity goes missing, PistonCore can show "Front Door" instead of a raw entity ID
because the role name is stored alongside the entity_ids.

**How:** This happens automatically in PistonCore — the wizard always asks you to name
your device ("What do you want to call this device?") and stores that as the role label.
The key practice is choosing meaningful role names at wizard time rather than accepting
defaults.

---

## Where This Lives In-App

- Tooltip on the Global Variables section header in Settings
- Ghost text in the define block: *"Tip: use global variables for devices that appear in multiple pistons."*

## Where This Lives In Docs

- This file (BEST_PRACTICES.md) in the repo
- Onboarding section in README (to be written for v1 release)
