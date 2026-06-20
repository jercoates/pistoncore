# PistonCore — Compiler Decisions Holding Doc

**Version:** 1.2 (June 2026 — added Section G: unverified per-statement compile-output sketches, salvaged from retired PISTON_FORMAT_MERGED.md so they are not lost. v1.1 added Section E: PyScript routing, verified vs PyScript 2.0.1 + HA 2026.6)
**Status:** Holding doc. Captures compiler-relevant decisions that currently live ONLY in
the standalone action specs (SPEAK_ACTION_SPEC.md, NOTIFY_ACTION_SPEC.md) so they survive
into the compiler rewrite (D-S6). When D-S6 happens, fold these into COMPILER_SPEC.md /
PYSCRIPT_COMPILER_SPEC.md and retire this file.
**Authority:** The two action specs are authoritative for their own action types. This doc
is a faithful POINTER + extraction, not a replacement — if anything here disagrees with
SPEAK_ACTION_SPEC.md or NOTIFY_ACTION_SPEC.md, those win. Extract verbatim-faithful from
them at D-S6, not from this summary.

---

## Why this file exists

COMPILER_SPEC.md and PYSCRIPT_COMPILER_SPEC.md are intentionally FROZEN/STALE until the v1
JSON locks (TASKS.md D-S6). But the Speak and Notify specs — written this session — contain
compiler decisions that the frozen specs don't reflect. If those action specs get
consolidated/retired before D-S6 captures them, the decisions vanish. This file holds them
in the meantime.

The governing rule for everything below (Jeremy, Session 73): **what the user sees in the
editor is the contract; the JSON's only jobs are to repopulate the editor exactly as saved
and to feed the compiler what it needs to make HA behave the way the WebCoRE logic did. How
it's stored and compiled is the coding session's call.** So the decisions worth preserving
are the *behavioral* ones (what HA must end up doing) and the *policy* ones (read-only
compiler, debug-page errors, Jinja2-everywhere). Field names are NOT preserved as contracts
— they reconcile against PISTON_FORMAT.md at coding time.

---

## A. Cross-cutting compiler policy (applies to BOTH Speak and Notify, likely all actions)

1. **Compiler is read-only.** It reads the JSON and NEVER writes, reshapes, or mutates it.
   The editor/wizard authors the JSON; it is the source of truth; the compiler is
   input-only. (This is the rule whose violation has bitten the project before.)
2. **Errors go to the debug page, never to mutation.** On any incompatibility (device can't
   speak, no TTS engine, notify target unresolvable, kind unrecognized), the compiler does
   NOT edit the JSON and does NOT silently drop the task — it writes a clear, specific
   debug-page error naming the offending device/engine/target and why. Source stays
   untouched regardless of compile outcome.
3. **All HA YAML values go through Jinja2.** Standing project rule, no exceptions.
4. **One canonical variable→Jinja substitution function.** The variable-token → Jinja
   substitution MUST reuse the single canonical substitution function used elsewhere in the
   compiler. Do NOT introduce a second variable-substitution path for Speak or Notify.
5. **Compile-time live-HA lookups inform the OUTPUT only, never the source JSON.** The
   compiler may pull live HA at compile time (engine selection, device compatibility,
   target resolution) to make its hidden translation correct, but those lookups only shape
   what it emits.

---

## B. SPEAK / TTS — behavioral decisions the compiler must honor

Authoritative source: SPEAK_ACTION_SPEC.md. Pulled here: the decisions, not the field names.

### B1. Volume is a SEPARATE sibling step, not an inline Speak parameter (LOAD-BEARING, behavioral)

In the editor and in execution, Set Volume is its own task ordered *before* the Speak task
inside the same with-block — exactly as WebCoRE shows it (`Set Volume to 70;` then
`Speak text "{Message}";`). Volume is NOT a field on the Speak task.

