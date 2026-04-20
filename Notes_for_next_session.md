past these into prompt to get past cashed page problem
https://raw.githubusercontent.com/jercoates/pistoncore/main/DESIGN.md
https://raw.githubusercontent.com/jercoates/pistoncore/main/FRONTEND_SPEC.md
https://raw.githubusercontent.com/jercoates/pistoncore/main/WIZARD_SPEC.md
https://raw.githubusercontent.com/jercoates/pistoncore/main/WIZARD_SPEC.md
https://raw.githubusercontent.com/jercoates/pistoncore/main/CLAUDE_SESSION_PROMPT.md
Notes for Session 7
Generated end of Session 6 — April 2026
Architecture discussion and HA script capability research
Read this BEFORE starting Session 7 work
---
CRITICAL CONTEXT — WHY THE DESIGN IS CHANGING
Not knowing that native HA scripts existed caused a cascade of bad design decisions
throughout v0.7 and v0.8. Now that the capability is understood, the design simplifies
significantly. Do not treat DESIGN.md v0.8 as settled on compile targets, globals
storage, or setup complexity — those sections are being reconsidered in Session 7.
The cascade of decisions that were wrong:
PyScript as primary compile target → external dependency, breaking changes, maintenance burden
The 10-condition (then 3-rule) auto-detection list → was describing "things PyScript
handles that YAML can't" — native HA scripts handle all of them natively
globals.json with task.executor sandbox validation → entire problem disappears with
helper-backed globals
Full Mode / PyScript Only setup complexity → driven by YAML needing configuration.yaml
changes — native scripts do not need that
Simple YAML as a separate compile target → redundant, native scripts are a strict superset
Nearly everything that made the design feel complicated traces back to this gap.
The corrected design is simpler, more reliable, and has fewer external dependencies.
---
THREE QUESTIONS ANSWERED — END OF SESSION 6
Question 1 — Is there an internal HA validation mechanism for HA scripts?
Yes. Two layers:
Layer 1 — hass --script check_config:
The same tool that validates YAML automations also validates scripts — they are all
part of the same config load. Already designed into the PistonCore validation pipeline.
Layer 2 — HA load-time validation:
When PistonCore deploys a compiled script and calls script.reload, HA validates the
script on load via its internal config validation layer
(homeassistant/components/script/config.py). This validates action types, condition
syntax, and Jinja2 templates. If the script is malformed, HA rejects it with a real
error message at reload time.
This is actually cleaner than the current check_config approach for scripts:
Scoped to just the new file, not the entire HA config
Returns a real structured error
No separate validation step needed beyond yamllint for syntax
Conclusion: Native HA script validation is at least as good as YAML validation and
in some ways better. No new validation infrastructure needed.
---
Question 2 — What are the right thresholds for what PistonCore outputs?
Two compile targets only. The boundary is very short:
Native HA Script (default — covers ~95% of real pistons):
Handles everything the old YAML compiler handled PLUS:
Local variables with proper scope across branches and loops
All loop types: counted, for_each, while, until
Wait for trigger or template with timeout
wait.completed / wait.remaining / wait.trigger result variables
Parallel execution
Continue on error per action
Fire custom events
Full Jinja2 templating throughout
Force PyScript only when the piston uses:
break (interrupt a loop mid-iteration) — no native equivalent
cancel all pending tasks — no native equivalent
on event inside a running script — no native equivalent
Direct Python logic genuinely not expressible in Jinja2
That is a very short list. In practice almost no real-world piston forces PyScript.
PyScript becomes a true power-user edge case, not the default.
---
Question 3 — Drop YAML, just do native HA scripts and PyScript?
Yes. Confirmed correct decision.
Simple YAML automations are a strict subset of native HA scripts. Anything a YAML
automation can do, a native HA script + automation pair can do — and more. There is
no reason to maintain a separate YAML compiler when the script compiler handles
everything YAML does plus the complex cases.
Native HA scripts do NOT require configuration.yaml changes. No !include_dir_merge_list.
No Full Mode setup complexity. No double confirmation screens. Setup is dramatically
simpler — just write the files to the right directory and call script.reload.
The two compile targets going forward:
Native HA Script — default, ~95% of pistons, zero external dependencies, fully
native HA, survives PistonCore uninstall permanently
PyScript — opt-in fallback, rare extreme logic only, clearly labeled as external
dependency, user explicitly acknowledges the dependency before using it
---
---
ARCHITECTURE DISCUSSION — COMPILE TARGET RECONSIDERATION
The Core Question
Should PistonCore target PyScript, native HA YAML/Scripts, or both?
This was discussed seriously at the end of Session 6. The decision is NOT final —
it needs to be resolved at the start of Session 7 before COMPILER_SPEC.md is written,
because the answer changes what the compiler produces.
---
The PyScript Problem
PyScript is NOT native to Home Assistant. It is a third-party custom integration.
Implications:
It can break on HA updates — the PyScript maintainers must keep up
Users must install and maintain it as a separate dependency
PistonCore cannot bundle PyScript and maintain it — that would require deep HA
internals knowledge and is not a viable path for this project
The "automations run forever without PistonCore" promise is conditional on PyScript
remaining installed for complex pistons
This is a real long-term maintenance and user trust risk.
---
The Native HA Script Engine — What It Can Actually Do (Researched Session 6)
As of HA 2026.3, the native script engine supports:
Variables:
Local variables within a script run via `variables:` action
Variables are scoped — inner blocks can read and update outer variables
Variables can be templated with Jinja2
Works inside if/then branches and loops — variable changes persist to outer scope
Loops:
`repeat: count:` — counted loop (value can be a template)
`repeat: for_each:` — iterates over a list (list can be a template)
`repeat: while:` — condition-based loop
`repeat: until:` — repeat until condition is met (at bottom of block)
Loops are fully nestable
`repeat.item` available inside for_each loops
`repeat.index` and `repeat.first` / `repeat.last` available
Waits:
`delay:` — fixed time wait (supports templates, multiple formats)
`wait_template:` — wait until a Jinja2 template evaluates true
`wait_for_trigger:` — wait for any trigger type (same as automation triggers)
Both waits support `timeout:` with `continue_on_timeout: true/false`
After a wait, `wait.completed`, `wait.remaining`, `wait.trigger` variables are set
Branching:
`if: / then: / else:` — full if/then/else
`choose:` — switch/case equivalent
Conditions use full HA condition syntax (state, numeric_state, template, time, etc.)
Flow control:
`condition:` action — stops current sequence if false (acts as early exit)
`stop:` — stops the script entirely with optional error
`continue_on_error: true` — per-action error handling
`parallel:` — run multiple action sequences simultaneously
Other:
Fire custom HA events (`event:`)
Call any HA service/action
Activate scenes
Respond to conversation (voice)
All actions support `alias:` labels
What this covers from PistonCore's statement types:
If Block ✅
With/Do block ✅ (just a service call)
Wait (fixed duration) ✅
Wait for state with timeout ✅ (wait_for_trigger or wait_template + timeout)
Set variable ✅
Repeat loop ✅
For Each loop ✅
While loop ✅
Log message ✅ (fire a custom event or use logbook action)
Call another piston ✅ (script.turn_on)
Stop ✅
Only When restrictions ✅ (condition action)
What is NOT in native HA scripts:
Break (interrupt a loop mid-iteration) ❌ — no native break statement
Cancel all pending tasks ❌ — no equivalent
On Event (execute only when certain events happen inside a running script) ❌
Switch statement ❌ — choose: is the closest but has different semantics
Persistent variables between piston runs ❌ — requires helpers or global variables
The variable persistence gap:
Local variables in HA scripts are truly local — they exist only during one script run.
To persist state between runs you need:
Input helpers (input_boolean, input_number, input_text, input_datetime, input_select)
Or template sensors
Or attributes on persistent entities
This is the same gap that currently forces PyScript. But with the helper strategy
discussed below, this gap can be bridged for most real-world pistons.
---
The Global Variables / Helper Strategy (Discussed Session 6)
Proposed architecture:
Global variables in PistonCore UI → compiled to HA helpers on deploy
Specifically:
Device / Devices type globals → resolved to entity references at compile time (no helper)
Text globals → input_text helper
Number (integer) globals → input_number helper
Number (decimal) globals → input_number helper
Yes/No globals → input_boolean helper
Date and Time globals → input_datetime helper
Date globals → input_datetime helper (date only)
Time globals → input_datetime helper (time only)
The user never sees or manages helpers directly. PistonCore creates, updates, and
deletes them via the companion when the user manages globals in PistonCore's UI.
Companion global variable management:
On global create → companion creates the corresponding HA helper
On global rename → companion updates the helper label (entity ID stays stable)
On global delete → companion deletes the helper (with confirmation warning)
Companion maintains a manifest of every helper it created
Boot-time integrity check:
On companion startup → scan all PistonCore-managed helpers
Compare current helper config and values against the companion manifest
If mismatch detected → prompt user:
"The following PistonCore-managed helpers appear to have been modified outside
of PistonCore. Would you like to restore them to their expected values?"
[Show diff] [Restore] [Keep manual changes]
Non-blocking — if dismissed or HA unreachable, PistonCore continues with current state
Helper locking:
Investigate whether HA supports locking/protecting helpers from GUI editing
If supported, PistonCore-managed helpers should be locked to create friction
before manual editing rather than detecting it after
What this solves:
Globals become native HA helpers — zero external dependencies
Compiled pistons read helpers directly via HA service calls / templates
Helpers survive PistonCore uninstall with their current values intact
No globals.json file needed in HA config directory
No PyScript file I/O, no task.executor sandbox validation problem
---
Proposed Two-Tier Compile Target
Tier 1 — Native HA Script (primary, covers ~85-90% of real pistons):
Compiles to a native HA script + automation. No external dependencies. Truly permanent.
Handles: variables (local + helper-backed globals), loops, waits, if/then/else,
wait for state with timeout, call another piston, log, stop.
Tier 2 — PyScript (fallback for extreme logic only):
For pistons that require: break, cancel all pending tasks, on event inside a running
script, or other features genuinely not expressible in native HA.
Accepted dependency for power users who need it.
Clearly labeled in UI — user knows they are choosing a dependency.
Why this is better than the current two-tier design (YAML/PyScript):
Tier 1 is MORE capable than simple YAML — covers variables, loops, waits
Tier 1 is fully native — no dependencies whatsoever
The YAML-only tier (simple set-and-forget) is a subset of Tier 1 and compiles
naturally without any special handling
PyScript tier is reserved for genuinely extreme logic, not just "uses variables"
Long-term bet: HA team continues improving the native script engine, closing the
remaining gap, eventually making PyScript tier unnecessary
---
What Changes in the Design If This Architecture Is Adopted
Section 3.1 auto-detection rules — rewrite completely. New boundary:
Tier 1 (native HA script): almost everything
Tier 2 (PyScript): only when break, cancel_pending_tasks, on_event, or
other genuinely non-native features are used
Section 4.1 global variables — replace globals.json approach with helper approach.
Companion manages helpers. No runtime file I/O. No PyScript dependency for globals.
Section 17.3/17.5 companion — add helper management capabilities.
Add boot-time integrity check. Add helper manifest storage.
Section 17.5 setup mode — PyScript Only vs Full Mode distinction becomes
Native Script mode (default) vs PyScript mode (opt-in for power users).
Much simpler setup story. No configuration.yaml changes needed for Tier 1.
COMPILER_SPEC.md — design the Tier 1 (native HA script) compiler first.
PyScript compiler design is secondary.
UI labels — "Simple/Complex" or "Native/PyScript" instead of "YAML/PyScript"
---
Decision Needed at Start of Session 7
Before writing COMPILER_SPEC.md, confirm:
Adopt the two-tier native HA Script / PyScript architecture? (replaces current YAML/PyScript)
Adopt the companion-managed helper strategy for global variables?
Update DESIGN.md to v0.9 before writing COMPILER_SPEC.md, or write COMPILER_SPEC.md
against the proposed architecture and update DESIGN.md after?
Recommendation: confirm the architecture decision first (quick discussion), then write
COMPILER_SPEC.md against the confirmed architecture, then update DESIGN.md to v0.9.
---
What Does NOT Change
These decisions are unaffected by the compile target change:
Frontend, wizard, editor behavior — identical regardless of compile target
JSON piston format — unchanged
Snapshot/Backup sharing — unchanged
Validation pipeline — stages 1-3 unchanged, stage 4 adapts to new targets
File signature system — unchanged
Docker volume structure — unchanged
The "PistonCore never touches files it did not create" rule — unchanged
---
HA SCRIPT CAPABILITY — GAPS TO RESEARCH IN SESSION 7
These require a deeper look before the compiler can be designed:
Can HA scripts fire a custom event on completion? — needed for run status reporting
back to PistonCore. PyScript uses hass.bus.fire. Native scripts use event: action.
Confirm exact syntax and that it works reliably.
What is the entity_id format for a PistonCore-compiled script?
Scripts are entities. If PistonCore compiles a piston to a script, what is the
entity_id? How does an automation call it? How does PistonCore manage it?
Script + Automation pairing — a native HA script is not self-triggering.
It needs an automation to trigger it. PistonCore would compile each piston to
two files: an automation (triggers + conditions) and a script (action body).
Confirm this is the right pattern. Confirm HA reloads both cleanly.
Can for_each iterate over a Devices helper value?
If a global Devices variable is stored as an input_select or a list in some
helper format, can a native HA script iterate over it with for_each?
This is the key test for whether Devices globals work in Tier 1.
Are there any HA version floor requirements?
Some features (variables scope, wait_for_trigger inside repeat, etc.) were added
in specific HA versions. What is the minimum HA version PistonCore requires?
Document this clearly in the README.
---
SESSION 7 AGENDA — REVISED
Read DESIGN.md v0.8, FRONTEND_SPEC.md v0.2, WIZARD_SPEC.md v0.2, this notes file
Confirm architecture decision: Native HA Script / PyScript two-tier
Research the five HA script gaps listed above
Write COMPILER_SPEC.md for the confirmed architecture
Update DESIGN.md to v0.9 if architecture changes are significant
Write AI-UPDATE-GUIDE.md files once COMPILER_SPEC.md is complete
Update CLAUDE_SESSION_PROMPT.md
Do not write production code until COMPILER_SPEC.md is complete.
Do not poll other AIs until updated specs are published.
---
Session 6 complete — April 2026

