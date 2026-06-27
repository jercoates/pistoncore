# EDIT_DEVICE_RECONCILIATION_SPEC.md — Offline Devices and Device Persistence on Edit

**Version:** 1.0 (June 2026)
**Status:** Authoritative for how the editor reconciles a stored piston's devices against live HA
when an EXISTING piston is opened for editing. This behavior was previously unspecced and is the
source of a known deselect bug (offline device present in data but with no removable row). Applies
to both nodes and device variables/defines.

**Scope guard — EDIT ONLY.** None of this applies to creating a NEW piston. A new piston's picker
is populated purely from live HA, so an offline/missing device cannot appear (it is not in live
data to pick). Persistence, the `!` flag, and re-import are edit-only concerns. They exist only
because editing an existing piston reconciles STORED devices against CURRENT live HA.

**Storage decision this spec assumes (locked):** entity IDs stay in the piston JSON. The node/slot
stores the resolved `entity_id`. This is what makes offline re-import free — the device's identity
is already in the file being edited; nothing is reconstructed, no YAML/PyScript grep.
`[DECISION: IDs retained in JSON — offline re-import needs stored identity; grep-from-compiled-output
rejected as fragile (reverse-matching, editor–artifact coupling, missing-on-first-edit).]`

**Tag convention:** `[VERIFIED: source]`, `[ASSUMED: basis — risk]`, `[DECISION: rationale]`. A
`[VERIFIED]` citing current PistonCore `.js` is a contamination error.

---

## 1. The three device states on edit-load

When an existing piston is opened for editing, every device in a node or variable/define slot is in
exactly one of three states:

| state | what it means | how it renders |
|---|---|---|
| **Live** | stored device resolves against current live HA | normal interactive row, clean friendly-name label, no flag |
| **Offline** | stored in the piston but NOT in current live HA (sensor dead, battery out, Zigbee dropout, integration down) | interactive row materialized from stored data, flagged `!`, fully deselectable |
| **Removed** | not in the stored piston at all | does not appear; only addable as a live device via the picker |

The displayed selected list on edit = **live-resolved devices + re-imported offline devices**. Both
produce real, interactive, deselectable rows. Removed devices are simply absent.

---

## 2. Offline device re-import — the core rule

`[DECISION: offline persistence + materialized removable row]`

On edit-load, a stored device that does NOT resolve against live HA is **re-imported into the
selected list as a real interactive row**, built entirely from data already in the JSON:

- **Identity + label:** see §4 — source depends on whether the device was stored as a friendly name
  (variable/define slot) or as an entity_id (direct-on-node). Either way, the row materializes from
  what was stored. No live HA lookup is required or attempted.
- **State:** selected (checked), because it is in the stored piston.
- **Flag:** `!` marker, indicating "present but not currently resolvable against live HA."
- **Interactivity:** fully deselectable — identical affordances to a live row. This is the fix for
  the known bug (§5).

> **Render the offline row from the JSON alone. Never depend on live HA to label or identify it.**
> The whole point is that an offline device has no live data — so everything the row needs must come
> from what was stored.

This is per-device. If several devices sit on one node, each offline device gets its own
materialized `!` row — not a single group placeholder.

---

## 3. The two non-crossing rules

These two rules never interact. Getting them confused is what produced earlier wrong models
(blacklists, held slots, auto-heal). There is NO blacklist and NO saved/held slot.

**Rule A — Offline never removes.** A device being offline does NOT drop it from the piston. It
persists across edits indefinitely while offline: each edit re-imports it as a selected `!` row.
The only thing that removes a device is the user (Rule B). Failed resolution, absence from live HA,
and offline status do not prune.

**Rule B — Removal never auto-returns.** When the user deselects a device and saves, it is removed
from the stored piston — a real, permanent removal of that entry. There is no blacklist recording
"keep it out"; it is simply absent, exactly like a device never added. A removed device does NOT
drift back in when it comes back online. Online status is not what holds membership — presence in
the stored piston is, and removal took it out.

**Consequence — how a removed device returns:** the user must (a) wait until the device is online so
the picker offers it as a live device, then (b) manually re-add it in the editor. Online-but-not-
re-added stays out. Re-adding requires the device to be live (it comes through the normal live
picker, gets a fresh stored `entity_id`). A removed device that is still offline cannot be re-added,
because the picker only offers live devices.

So: removal requires a user action; return requires a user action AND the device being live. The
two triggers never cross — offline ≠ removed, removed ≠ blacklisted.

---

## 4. Variables / define slots vs. direct-on-node

Per the load-bearing rule (CLAUDE.md §0.1), variables and defines store **friendly names only —
never entity IDs**. Nodes store entity IDs. This means the two slot types materialize their offline
rows from different stored data:

- **Define / variable slots:** the stored value is the **friendly name** (user-assigned). An offline
  variable row materializes from that name alone — which is actually the more readable offline label,
  because the name was chosen by the user. No entity_id is stored in the variable and none is needed
  to render a deselectable, identifiable offline row.
- **Direct-on-node picks:** the row materializes from the stored **entity_id** (§2). No separately
  stored friendly name is required — the id + `!` flag is sufficient to render the row. If the id is
  human-readable (device name + function pattern) the user reads it directly; if opaque
  (hex/integration-generated), the bare id plus the `!` flag is itself the signal that this device
  needs attention.

Both honor Rules A and B identically.
`[ASSUMED: most entity_ids in this deployment are device-name-plus-function and thus human-readable —
basis: user's own HA naming; risk: opaque hex ids render a less-friendly label, mitigated by the !
flag carrying the offline meaning regardless of label quality.]`

---

## 5. The known bug this fixes

`[DECISION: root-cause of prior deselect failure]`

Earlier code built the picker's selected list from live devices only. A stored device that was
offline at edit time therefore got NO row — it existed in the JSON but had no rendered, interactive
element. With no row there was no checkbox, so the user could not deselect it: the device was stuck
in the data, invisible and unremovable.

The fix is §2: offline stored devices are **materialized as real interactive rows from their stored
data**, flagged `!`, with full deselect affordance. The row's existence — not just its flag — is the
fix. An offline device must always produce a removable row, or it becomes unremovable again.

**Implementation invariant:** the selected-list builder MUST iterate the STORED device set (not the
live set) and produce a row for every stored device, marking each live-or-offline and flagging the
offline ones. Building from the live set alone reintroduces the bug.

---

## 6. Relationship to the picker capability-compare change

Independent of this spec, the device picker computes its capability MENU by capability-compare
(translate HA capability signals → WebCoRE capability keys → intersect), not by entity-derived
comparison. That change is about how the menu of attributes/operators is built for SELECTED devices.
It does not change storage (IDs stay) and does not change this reconciliation behavior. The two are
orthogonal: capability-compare builds the menu; this spec governs which device rows exist and persist
on edit.
`[DECISION: picker menu uses capability-compare; storage and edit-reconciliation unchanged by it.]`

---

## 7. Notify

Notify has no device/entity to resolve, so it does not route through device reconciliation at all.
It is handled as a local special case, not via this spec. Listed here only so a reader does not
expect notify to follow the three-state model — it does not.

---

## 8. Edit-only restatement (do not lose this)

Everything above is EDIT-only. New-piston creation never reconciles against stored data — its picker
is live-only, so offline/missing/removed states cannot arise. If a future change makes new-piston
creation able to carry pre-stored devices, this spec's scope must be revisited; until then, treat
all of §1–§5 as triggered exclusively by opening an existing piston for editing.
