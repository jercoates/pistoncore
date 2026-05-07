# PistonCore — HA Limitations & Gotchas Reference

**Status:** Living document — add to this whenever a new HA limitation is discovered.
**Last Updated:** May 2026

This document captures Home Assistant limitations that affect PistonCore design and
implementation. It exists because the gap between Hubitat/WebCoRE and HA is significant
and keeps being rediscovered from different angles.

For decisions already made in response to these limitations, see DESIGN.md.
For compiler-specific handling, see COMPILER_SPEC.md.
For wizard-specific handling, see WIZARD_SPEC.md.

---

## 1. Runtime Execution Limitations

### Native Scripts Are Weak Compared to Hubitat

Hubitat/WebCoRE had a full scripting runtime. HA native scripts are declarative YAML
with significant restrictions:

| Feature | Hubitat/WebCoRE | HA Native Script | Handled by |
|---|---|---|---|
| break out of loop | Yes | No | PyScript only — target-boundary.json |
| on_event inside running script | Yes | No | PyScript only — target-boundary.json |
| cancel async tasks | Yes | No | PyScript only — target-boundary.json |
| Variable scoping across loops | Clean | Unreliable | Compiler warning emitted |
| Context tracking ($currentEventDevice) | Yes | No | PyScript only |
| Physical vs programmatic interaction | Yes | PyScript only | Wizard prompts conversion |

**Impact:** Many pistons that were "simple" on Hubitat will force PyScript on HA.
The target-boundary.json must be rock solid and the conversion prompts must be clear.

### Long-Running Pistons

HA scripts have implicit resource limits and timeouts that Hubitat did not have.
Very long waits or complex loops may behave unexpectedly.
**Status:** Not yet handled. Flag as known risk. Test with real long-running pistons
before v1 release.

---

## 2. State and History Limitations

### was/stays Timing Edge Cases

The `was` / `stays` distinction is critical and has real edge cases:

- `wait_for_trigger` at a specific time — if the piston reaches this step AFTER the
  target time has already passed today, it waits until tomorrow. Compiler always
  emits a warning for this. See WIZARD_SPEC.md was vs stays section.
- Negative sunrise/sunset offsets that cross midnight (e.g., "$sunrise - 2 hours"
  when sunrise is at 6am = 4am, but what if piston runs at 11pm?). **Test specifically.**
- `for:` duration on state triggers has edge cases with unknown/unavailable states.
  HA may not evaluate the duration correctly if the entity goes unavailable mid-wait.

### Numeric State Trigger Edge Cases

`above:` and `below:` on numeric_state triggers have nuanced behavior:
- Entity in unknown/unavailable state — trigger may not fire as expected
- Rapid state changes — trigger may miss transitions
- **Test with real sensors before shipping numeric trigger compilation.**

---

## 3. Device and Entity Limitations

### Entity ID Changes Break device_map

If a user renames a device in HA, the entity ID may change. This breaks the
device_map in any piston that references that device — the compiled YAML will
reference an entity that no longer exists.

**Current status:** `has_missing_devices` flag detects this on HA connect.
User sees ⚠️ and must remap via the define block. This is the intended flow
but must be clearly communicated to users — it will happen regularly.

### Multi-Device Aggregation Compilation

Device groups with Any/All/None aggregation must be compiled carefully.
HA does not have a native "any of these entities" trigger — PistonCore must
expand the device_map list and generate one trigger entry per entity.
For conditions, Jinja2 any()/all() template expressions handle this.
**Verify compiled output for multi-device triggers with real HA before shipping.**

### Entity vs Device Model

HA's entity model means one physical device can have 10-20 entities.
PistonCore groups at the device level in the picker (done in ha_client.py).
But capability data comes from entities. If a device has multiple entities
for the same capability, the wizard must pick the right one.
**Currently handled by domain caps map — verify with real multi-entity devices.**

---

## 4. Deployment and Reload Limitations

### HA Reload Is Not Instant and Can Fail Silently

After `automation.reload` / `script.reload`:
- HA sometimes takes several seconds to reload
- HA can fail silently — reload returns 200 but automation is broken
- If the YAML is invalid, the old version stays active (good) but HA may not
  return a clear error

**Current status:** Deploy flow catches reload failures and shows error to user.
Old version stays active. UX must clearly communicate when old version is still
running. Test failure scenarios explicitly.

### File Permissions in Addon

Writing to `/config/automations/pistoncore/` and `/config/pyscript/pistoncore/`
requires correct addon permissions in config.json (addon manifest).
Easy to get wrong during addon packaging.
**Must be tested end-to-end in real HA addon environment before release.**

---

## 5. Performance Limitations

### Flat JSON File Storage at Scale

Current storage is one JSON file per piston. With 100+ pistons:
- Piston list page load will be slow (reads all files)
- Background compile on every save will feel sluggish

**Current status:** Acceptable for v1. Add indexing/caching before public release
if user testing shows lag. A simple index file (id → name, status, last_run) would
fix the list page without a database.