treat this section as things to go over with me to compare to current design and ways to clarify explinations.
Absolutely — here are the key insights I think are most useful to feed into Claude.

Core position
PistonCore should treat the piston JSON as the source of truth and Home Assistant scripts/automations as compiled deployment artifacts that can be regenerated whenever Home Assistant changes syntax or structure.

That means HA churn is not a migration problem for the user; it is a recompilation problem for the compiler, which is exactly the right boundary for long-term maintenance.

Why native-first
Home Assistant scripts are native reusable action sequences, and Home Assistant creates an entity for each script so it can be called from automations or other scripts.

Because the native script engine already supports variables, branching, repeats, waits, and nested sequences, it should be the default target for most pistons, with PyScript reserved for truly non-native edge cases.

Why not PyScript-first
PyScript is a custom integration, not native Home Assistant, and its installation docs explicitly describe it as a HACS/custom component path rather than a built-in capability.

So a PyScript-first compiler makes your platform dependent on an external integration for normal operation, which increases maintenance risk and weakens the “runs forever without PistonCore” promise.

The reusable-script insight
The reusable part is not abstract or theoretical: in Home Assistant, a script is its own callable entity, and inputs can be passed into it so one script can be reused by many automations with different values.

For PistonCore, that means the natural native shape is automation = trigger wrapper and script = reusable action body.