**Why this is load-bearing and not cosmetic:** Jeremy's actual Sonos type does not honor an
inline Speak volume the way Hubitat did. Emitting volume as a real `media_player.volume_set`
step is what makes the volume actually change on his hardware. The compiler emits, in order,
per with-block containing a speak task:
1. `media_player.volume_set` (if a Set Volume task is present) against the block's resolved
   output entities — **with the 0–100 (WebCoRE/UI scale) → 0.0–1.0 (HA) conversion done HERE,
   in the compiler, never in the stored JSON** (see also GAP-S72-3).
2. `tts.speak`.

This ordering (volume THEN speak) is preserved on the PyScript target too.

### B2. Engine resolved at COMPILE time from a global; never stored on the node

No TTS engine appears in the piston (matches WebCoRE — `Speak text` carries no engine). The
engine is environment config, resolved at compile time from a global "default TTS engine"
setting (a `tts.*` entity discovered from HA states). The node is engine-agnostic.

`tts.speak` has two distinct fields the compiler must not conflate:
- `target.entity_id` = the engine (a `tts.*` entity, from the global).
- `data.media_player_entity_id` = the output device(s) (the with-block's resolved entities).
The engine is never a media_player; the media_player is never the target.

### B3. `cache: true` emitted by default

The compiler emits `data.cache: true` on `tts.speak` by default. This is the HA-side
equivalent of the offline clip caching Jeremy relies on under Hubitat — HA synthesizes the
audio once and persists it, so a local engine (Piper) doesn't re-synthesize every fire and
announcements have no live cloud dependency. Whether `cache` later becomes a user toggle is
a UI decision; default-on is the contract.

### B4. SSML — passthrough, never opted-in or stripped

The message is passed verbatim. The compiler does NOT inject `options.text_type: ssml` and
does NOT strip SSML. SSML rendering is entirely a property of the resolved engine (Piper has
no SSML support at all; SSML-capable engines need an explicit opt-in that lives in global
engine config, not the node). Rate/cadence (the original `<prosody rate>` intent) is an
engine concern (Piper `length_scale` at the voice/Wyoming level), never a node concern. This
keeps Speak engine-agnostic and fully local-capable.

### B5. Feasibility confirmed (Session 73)

Message-from-live-data → native HA Script `variables:` block with Jinja2 interpolation,
spoken by Piper, cached, played on Sonos — zero cloud dependency, no PyScript required for
the variable mechanic. Recorded so it isn't re-litigated.

### B6. Backend plumbing Speak needs (carried from SPEAK spec §6)

Already in the single `get_states` call; just not currently carried through:
- `attributes.supported_features` (PLAY_MEDIA / 512 bit) is read in `ha_client.py`
  `_fetch_devices` (~line 375) but DROPPED at the device-dict build (~line 384). Carry it
  through `_fetch_devices` and `_groupDevices` (wizard-core.js ~220) for the author-time gate.
- `tts.*` entities are in the same result but filtered by `ALLOWED_DOMAINS` (~line 372).
  Enumerate `tts.` entities to feed the global default-engine setting.

---

## C. NOTIFY / PUSH — behavioral + structural decisions the compiler must honor

Authoritative source: NOTIFY_ACTION_SPEC.md. Pulled here: the decisions, not the field names.

### C1. The node stores a STABLE TARGET REFERENCE, never a hard-coded HA service string (LOAD-BEARING)

This is the entire churn-insurance policy and it's a compiler concern. HA notify is
mid-transition (legacy per-target `notify.mobile_app_*` services today; `notify.send_message`
with entity targets emerging in 2026.5+ but not yet covering rich companion-app payloads).
So the stored piston must NOT contain a resolved HA service call. It stores a stable target
reference; the compiler resolves that reference to whatever HA currently wants **via a Jinja2
template selected by the target's kind**. When HA flips the legacy path off or a target
moves to the entity path, ONLY the template changes — stored pistons, the picker, and the
JSON shape are untouched.

The compiler emits, by target kind:
- legacy mobile_app target → a `notify.<id>` service call with `message`/`title`/`data`.
- entity target (emerging) → `notify.send_message` with the target as `target.entity_id`.

v1 targets the legacy `mobile_app_*` path (what Jeremy runs); the entity-target branch is
specified as a seam but is not primary until HA's entity path covers rich payloads.

> The discriminator that tells the template which path to emit is REQUIRED behaviorally
> (the compiler must know legacy-service vs entity target). How it's stored (a `kind` field
> or otherwise) is a coding-time storage choice, NOT a decision for Jeremy and NOT a fixed
> spec contract — reconcile against PISTON_FORMAT.md. The fixed requirement is only that the
> stored target reference is stable and resolves through a template, never a baked service
> string.

