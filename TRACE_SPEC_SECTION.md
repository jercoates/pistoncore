# Trace — Debug Screen Spec Section

*Draft for the PistonCore debug screen. Defines what the trace can and cannot do on
native HA YAML, the live-tracking mechanism, condition coloring, the condition-met →
effect "execution receipt" with context attribution, the PyScript upgrade path, and the
required bottom-of-screen disclaimer.*

> **Goal: match the *effect* of the WebCoRE trace as closely as native HA YAML allows.**
> It is not a true clone — WebCoRE's hub engine *was* the executor and reported the
> evaluated result and timing of every node during execution, including conditions that
> came back false. PistonCore on native HA YAML has no access to engine-internal
> evaluation. So PistonCore reconstructs the trace from the *outside* — live-tracking
> device state while the debug screen is open, and using HA's context chain to attribute
> effects back to this piston. The result lands closer to WebCoRE than the raw
> constraint suggests, because context turns "we saw a change" into "this piston caused
> this change."

---

## Mechanism: live-tracking while the debug screen is open

PistonCore does **not** read the engine's evaluation (native YAML can't expose it).
Instead, while the debug screen for a piston is open:

1. PistonCore subscribes to changes for **only that piston's entities** — the bounded
   list named by its own nodes. Prefer the WebSocket **`subscribe_entities`** command
   with an explicit `entity_ids` list (returns a keyed entity map and compact diffs)
   over a raw `subscribe_events` / `state_changed` firehose. This avoids system-wide
   noise and scales better with the piston's device count.
2. Each change delivers `old_state` → `new_state`, **and the event's `context`.**
3. PistonCore evaluates each condition node against that live state — reading the node's
   intent (entity, operator, operand) from the **stable PistonCore JSON**, never the
   compiled output — and colors the line red (false) or green/blue (true).

Intent from the stable side; state from the live stream; result is PistonCore's own
evaluation. The compiler is never consulted for coloring, so colors can't drift when the
compiled form shifts (native vs PyScript vs HA version). Tracking is **live-only** — it
sees changes while the screen is open; it is not a recording of a past run.

---

## Condition coloring — what colors reliably and what doesn't

**State conditions** — `is`, `is not`, `is less than`, `is between`, etc. Compare against
what the entity state *is*. Evaluable from current state at any time, so they color
reliably whenever the screen is open.

**Transition conditions** — `changes to`, `changes away from`. True only at the *instant*
of a transition. Colorable only when PistonCore **witnesses the change live** while the
screen is open; a transition before the screen opened has no event to replay.

> Unsupported / un-evaluable operators color **neutral** (no red/green), never guessed.

---

## Execution receipt — condition-met → effect-landed, with context attribution

**Purpose (serves two jobs):**
1. **Proof an action fired when you can't see or hear it** — `set variable`, a
   notification with no visible target, a virtual switch, a scene in another room.
2. **Proof *this piston* caused it** — not another automation, not a manual switch
   press, not a coincidence that happened to land in the same minute.

Correlation by timing alone cannot prove causation. If conditions go green and a light
turns on a minute later, state-change tracking alone cannot tell whether this piston did
it, a different automation did it, or someone hit the switch. A receipt that claims
credit for a coincidence is a *false* receipt — worse than none. **Context attribution
closes this.**

**How it works:**
- **Capture run context:** when PistonCore fires the piston, it captures the run's HA
  `context.id` (from the `script_started` / `call_service` the run produces).
- **Start mark:** the instant PistonCore's own evaluation flips the last blocking
  condition of a branch to true ("all conditions met").
- **Stop mark:** the first effect event whose `context` traces to **this run's
  context.id** (directly or via `parent_id`) — *not* merely the first change on the
  target entity.
- **Correlation window:** the effect must land within a bounded window of the start mark.
  Context narrows *who caused it*; the window narrows *when* — both guards together
  reject a stale or coincidental same-context match. **Default 5–15 seconds**
  (sized for typical device latency); **make it configurable in settings.**
- **Receipt:** the delta is shown as a measured wall-clock duration.

**Three receipt states (the honest core):**
- **Verified** — effect landed, context traces to this run, within window → proof the
  piston caused it.
- **None** — conditions met, no matching effect within window → the action did not fire,
  or fired and did nothing. The diagnostic tell.
