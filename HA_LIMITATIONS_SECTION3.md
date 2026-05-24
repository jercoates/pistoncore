# HA_LIMITATIONS.md — Section 3 Replacement

Replace the existing Section 3 in HA_LIMITATIONS.md with the content below.
The old Section 3 referenced `device_map` and `has_missing_devices` — both eliminated in Session 55.
This replacement uses the entity_ids model from DESIGN.md Section 9.2 and COMPILER_SPEC.md v1.4.

---

## 3. Entity ID Changes — Renamed, Deleted, or Moved Entities

### The Problem

HA entity IDs can change without warning:
- User renames a device in HA UI (entity ID changes)
- Integration is removed or reinstalled (entity IDs disappear or change)
- User changes the entity ID manually in HA entity registry
- Device is physically removed

PistonCore stores entity IDs at wizard commit time. If an entity ID changes after a piston was saved,
the compiled output references the old (now-invalid) entity ID. The automation runs but does nothing
when it reaches that statement.

### Detection

PistonCore detects missing entities in two ways:

**1. On startup (DESIGN.md Section 9.1 Step 5):**
For every deployed piston, check every entity_id across all condition, action, and for_each nodes
against the current HA entity registry. If any entity_id is not in the registry:
- Mark the piston as `entity_missing: true` in `piston_index.json`
- Show ⚠ on the piston list row
- Show a warning banner on the status page identifying the specific missing entity
- Log to `entity_state_cache` that this entity_id was last seen at [timestamp]

**2. On background check (every 30 minutes, DESIGN.md Section 9.2):**
Re-run the same check. New missing entities detected between startup and the next check
are flagged and shown the same way.

**Missing means:** the entity_id is no longer present in the HA entity registry at all.
**Not missing (do not flag):** entity exists in the registry but is currently unavailable,
offline, has a dead battery, or is in an unknown state. Unavailable ≠ missing.

### What PistonCore Shows

Piston list row:
```
⚠ Front Door Alert
```
Tooltip: *"One or more devices used by this piston no longer exist in Home Assistant."*

Status page banner:
*"⚠ 'binary_sensor.front_door' (role: Front Door) no longer exists in Home Assistant. Edit this piston to reassign the device."*
`[✎ Edit]`

The entity's last known role label (`role` field from the node) is shown so the user
knows which device needs reassignment, even if the entity_id is unrecognizable.

### What PistonCore Does NOT Do

- **Does not auto-delete the compiled file.** The automation is still running in HA
  (referencing the now-gone entity, which HA handles gracefully — it just skips the entity).
- **Does not auto-reassign the entity.** The user must open the editor and update the device picker.
- **Does not detect renames.** If `binary_sensor.front_door` is renamed to `binary_sensor.front_door_v2`,
  PistonCore sees the old ID as missing and the new ID as a new entity — it cannot know they are
  the same physical device. The user must reassign.
- **Does not block the running automation.** The piston keeps running in HA. PistonCore's flag is
  informational only.

### The Fix

User opens the editor, finds the statement with the missing entity (highlighted with ⚠),
clicks to edit, and picks the replacement device from the live device picker.
On next deploy, the compiled output uses the new entity_id and the `entity_missing` flag is cleared.

### Compile-Time Enforcement

When the user clicks **[🚀 Deploy to HA]**, the compiler runs `resolve_entities()` (COMPILER_SPEC.md v1.4 Section 8).
Any entity_id that is not in the current HA entity registry causes a `MISSING_ENTITY` compile error,
blocking deploy until the piston is fixed. This is a hard gate — the old entity_id can never be
redeployed without the user explicitly choosing a replacement.

### entity_state_cache — Last Known State

PistonCore maintains an `entity_state_cache` table in `pistoncore.db` with the last known
friendly_name, state, and timestamp for every entity that has ever appeared in a deployed piston.
When an entity goes missing, this cache allows PistonCore to show the human-readable name
(*"Front Door"*) in the warning message instead of just the raw entity_id.

The cache is updated:
- On every HA connect (full refresh of all tracked entities)
- On `state_changed` WebSocket events for tracked entities
- When a piston is saved (new entity_ids are added to the tracked set)