Compiler architecture
The design should have three layers:

piston JSON / AST as the stable authoring model,

semantic lowering to abstract HA concepts,

version-specific emitters for current HA script/automation structure.

That way, if Home Assistant changes YAML keys, nesting, or preferred structures again, you update the emitter, not the piston model or wizard behavior.

Managed artifact rule
Generated HA scripts and automations should be treated as compiler-owned artifacts. They can be replaced wholesale on recompile, and users should not be encouraged to hand-edit them in HA because that creates merge/drift problems instead of deterministic regeneration.

The clean mental model is: edit piston in PistonCore, compile, validate in HA, then deploy and reload.

Validation pipeline
A solid deployment path is:

compile candidate HA artifacts,

do syntax/lint checks,

let Home Assistant validate/reload the native artifacts,

only replace the active deployed version if HA accepts them.

That uses HA itself as the final authority for native-target validation, which is stronger than trying to fully replicate HA validation rules inside PistonCore.

Globals insight
Persistent piston globals should map to native HA helpers rather than a custom globals file whenever possible, because helper entities fit HA’s persistence model and survive independently of PistonCore.

Script-local variables then handle per-run transient state, while helpers handle cross-run state.

Suggested wording for Claude
You could give Claude something like this:

Piston JSON remains the canonical source model.

HA scripts + automations are compiled outputs, never the source of truth.

Recompilation is the migration strategy when HA changes syntax.

Native HA scripts are the primary backend.

PyScript is fallback only for features with no practical native equivalent.

Generated HA artifacts are compiler-managed and replaceable.

Validation should rely on HA as the final authority for native deploys.

Persistent globals should prefer HA helper-backed storage over custom files.

One strategic sentence
The strongest framing is: PistonCore is not just an automation builder; it is a compatibility-preserving compiler that insulates users from Home Assistant automation churn while targeting native HA execution whenever possible.