- **Unverified** — an effect was seen but its context could not be tied to this run →
  reads as *"changed, but we can't confirm we caused it."* **Never** silently shown as
  success.

**Context reliability caveats (why Unverified is a real, expected state):**
- Some actions — certain integrations, or device-driven changes — can arrive with
  `parent_id: null` or weak/absent context propagation.
- Highly parallel or async branches can muddy `parent_id` in edge cases.
- In any such case PistonCore falls back to **Unverified** with clear UI labeling rather
  than guessing causation. This is expected behavior, not a bug.

**Honest labeling (required):**
The duration is **end-to-end wall-clock**, not piston execution time — it includes HA
latency, network, and device response. Label it as such (e.g. *"condition met → device
responded: 340ms"*); never present it as "how long the piston took." A slow bulb must not
read as a slow piston.

**Effect / receipt-source differs by action type (defined item):**
- Visible device action (turn on/off, set level) → target entity's `state_changed`,
  context-matched.
- Invisible variable set → the variable's own state update, context-matched.
- Notify / speak with no visible target → the `call_service` event for that action,
  context-matched.
Every action type needs a defined, context-matchable proof signal — see the companion
**Receipt Sources Reference** table (to be added). (Open item below.)

---

## PyScript upgrade path

On a **PyScript** target, PistonCore controls the runtime, so the native-YAML ceiling
lifts:
- **Full per-node timing** — the runtime can record offset + duration for every node,
  including false conditions (true WebCoRE `trace.points` parity).
- **Custom per-node events** — the runtime can emit condition pass/fail directly, instead
  of inferring it from live state.
- **Historical replay** — feasible *if PistonCore stores each run* (PyScript gives the
  control to record it; the storage is a feature to build, not free). With it, a
  completed run can be replayed even after it settled — the one thing live-tracking on
  native YAML can never do.

This is the selling point for complex pistons: native YAML gets the practical
reconstruction; PyScript gets the full trace.

---

## What is permanently gone on native YAML

- **Per-node execution timing** (WebCoRE's `+12ms 2ms` per line). Engine-internal;
  live-tracking has no access and must not fake it. (Available on PyScript — above.)
- **Replay of a run that already settled.** Live-tracking only sees changes while the
  screen is open. If the piston ran and settled before the screen opened, the screen
  shows the *current* truth of every state condition (enough to see what's currently
  blocking) but not the *history* of that completed run. (Feasible on PyScript with run
  storage — above.)

---

## Required UI element: bottom-of-screen disclaimer

A persistent notice at the bottom of the debug screen. **Stable wording — deliberately
states only the permanent architectural fact, with no implementation detail (no PyScript
mention, no "where possible"), so it never goes stale as the feature evolves:**

> *PistonCore's trace is not a complete clone of WebCoRE's. WebCoRE's hub engine reported
> the evaluated result and timing of every node during execution. PistonCore on native HA
> YAML has no access to engine-internal evaluation.*

**User-facing fuller description** (for docs / help / hover — *not* the evergreen
on-screen line, since it names implementation that may change):

> *PistonCore's trace is a practical reconstruction, not a full WebCoRE clone. WebCoRE's
> engine reported every node evaluation and timing. PistonCore on native HA YAML uses
> live state changes + context attribution for reliable proof of causation where
> possible. Full per-node detail and replay are available on PyScript pistons.*

The screen needs only the evergreen one-liner; the warmer, forward-looking version lives
where it can be updated.

---

## Open items to confirm at the testbench *(priority order)*

1. **Receipt-source map per action type** *(high value)* — the context-matchable proof
   signal for every action type; build the companion **Receipt Sources Reference** table.
2. **Aggregation evaluation** (`Any/All/None of {group}`) logic; v1 = Any/All/None only
   of WebCoRE's 12 options.
3. **`subscribe_entities` performance with large entity lists** — confirm it stays
   responsive for the biggest real pistons.
4. **Context capture + match reliability on native YAML** — confirm capture of the run's
   `context.id` at fire time and matchable context on downstream events; catalog which
   action types fall back to **Unverified**.
5. **Correlation window default** — confirm 5–15s default and the settings control.
6. **Operator coverage for the evaluator** (`is`, `is not`, `<`, `between`, `changes to`,
   `changes away from`, `any/all/none of`); unsupported → neutral.
7. **Start-mark attribution** — tie "last blocking condition met" to the correct branch
   when multiple branches share entities.
