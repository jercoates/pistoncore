# GAP — Global editor cannot remove a missing/failed device (Session 73, found by Jeremy)

**Severity:** HIGH — structural. Makes a global uneditable when any of its devices goes
missing in HA. Current only escape is deleting and recreating the entire global.
**Status:** Logged for a future coding session. NOT yet fixed.
**Found:** Session 73, during HA-update fallout (an HA update broke a Sonos `media_player`
entity that a global referenced).

## What happened (observed)

A device referenced by a global went missing in HA (an HA update dropped the Sonos
`media_player` entity). In the global editor:
- The missing device **could not be deselected** — no way to click it off.
- **"Remove all" did not work** either.
- The only way to fix the global was to **delete it entirely and recreate it** from scratch.

## Why this matters (the underlying structural bug)

This is not a cosmetic picker glitch. It exposes a structural assumption in how the global
editor handles device removal: **removal/deselection appears to operate on a LIVE-resolved
match against current HA devices, not on the stored reference itself.**

When a referenced device is missing from HA (deleted, renamed, integration broke, entity
went unavailable), there is no live device to match against — so:
- the editor cannot render/identify the stored entry as a deselectable row, and
- the removal path has nothing to act on.

Result: a reference that no longer resolves becomes **un-removable**. Any failed, renamed,
or removed HA device permanently jams the global until the whole global is destroyed.

## The fix direction (for the coding session — verify against code first)

- Device **removal must operate on the stored reference (the value entry itself)**, not on
  a live-resolved match. The editor must be able to list, show, and remove an entry even
  when that entry resolves to nothing in current HA.
- A missing/unresolvable entry should render as a clearly-flagged removable row
  (e.g. "⚠ <stored value> — not found in HA") so the user can deselect/remove it directly.
- "Remove all" must clear ALL stored entries unconditionally — including unresolvable ones —
  not just the ones that currently resolve.
- This mirrors the editor's render invariant elsewhere (malformed/unresolvable data is
  shown as a flagged, repairable/removable item, never silently dropped and never made
  un-actionable).

## Related context (Session 73)

- Tonight's broader symptom — `@Speakers` / device pickers showing "No devices could be
  resolved" / "No devices available" — traced to the HA/Unraid updates changing what
  entities HA actually exposes (a Sonos `media_player` entity broke after an HA update),
  NOT to a PistonCore logic bug. Jeremy worked around it by switching `@Speakers` to a
  different (ReSpeaker) device. Redeploy (with `--no-cache`) did not restore the broken
  Sonos because the problem is HA-side, not the PistonCore build.
- Several existing globals still store **entity_ids** (or other non-friendly-name values)
  in their `value` field — pre-device-model-fix data (`@lights`, `@lock`, `@lumin_sensor`,
  `@test`). These were never migrated to the friendly-name model the resolver now expects.
  Separate cleanup item; flagged in earlier session notes. This removal bug is independent
  of that but compounds it (bad/stale values are also hard to remove).

## Verify-first note

This was found live during HA-update fallout at the end of a long session. The fix
direction above is the structural read, not yet confirmed against the global-editor code
(globals.js / wizard-variable.js / editor.js globals path). The coding session should READ
the actual deselect/remove logic in the global editor and confirm the live-match assumption
before implementing.