### C2. Notify targets come from the SERVICE REGISTRY — a SECOND HA fetch (structural)

Notify targets are NOT entities and are NOT in `get_states`. They live in the service
registry. This forces new backend plumbing: a second HA fetch via `/api/services` (REST) or
`get_services` (websocket), take the `notify` domain, enumerate its services, surface them
to a dedicated flat notify picker section (NOT through `_groupDevices`). This parallels how
Speak needed `supported_features` carried and `tts.*` enumerated, but the source is a
different endpoint. (This is a wizard/backend concern more than a compiler one, but it's
recorded here because it's the same "new HA data source" class and easy to lose.)

### C3. message/title interpolation; `data` holds the rich payload

`message` and `title` are token-interpolated strings (literal + variable tokens) using the
same canonical substitution path as Speak. The companion-app richness (actionable buttons,
image, tag/group, priority, TTS-to-phone) lives in the action's `data` payload, attached to
the target's capabilities — NOT on the picker target. v1 may ship message+title plus a core
`data` subset and stage the rest; the contract is only *where* they live and *that* they use
the canonical interpolation path. The per-target-type `data` mapping is a coding-time job
against the live Companion App docs.

---

## D. OPEN — not decided, do not treat as settled at D-S6

- **NOTIFY target_ref vs task-parameters placement.** WITH_BLOCK_TASK_FRAMEWORK.md §4 leans
  toward putting the target in task parameters with empty entity_ids, but this was NOT
  finalized. It is an open decision for the compiler/notify coding work — flag it, don't
  bake it. (Context doc §6.)
- **`target-boundary.json` existence is UNVERIFIED.** The old specs reference it as the file
  that forces PyScript for break/on_event/cancel_pending_tasks. Whether it exists in the
  backend or the boundary is hardcoded was NOT confirmed from the frontend code. D-S6 / the
  routing work MUST check the backend and either extend it or create it. Do not assume it
  exists. (WITH_BLOCK_TASK_FRAMEWORK.md §4; context doc §6.)
- **Command classification is a PENDING research deliverable.** The full WebCoRE command
  menu (device / emulated / location — see WITH_BLOCK_TASK_FRAMEWORK.md §5.4) must be sorted
  by the **reproduce-cleanly test** against CURRENT HA: can HA cleanly reproduce the action
  (native / PyScript / via an add-on or integration that exposes usable, relevant state)? If
  yes → it STAYS in the wizard. If there's no clean way to reproduce the RESULT → it is CUT
  from the wizard and recorded on the living "can't reproduce in HA currently" docs list (a
  lossy rename to a rough HA equivalent does NOT count as reproducing it). HA moves monthly,
  so version-sensitive commands must be researched live, not classified from memory — and
  **what is hard-impossible is NOT predetermined.** **The non-device command set WAS
  researched in Session 73 — authoritative dated results are in HA_LIMITATIONS.md §10 (vs HA
  2026.6).** Key correction to earlier assumptions: HSM (Set Hubitat Safety Monitor status),
  web request, and file read/write are REPRODUCIBLE and STAY (HSM → HA built-in
  `alarm_control_panel`; web request → `rest_command`; file → File integration). The genuine
  cuts are Hubitat/WebCoRE-platform artifacts (piston tiles, piston engine state) — the ONLY
  two. Research is COMPLETE: capture/restore (→ scene.create), IFTTT-as-webhook
  (→ rest_command), set location mode (→ input_select), and LIFX effects (native lifx.*
  actions) all reproducible. Read §10 rather than this summary. (Scope reduction,
  Session 73: the earlier "render everything, fail only at compile" model is dropped.)

---

## E. PYSCRIPT ROUTING — Verified decisions for the compiler (June 2026)

These decisions were researched against PyScript 2.0.1 and HA 2026.6 and are now locked.
They belong in COMPILER_SPEC.md / PYSCRIPT_COMPILER_SPEC.md at D-S6. Until then, this is
the authoritative holding location. Sources: PyScript official docs (hacs-pyscript.readthedocs.io),
HA script-syntax docs 2026.6.3, WebCoRE wizard source (piston.module.html + piston.js,
pulled June 2026).

### E1. Routing goes through a backend template — never hardcoded, never in the frontend (LOAD-BEARING)

HA gains native capability over time. The routing mechanism must be a data-driven template
that the backend reads — not a hardcoded list, and NOT in the frontend. When HA adds native
support for a feature that currently forces PyScript, ONLY the routing table file changes.
Stored pistons, the wizard, the JSON schema, and the frontend are all untouched.

**Backend owns the routing decision.** The flow on every save:
1. Frontend sends piston JSON to backend via `POST /api/piston/{id}/save`
2. Backend reads the piston JSON and scans it against the routing table file
3. Backend sets `compile_target` (`"native_script"` or `"pyscript"`) on the piston wrapper
4. Backend writes the piston to disk with `compile_target` set
5. Backend returns the saved piston (with `compile_target` now populated) to the frontend
6. Frontend reads `compile_target` off the wrapper — if `"pyscript"`, shows the notice on the debug/compile screen

The frontend NEVER determines what forces PyScript. It only reads `compile_target` and
displays accordingly. This means the routing can be updated (a feature goes native in HA,
or a new PyScript feature is discovered) by editing the routing table file and redeploying —
no frontend change, no spec change, no coding session required for the routing logic itself.

**The routing table file** (`routing_table.json`) lives in the backend. It maps JSON field
signatures to required compile targets. The backend reads it at startup (or on each save
request if hot-reload is desired). Format: to be determined at D-S6 — must be simple enough
that Jeremy can read and update it without a coding session.

**`compile_target` is a backend-set cache, not a user preference.** It is never shown in
the editor as an editable field. It is shown read-only in the Quick Facts panel on the
status page and as a label in the Test Compile panel header.

**The help system (`pyscript.md`)** is the user-facing companion to the routing table.
When a user sees the PyScript notice on the debug screen, the `[Learn more →]` link opens
the help file that explains what PyScript is, why their piston needs it, and how to install
it. This file is also backend-served markdown — editable without a coding session.
See FRONTEND_SPEC.md Help System section for the full spec.

### E2. Full verified PyScript routing table (as of June 2026)

The following JSON fields/values force `compile_target: "pyscript"`. Verified against
PyScript 2.0.1 docs and HA 2026.6 native script syntax docs.

| JSON field / value | PyScript mechanism | Native HA status |
|---|---|---|
| `type: "on_event"` | `task.wait_until()` | No equivalent |
| `type: "break"` | Python `break` | Native `stop` only ends current block — not a loop break |
| `type: "cancel_pending_tasks"` | `task.unique()` | No equivalent |
| `condition_operator: "xor"` on any statement | Python expression `sum([...]) == 1` | No native XOR |
| `operator: "followed_by"` on condition group | Chained `task.wait_until()` with shared deadline | No sequential event chaining |
| `case_traversal_policy: "fallthrough"` on switch | Python `if/elif` without early exit | `choose` always exits first match |
| `interval_unit: "n"` or `"y"` on every | `@time_trigger("cron(...)")` | `time_pattern` has no dom/month fields |
| Non-empty `only_on_dom` on every | cron `dom` field | `time_pattern` has no dom field |
| Non-empty `only_on_months` on every | cron `mon` field | `time_pattern` has no month field |
| Non-empty `only_on_wom` on every | Runtime check in function body | No cron equivalent |

### E3. User notification requirement (BEHAVIORAL — must not be dropped)

When any piston compiles to PyScript, the compiler must surface a prominent notice on
the debug/compile screen: "This piston uses features that require PyScript. It will be
deployed as a PyScript file, not a native HA automation. PyScript must be installed via
HACS." This is not optional — users who haven't installed PyScript will have silently
non-functional pistons. The notice must be at the top of the debug output, not inline.

### E4. `on_event` timeout fields (BEHAVIORAL)

`on_event` JSON schema now carries `timeout_seconds` (integer or null) and
`continue_on_timeout` (boolean, default false). The compiler must:
- If `timeout_seconds` is null → emit `task.wait_until(...)` with no timeout and emit
  `CompilerWarning: ON_EVENT_BLOCKING` (existing requirement, unchanged).
- If `timeout_seconds` is set → emit `task.wait_until(..., timeout=N)` and respect
  `continue_on_timeout` to either continue or stop after timeout.

### E5. `exit` value — open decision

`exit` `value` field: native HA `stop:` drops it silently. PyScript can write the value
to a piston-state helper entity before stopping. **Decision required at D-S6:** implement
the PyScript path or emit `CompilerWarning: EXIT_VALUE_DROPPED` for both targets and
document it. Do not silently drop without at least the warning.

### E6. `every` `only_on_wom` — runtime check pattern

`only_on_wom` (weeks of month) has no direct cron equivalent. The PyScript compiler must
emit a cron that fires on the correct days of the month (via `dom`), then add an early-
exit `if` check inside the function body to guard against wrong weeks. The exact Python
expression for "Nth week of month" must be confirmed at D-S6 against real HA behavior.

---

## G. Per-statement compile-output SKETCHES — UNVERIFIED examples

**Status of this section:** LOWER confidence than A–E. These are illustrative YAML output
sketches pulled verbatim from the retired PISTON_FORMAT_MERGED.md when it was decomposed
(this session). They are NOT verified against a working compiler (the compiler is frozen
until D-S6). Several contain placeholders like `[compiled statements]`. They show the
*intended shape* of native HA output per statement type — a starting reference for the D-S6
compiler work, not a decision and not a contract. At D-S6, validate each against actual HA
behavior; do not lift verbatim. Field names reconcile against the Structure Map at coding time.

Source: PISTON_FORMAT_MERGED.md `### Compiler Output` blocks (now retired). PyScript-routed
types (on_event, break, cancel_pending_tasks, switch fallthrough) — see Section E for the
verified routing; the sketches below show only the native-target shape where one exists.

### action

```yaml
- alias: "stmt_001"
  action: light.turn_on
  target:
    entity_id:
      - light.living_room
  data:
    brightness_pct: 75
  continue_on_error: true
```

---

### do

```yaml
- alias: "stmt_002"
  sequence:
    [compiled statements]
```

---

### if

```yaml
- alias: "stmt_003"
  if:
    - condition: template
      value_template: "[compiled condition]"
  then:
    [compiled then statements]
  else:
    [compiled else statements]
```

---

### switch

**`case_traversal_policy: "safe"` (native HA):**
```yaml
- alias: "stmt_004"
  choose:
    - conditions:
        - condition: template
          value_template: "{{ states('input_number.pistoncore_count') | int == 1 }}"
      sequence:
        [compiled case statements]
  default:
    [compiled default statements]
```

**`case_traversal_policy: "fallthrough"` (PyScript only):** Forces `compile_target: "pyscript"`. Native HA `choose` always exits after the first matching branch — fall-through is impossible. PyScript emits real Python `if/elif` blocks without early exit between branches. Compiler emits `PYSCRIPT_REQUIRED`.

---

### for

```yaml
- alias: "stmt_005"
  repeat:
    count: 10
    sequence:
      [compiled statements]
```

**Note:** Emits CompilerWarning if start != 1 or step != 1.

---

### for_each

```yaml
- alias: "stmt_006"
  repeat:
    for_each:
      - sensor.smoke_detector_basement
      - sensor.smoke_detector_kitchen
    sequence:
      [compiled statements — actions use target.entity_id: "{{ repeat.item }}"]
```

---

### while

```yaml
- alias: "stmt_007"
  repeat:
    while:
      - condition: template
        value_template: "[compiled condition]"
    sequence:
      [compiled statements]
```

---

### repeat

```yaml
- alias: "stmt_008"
  repeat:
    sequence:
      [compiled statements]
    until:
      - condition: template
        value_template: "[compiled until condition]"
```

---

### every

Compiles as a trigger in the automation wrapper, not as a statement in the script body.

**Native HA (`compile_target: "native_script"`):**

`ms`, `s`, `m`, `h` intervals with no `only_on_dom`, `only_on_wom`, or `only_on_months` filters:
```yaml
- trigger: time_pattern
  minutes: "/5"
```

**PyScript forced when:** `interval_unit` is `"n"` or `"y"`, OR any of `only_on_dom`, `only_on_wom`, `only_on_months` is non-empty. Reason: native HA `time_pattern` has no day-of-month, week-of-month, or month fields.

**PyScript output:** `@time_trigger("cron(min hr dom mon dow)")` using Linux crontab syntax. Restriction arrays map to comma-separated cron fields. `only_on_wom` has no direct cron equivalent and requires a runtime check inside the function body.

**Routing rule:** If `interval_unit` is `"n"` or `"y"`, or `only_on_dom`/`only_on_wom`/`only_on_months` is non-empty → compiler emits `PYSCRIPT_REQUIRED` and routes to PyScript. All other cases compile natively.

---

### on_event

PyScript only. Forces PyScript compilation via target-boundary.json.
Native HA script compilation raises CompilerError with code `PYSCRIPT_REQUIRED`.

---

### break
_(merged spec also had editor-render notes here — not compiler content)_

Editor: `break;`
Compiler: PyScript only. Native HA raises CompilerError.

---

### exit

**Native HA:** The `value` field is dropped — HA `stop:` has no piston-state concept.
```yaml
- alias: "stmt_012"
  stop: "exit"
```

**PyScript:** The `value` field can be written to a piston-state helper entity before stopping. **Design decision required at D-S6** — whether to implement this or emit `CompilerWarning: EXIT_VALUE_DROPPED` and drop it silently for both targets.

---

### set_variable

Piston variable:
```yaml
- alias: "stmt_013"
  variables:
    message: "Hello"
```

Global variable:
```yaml
- alias: "stmt_013"
  action: input_text.set_value
  target:
    entity_id: input_text.pistoncore_message
  data:
    value: "Hello"
```

---

### wait_duration
_(merged spec also had editor-render notes here — not compiler content)_

Editor: `do Wait 5 minutes;`

```yaml
- alias: "stmt_014"
  delay:
    minutes: 5
```

---

### wait_until
_(merged spec also had editor-render notes here — not compiler content)_

Editor: `do Wait until 11:00 PM;`

```yaml
- alias: "stmt_015"
  wait_for_trigger:
    - trigger: time
      at: "23:00:00"
  timeout:
    minutes: 60
  continue_on_timeout: true
```

Always emits CompilerWarning. `timeout` defaults to 1 hour.

---

### wait_for_state

```yaml
- alias: "stmt_015b"
  wait_template: "[compiled condition template]"
  timeout:
    seconds: 300
  continue_on_timeout: true
```

---

### log_message

```yaml
- alias: "stmt_016"
  event: PISTONCORE_LOG
  event_data:
    piston_id: "a3f8c2d1"
    message: "Piston ran successfully"
    level: "info"
```

---

### call_piston

```yaml
- alias: "stmt_017"
  action: script.pistoncore_b7e2a1f4
```

If `wait_for_completion: true` with native script target → CompilerError.

---

---

## F. Retirement

When D-S6 runs (compiler spec rewrite, after the v1 JSON locks): extract Sections A–E
verbatim-faithful from SPEAK_ACTION_SPEC.md, NOTIFY_ACTION_SPEC.md, and this file into
COMPILER_SPEC.md / PYSCRIPT_COMPILER_SPEC.md, resolve the Section D open items against
the backend code, then delete this holding doc. Until then, this file is the single place
those compiler decisions are collected outside the (frozen) compiler specs.

**Section G (compile-output sketches)** is reference only — at D-S6, validate each sketch against real HA output and the Structure Map; do not carry any sketch forward unverified. It is the lowest-confidence content in this file.
