# NOTIFY — MERGE INTO EDITOR_WIZARD_SPEC §10 (resolution). NOT a standalone section.

**This is a merge instruction, not a new spec.** Notify is resolution behavior. It weaves
into the EXISTING §10 (the device-selection / two-bucket / variable-resolution section). Do
NOT create a separate "Notify" section. Fold each item below into the named existing
sub-section so notify reads as part of how resolution already works.

Storage: a notify target commits as a standard §20 TASK — `command:"notify"`,
`domain:"notify"`, `ha_service` = the chosen service, `parameters` = message/title. There is
NO `kind` and NO `target_ref` (both dead — removed). Point to PISTON_JSON_STRUCTURE_MAP.md §20;
do not restate the shape.

---

## Merge into §10.1 (Device Selection Root) — add notify as a picker section

The picker root already lists physical devices and device variables. Add: the picker also
contains a **Notify section** — its own flat section INSIDE the same picker menu (found where
devices are found), but structurally separate: a flat render/select path, NOT routed through
`_groupDevices`, NO capability intersection, NO fabricated `device_id`. [VERIFIED from
NOTIFY_ACTION_SPEC §1.3 — flat enumeration is less code and structurally correct]

- Populated flat from the notify service registry (backend-forwarded), one row per `notify.*`
  service. Rows display de-slugified (`mobile_app_jeremy_s_s25` → "Jeremy's S25"); store the
  full service id. [VERIFIED from NOTIFY_ACTION_SPEC §1.2 — live-HA confirmed]
- A notify target has NO sub-entities and NO capability bits — its only verb is "send a
  notification." It is not a device and must never be pushed through device-picker machinery.
  [VERIFIED from NOTIFY_ACTION_SPEC §1.2]

## Merge into §10.4 (Device Variable Resolution) — the dual-bucket rule

This is the load-bearing resolution behavior, and it is the reason notify is NOT standalone.
Variables store friendly names (§2 load-bearing rule). On resolution, the wizard looks up
each friendly name in BOTH buckets:
- the **device registry** (entities, the existing §10.4 path), and
- the **notify service registry** (the §10.1 notify section source).

Rule [DECISION: user — dual-bucket parallel resolution]:
- If **ALL** friendly names in the variable resolve in **BOTH** buckets, both types resolve
  **in parallel** and the **combined options are displayed**. Resolution to the specific
  target (device entity vs notify service) happens **on selection**, not at import.
- If only some names are notify-capable (not all), notify is **not** offered for that
  variable; device resolution proceeds normally.
- The variable still stores friendly names — the dual-bucket lookup is resolution-time
  behavior, not a change to storage.

Practical note (user): to make notify come up from a variable, build the variable from
notify-capable devices only — then all names resolve in both buckets and notify is offered.

OPEN — DO NOT INVENT [ASSUMED: not designed; defer until encountered in real use]:
mixed / split-resolution variables (some names notify-capable and some not, or wanting partial
per-name resolution to different target types). The all-or-nothing rule above is what is
settled. The split case has not been exercised in real use and must NOT be designed now —
settle it when it is actually hit.

## Merge near §10.1 / two-place split — the phone appears twice, intentionally

Fold in where the notify section is introduced: the same physical phone legitimately appears
in TWO picker places, and this must NOT be merged away [VERIFIED from NOTIFY_ACTION_SPEC §1.4]:
- the **notify service** (`notify.mobile_app_*`) — flat, in the Notify section, does only
  "send a notification";
- the phone's **sensor entities** (`sensor.*_battery_level`, `binary_sensor.*_is_charging`,
  etc.) — real entities WITH a `device_id`, in the normal device picker, unaffected.

This mirrors WebCoRE's split between device-for-status and notification-destination. It is
correct and intentional, NOT duplication to design away. Cross-referencing the notify target
to its sibling sensors ("notify this phone AND show its battery as one unit") is explicitly
v1 OUT OF SCOPE. [VERIFIED from NOTIFY_ACTION_SPEC §6]

## Action fields after target pick (fold into the task/action field flow)

After a notify target is selected, the wizard collects: **message** and optional **title**.
The rich companion-app `data` payload (actionable buttons, image, tag, priority) attaches to
the action fields AFTER the target is picked and is staged incrementally — NOT v1-required.
[VERIFIED from NOTIFY_ACTION_SPEC §4.3; staged per §1 decisions]

---

## Tagging on merge
Carry the tags as shown. The dual-bucket parallel rule is `[DECISION: user]`. The split case
stays `[ASSUMED: deferred — do not invent]`. The live-HA / NOTIFY_ACTION_SPEC facts are
`[VERIFIED]`. No `kind`, no `target_ref` anywhere.