### WebSocket Payload Size

Large pistons with many statements will produce large WebSocket payloads.
Not a concern for v1 scale but worth noting for future.

---

## 6. PyScript Specific Limitations

### PyScript Is a Community Project

PyScript for HA (the HACS integration, not the web framework) is well-maintained
but is not an official HA project. If it stops being maintained, Docker users
(for whom PyScript is permanent) would be impacted.

**Mitigation:** Docker native runtime option is planned (see DESIGN.md Section 3.1).
Route the compiler's output target logic to accommodate this from the start.

### PyScript Context Tracking Feasibility

Physical vs programmatic interaction detection (`context.id`, `context.parent_id`)
needs sandbox validation before the "Which Interaction" wizard step is built.
**Status:** Explicitly deferred. Do not build until validated.

---

## 7. User Experience Gotchas

### Live Fire Test Danger

Test button always executes real actions. No dry-run mode.
Users WILL accidentally trigger real devices during building — lights will flash,
locks will click, speakers will speak.
The confirmation dialog ("Live Fire ⚠ — this will execute real actions") is
mandatory and must be prominent. Consider a global "Test Mode" toggle for v2
that logs instead of fires.

### Automation Mode Behavior Differs From Hubitat

HA automation modes (single/restart/queued/parallel) map to WebCoRE concepts
but behave differently in edge cases. Users migrating from Hubitat may be surprised.
**Document the differences in user-facing help text for the mode picker.**

---

## 8. Things Already Correctly Handled

These limitations were discovered and designed around. Listed here so they are
not re-litigated:

- **No HA native break/on_event/cancel** → PyScript fallback via target-boundary.json ✅
- **Binary sensors always report on/off** → Friendly label system in wizard,
  compiled_value always "on"/"off" ✅
- **Device groups must be compile-time** → device_map baked at deploy ✅
- **Loop variable scoping** → Compiler warning emitted ✅
- **Entity IDs never shown to user** → Device picker + device_map abstraction ✅
- **HA churn on YAML syntax** → Versioned Jinja2 template system ✅
- **Minimum HA version** → 2023.1 floor documented and checked on connect ✅
- **`trigger:` vs `platform:` inside wait_for_trigger** → Compiler always uses
  `trigger:` key inside `wait_for_trigger` blocks. `platform:` is legacy syntax that
  causes silent reload errors in modern HA. ✅

---

## 9. Still Needs a Solution

These are known gaps without a defined solution yet:

- **State value quoting not enforced at compiler level** — `_compile_single_condition` passes `compiled_value` to templates without normalization. HA silently parses unquoted `on`/`off` as booleans, causing state checks to never match. Spec says handled — code does not enforce it. Fix required in S1-7. (Moved from Section 8 — was incorrectly listed as handled.)
- **`wait_for_trigger` timeout not emitted** — Compiler passes `stmt_id` and `at_time` to the wait_until template but does not emit `timeout:` or `continue_on_timeout:`. Pistons will hang forever if the time is missed. Spec says handled — code does not emit it. Fix required in S1-7. (Moved from Section 8 — was incorrectly listed as handled.)
- **Parallel branch `continue_on_error` not emitted at sequence level** — Compiler emits `continue_on_error` per-action only. One offline device kills the whole parallel block. COMPILER_SPEC Section 10.2 explicitly requires it at the branch sequence level. Fix required in S1-7. (Moved from Section 8 — was incorrectly listed as handled.)
- Entity ID changes breaking device_map — detection exists, migration UX needs work
- Long-running piston timeouts — not yet handled
- Global variable helper race conditions on simultaneous deploy — not yet handled
- Sunrise/sunset negative offset edge cases — needs explicit testing
- Numeric trigger unknown state behavior — needs explicit testing
- HA reload failure UX — partial, needs more robustness

### ⚠️ Validation Required — Missing Single-Device Entity Behavior

**Must test before implementing the single-device hard flag in Section 15.6 of DESIGN.md.**

Unknown: what does HA actually do when an automation references a missing entity?

Questions to answer with real testing:
1. Does HA error on reload and disable the automation, or does it load the automation and error only at runtime?
2. Does HA behave differently for a missing trigger entity vs a missing condition entity vs a missing action target entity?
3. Does the behavior differ between native YAML automations and PyScript files?
4. Is the error surfaced clearly enough to catch in PistonCore's reload error handler, or does it fail silently?

**How to test:** Create a simple test automation in HA that references a known entity. Remove the entity (or rename it so it no longer exists). Reload automations. Observe what HA does — check the HA log, check whether the automation is marked as disabled, check what error (if any) is returned by the reload call.

Results go here and inform the implementation of the hard flag logic in PistonCore. Do not implement the single-device missing deploy block until this is validated.

---

*Add to this document whenever a new HA limitation is discovered — from AI review,
community feedback, or real testing. This saves re-research time.*
