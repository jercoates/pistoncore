# PistonCore — Compiler Decisions Holding Doc

**Version:** 1.0 (NEW — Session 73 consolidation)
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

## E. Retirement

When D-S6 runs (compiler spec rewrite, after the v1 JSON locks): extract Sections A–C
verbatim-faithful from SPEAK_ACTION_SPEC.md and NOTIFY_ACTION_SPEC.md into COMPILER_SPEC.md /
PYSCRIPT_COMPILER_SPEC.md, resolve the Section D open items against the backend code, then
delete this holding doc. Until then, this file is the single place those compiler decisions
are collected outside the (frozen) compiler specs.
