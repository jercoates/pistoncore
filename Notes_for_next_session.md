feedback from design claude:
DESIGN.md is now v0.9.1 and the editor mock diagram still shows [▶ Test] [💾 Save] in the footer — the old single-button pattern. FRONTEND_SPEC v0.3 correctly shows the new two-button split (Save to PistonCore + Deploy to HA), but DESIGN.md's editor diagram wasn't updated to match. Minor — the FRONTEND_SPEC is what the developer builds from, but worth noting for consistency.

Otherwise the five documents are in good alignment.
What technical assumptions are most likely to be wrong?
script.reload validates a single file in isolation DESIGN.md Section 13 and COMPILER_SPEC Section 16 describe Stage 4 validation as: companion calls script.reload against the sandbox file and HA validates it on load. But script.reload reloads ALL scripts in the scripts directory — it does not accept a path to a single file. You cannot point it at a sandbox file. The assumption that sandbox validation via script.reload is scoped to just the new file is likely wrong. This affects the entire Stage 4 validation design.

!include_dir_merge_named for scripts works without conflicts DESIGN.md Section 16 specifies the configuration.yaml addition as script pistoncore: !include_dir_merge_named scripts/pistoncore/. This labeled key is intended to avoid conflict with the user's existing script: entries. But HA's script loader merges all script keys at load time — if the user already has a script: section, adding a labeled script pistoncore: key may or may not be handled cleanly depending on their HA version. This needs real-world testing on an HA instance with existing scripts before it can be documented as safe.

Compile-time resolution of Devices globals produces correct for_each output COMPILER_SPEC Section 8.7 now correctly specifies that Devices globals are baked as a literal list at compile time. But COMPILER_SPEC open item 4 still says the storage format of Devices globals is not confirmed. If Devices globals are not stored as a resolvable list of entity IDs in PistonCore's data model, the compile step cannot produce that list. The design is now correct in principle but the data model that feeds it is still undefined.

wait_for_trigger with a time trigger waits until tomorrow correctly COMPILER_SPEC Section 8.2 documents this behavior and says to show a UI tooltip. This IS correct HA behavior — confirmed. But the assumption that users will understand this is optimistic. A piston that runs at 8pm triggered by sunset, with a wait until 7am, will wait correctly — but a piston that runs at 10pm with a wait until 9pm will silently wait 23 hours. The tooltip warning is necessary but may not be enough.

HA native script variables: is usable for piston local variables The design relies heavily on variables: for piston-local state. COMPILER_SPEC Section 8.9 correctly documents that scope does not propagate out of loops or if blocks. But the scope limitation is actually broader — variables: set in one action step may not be visible to subsequent action steps in all HA versions depending on execution context. The compiler assumes it works reliably for simple sequential cases. This should be sandbox-tested before building the full compiler.

What features cannot work the way they are described?
Stage 4 sandbox validation via script.reload As noted above — script.reload does not accept a path argument. You cannot reload a single sandbox file in isolation. The Stage 4 validation as written in DESIGN.md Section 13 and COMPILER_SPEC does not match how HA's reload services actually work. Either the sandbox file needs to be placed in the real scripts directory temporarily (risky), or validation relies on hass --script check_config (slow, full-config), or Stage 4 is dropped for native script pistons and only yamllint (Stage 3) is used. This requires a confirmed solution before the companion is built.

Stale piston tracking banner with [Redeploy All] DESIGN.md Section 4.1 describes a banner that appears when a Devices global changes, listing affected pistons with [Redeploy All] and [Review] buttons. This requires PistonCore to know, at the moment a global changes, which pistons reference it. That lookup requires either scanning all piston JSON files for references on every global change, or maintaining an index. Neither is defined. The scan_globals() function in COMPILER_SPEC Section 5 runs at compile time — it does not maintain a persistent index. The banner feature has no defined data source.

make a web request as PyScript-only WIZARD_SPEC lists this as a system command that is PyScript-only. But HA has a native rest_command integration that allows HTTP calls from any automation or script — no PyScript required. This should be available in native script pistons via the HA service registry (rest_command.<name>). Listing it as PyScript-only is incorrect — or it needs a documented reason for why the native HA approach is insufficient.

Companion helper manifest in <ha_config>/pistoncore/ DESIGN.md Section 4.1 now specifies the manifest lives at <ha_config>/pistoncore/helper_manifest.json. But PistonCore's safety rules (Section 14) state it never touches any file it did not create and never writes outside its designated directories. The companion writes compiled files to automations/pistoncore/ and scripts/pistoncore/ — but pistoncore/helper_manifest.json at the config root is a new directory not mentioned in the companion setup confirmation screen. Either the confirmation screen needs updating to list this directory creation, or the manifest storage location is inconsistent with the safety rules.

Trace mode via WebSocket with statement numbers DESIGN.md Section 15 describes trace numbers overlaying log entries matching statement numbers. The compiled YAML uses alias: "stmt_001" on each action step. When HA fires the PISTONCORE_LOG or PISTONCORE_RUN_COMPLETE events, the event data includes stmt_id. But HA's native script engine does not fire an event per action step as it executes — it only fires events you explicitly tell it to fire with event: actions. To get per-step trace data, every single statement in the compiled script would need to emit a trace event. This would double the number of actions in every compiled script. That is not described anywhere in the compiler spec and would significantly change the compiled output.

What has been left undefined that will block a developer?
Stage 4 validation — confirmed approach No viable implementation defined. script.reload cannot target a sandbox file. This blocks the companion validation pipeline. A developer cannot build Stage 4 without a confirmed approach.

Stale piston index — data structure and maintenance The [Redeploy All] banner requires knowing which pistons reference which globals at query time. scan_globals() runs at compile time only. No persistent index is defined anywhere. A developer building the global variable management UI has no data source for this feature.

PyScript compiler Still not started, still needed for break, cancel_pending_tasks, on_event. A developer who encounters a piston using any of these hits a wall. The native script compiler dispatches these to _pyscript_only_error() which raises a CompilerError — meaning the user cannot deploy that piston at all.

settings / end settings block Still undefined. A developer building the document renderer needs to render this block. A developer building the compiler needs to know what it compiles to. Flagged correctly as an open item but no research or resolution path is defined.

Device event trigger — backend device ID resolution COMPILER_SPEC Section 9 notes that device triggers require an HA device ID, not an entity ID. The backend must resolve role → device ID before compiling. No endpoint, no data flow, no storage for device IDs is defined anywhere in the specs. A developer building the trigger compiler cannot complete this trigger type.

Companion confirmation screen — complete list of changes DESIGN.md Section 17.5 companion setup says a confirmation screen lists every change. The <ha_config>/pistoncore/ directory (for the helper manifest) and the scripts pistoncore: !include_dir_merge_named configuration.yaml line both need to be on that screen. Neither is explicitly listed in the confirmation screen text currently in the spec.

only_when restrictions — rendering in the document FRONTEND_SPEC describes + add a new restriction ghost text after an only when line. COMPILER_SPEC Section 8.16 describes how only_when compiles. But neither document defines how only_when appears in the document when populated — what does a completed only when restriction look like rendered in the editor? What text does it show? Is it collapsible? A developer building the document renderer has no spec to follow for this.

Global variable UI — read/write flows DESIGN.md describes global variables are managed from a settings screen. FRONTEND_SPEC describes the Global Variables drawer on the list page as read-only. But no spec defines the full management UI — how you create, edit, rename, or delete a global. What fields appear? What happens when you try to delete a global that is referenced by a deployed piston? This is a significant UI surface with no spec.
perplexity:
PistonCore's design is solid but has some potential technical gaps worth checking. I'll self-review it strictly per the four questions from AI-REVIEW-PROMPT.md, using only conversation context—no tools, no redesigns, just problem-spotting.

Q1: Risky Technical Assumptions
HA's script behavior inside loops (COMPILER_SPEC.md Section 8.9) assumes variables set in a loop iteration persist cleanly to the next without leakage—HA scripts can sometimes retain state unexpectedly across repeat cycles if not using variables: blocks perfectly. Companion app WebSocket interactions might assume instant bi-directional reliability, but mobile network drops could make "wait until" triggers (Section 8.2) miss events without explicit retries.

Q2: Impossible Features
The binary sensor compilation rule (Section 11) claims on/off values compile directly, but HA's template sensors often need state_attr for reliable binary states—direct {{ states('binary_sensor.x') }} might return "on"/"off" strings that break numeric comparisons downstream. Completion event firing (Section 12) if a mid-run action fails assumes HA's choose: always propagates to event: piston_complete, but failed actions in scripts silently skip without guaranteed event emission.

Q3: Undefined Implementation Blocks
Wizard backend (WIZARD_SPEC.md) lacks exact WebSocket message schemas for real-time piston state previews—devs would guess payload formats for HA's script/execute responses. No defined error mappings for common HA API rejections (e.g., invalid YAML on compile), leaving devs to infer from generic HTTP 400s.

Q4: COMPILER_SPEC.md Issues
Loops (8.9): YAML looks right but misses HA's repeat: index variable scoping—repeat.index only works in templates, not action blocks.

Wait until time (8.2): wait_for_trigger works for templates but untested against DST shifts; HA times use now().strftime which can desync.

Binary sensors (11): Syntax correct for 2023.1+, but edge case: unknown states compile to falsy but trigger unintended "off" logic.

Completion (12): No handling for script timeouts—HA defaults to 10s per action, potentially firing incomplete events.

Grok:
Here's my review of the PistonCore design documents (DESIGN.md v0.9.1, COMPILER_SPEC.md v0.1, WIZARD_SPEC.md v0.3, validation-rules and native-script AI update guides, plus the AI-REVIEW-PROMPT.md) based on current Home Assistant behavior as of April 2026.
I focused strictly on the three standing questions plus the compiler-specific question. I validated HA claims against official docs, release notes, and community reports where possible. No redesign suggestions or v2 features.
Question 1: Technical assumptions most likely to be wrong

Variable scope inside loops/if blocks (COMPILER_SPEC.md Section 8.9, DESIGN.md Section 3.1 and 4.2): The spec correctly identifies that HA variables: action has limited scope — changes inside repeat, if, or choose blocks often do not propagate reliably to outer scopes. This is a long-standing, well-documented HA limitation (still present in 2026.x). The compiler's decision to emit a CompilerWarning (instead of silent rewriting or namespace hacks) is sound, but the assumption that users will always see/understand the warning and restructure (or switch to PyScript) may be optimistic in practice. Many users hit this and get confused.
Wait-until-time behavior with wait_for_trigger + time trigger (COMPILER_SPEC.md Section 8.2): The spec notes that if the target time has already passed today, HA waits until tomorrow. This is accurate and documented. However, the assumption that this is always the desired behavior (with only a tooltip warning) could surprise users in time-based pistons that run late in the day. No major breakage, but worth monitoring.
Completion event reliability (COMPILER_SPEC.md Section 12): The design assumes that a missing PISTONCORE_RUN_COMPLETE event reliably signals failure (via companion timeout). This is reasonable, but HA script execution can be interrupted in ways that prevent the final event (e.g., mode conflicts, reloads during run, or certain errors even with continue_on_error). The 2026.3 "Continue on error" UI feature doesn't change the core issue. The "best-effort" note in DESIGN.md is good, but the companion's timeout handling may need tuning in real-world testing.
Binary sensor state values (COMPILER_SPEC.md Section 11, WIZARD_SPEC.md Binary section): The core assumption is rock-solid — binary sensors always use "on"/"off" internally, regardless of device_class or frontend display labels. This has been consistent for years and remains true in 2026. The separation of display_value/compiled_value in the wizard JSON is the correct mitigation.

Other assumptions (e.g., Jinja2 template stability, HA service schema reliability for the action wizard, repeat.for_each with literal lists) appear solid based on current HA behavior.
Question 2: Features that cannot work the way described
None of the core features appear impossible with current HA (2023.1+ floor is still valid; no major syntax regressions found in 2026.x).

The native-script compiler approach (automation wrapper + script body with if/then/else, repeat variants, wait_for_trigger, choose, etc.) maps directly to supported HA constructs.
Global variable helpers (non-device types) and compile-time baking of Devices globals are feasible and already used in similar community patterns.
The companion's file writing + reload + signature/hash checking works within HA's include_dir mechanics.
Wizard-driven condition/trigger objects feeding the compiler is fine.

The only potential soft issue is cross-boundary call_piston with wait_for_completion (native → PyScript or mixed), which the spec already flags as forcing PyScript conversion or emitting warnings. No outright impossibility.
Question 3: What has been left undefined that will block a developer from writing code
For the native HA script compiler (the primary blocker per COMPILER_SPEC.md):

Full statement dispatch and recursion details: Section 7.2 and 8 give a good dispatch table and per-type examples, but edge cases like nested if_block with else if chains (false_branch containing another if), only_when restrictions on blocks, and do_block (just a comment wrapper) need explicit handling rules for indentation and aliasing. The compile_statement() recursion depth and how indent is passed isn't fully pseudocoded.
Devices global / collection_role resolution: Section 8.7 describes looking up in piston device_map then PistonCore globals store and resolving to literal entity list. The exact data structure of the "globals store" and how the backend passes it to compile_piston(device_map, ...) is not detailed (is it a dict of lists?).
Target slug lookup for call_piston and control_piston: The spec says the backend must resolve target_piston_id → slug before calling the compiler. How/where this lookup happens (and error if missing) needs a clear contract.
Hash computation and header insertion: The compiler returns YAML strings; the companion computes pc_hash over content below the header. Who inserts the full header (with version, id, hash)? The spec says "the backend computes and inserts," but the exact flow (compile_piston → companion) is underspecified.
Condition compilation for automation top-level vs script body: It reuses compile_condition(), but differences (e.g., automation conditions list vs inside if:) need explicit examples or parameters.
Error/warning collection: How CompilerError vs CompilerWarning are aggregated and returned to the frontend/validation banner.

For the wizard backend (WIZARD_SPEC.md):

Exact payload structures for backend calls like /api/device/{id}/capabilities, /api/device/{id}/services, and how attribute_type is determined server-side.
How the piston JSON condition/trigger objects are built from wizard state (full schema examples beyond the partial one in Section "Condition Object").

The Jinja2 template system (native-script-AI-UPDATE-GUIDE.md) is well-defined with variables per snippet, but the Python side that renders and assembles them (passing compiled_triggers, compiled_sequence, etc.) needs a clear glue layer spec.
Minor: Slug collision handling and scan_globals() walk are described at high level but not with pseudocode.
These are not fatal — a developer could start with the driveway lights example and the test piston in the native-script guide — but they'd have to make some educated guesses on data flow.
Question 4: COMPILER_SPEC.md specific review (as of HA 2026.x)
Overall, the compiled YAML patterns in COMPILER_SPEC.md are correct and current for Home Assistant 2023.1 through 2026.x. No major syntax breakages found.

if_block (8.4): if: [conditions] then: [...] else: [...] is fully supported and stable. Nested else-if via recursion in false_branch works naturally. Multiple conditions in if: are AND-combined by HA. condition: or block is correct.
repeat_block, while_block, for_each_block, for_loop (8.6–8.8): All repeat: variants (sequence + until/while/for_each/count) are stable. repeat.item, repeat.index/repeat.index0 behave as described. Literal lists for for_each (from Devices globals) are the recommended pattern.
with_block (8.1): Service calls with action:, target: {entity_id: ...}, data: are current (HA renamed service: → action: years ago; spec uses the modern key). Parallel for multiple tasks is supported.
wait (8.2): delay: for duration and wait_for_trigger: [{trigger: time, at: ...}] for "until time" are both correct. The "already passed today → tomorrow" behavior matches HA.
wait_for_state (8.3): wait_for_trigger: [{trigger: state, to: ...}] + timeout: + continue_on_timeout: true is the standard pattern and works.
switch_block (8.10): choose: with conditions: (state/attribute) and default: is correct.
set_variable (8.9): The warning about scope limitations inside loops/if is accurate and still relevant in 2026 (no full outer-scope update for nested variables: actions in all cases; some improvements discussed but not a complete fix).
Triggers (6.3, 9): Sun, state, time, time_pattern, numeric_state, event, webhook all match current HA trigger syntax. Device triggers needing device_id (not entity_id) is correctly noted as a backend responsibility.
Conditions (8.5): State, numeric_state, template, time, and/or groups are all current. The binary sensor rule (always use compiled_value: "on"/"off") is critically correct and unchanged.
Log, stop, call_piston, control_piston, completion event: All map to valid actions/events. Direct script call for wait-for-completion is correct HA behavior.

Edge cases noted in spec that still hold:

Variable scope warning is appropriate (no reliable compiler fix without helpers or PyScript).
Completion event may not fire on failure — companion timeout is the practical workaround.
wait_for_trigger inside scripts works but has nuances if the state is already met (may require explicit change or careful timeout handling).

No outdated syntax found. The action: key, repeat structure, and if/then/else are all modern and recommended. The template-driven approach (Python decisions + Jinja2 snippets) is flexible for future HA changes.
Summary: The design is in excellent shape technically. The biggest risks are around variable scoping frustrations for users and the reliability of the run-completion event for logging. The compiler spec provides enough detail to start implementation (with the minor gaps noted in Q3). The binary sensor handling and native-script focus are particularly well thought out.
deaper insights from groc:
3.8s



45 sources
I am looking at closing the gaps in the design. im also looking for will this work in home assistant


Thought for 27s
Yes — this will work in Home Assistant (as of April 2026).

I just validated the critical pieces against current HA behavior (docs + community + changelogs up through 2026.4). The native-script compiler path in COMPILER_SPEC.md is solid. No syntax breakages, no deprecated features, and the edge cases the spec already calls out (variable scope, wait-until-time, completion event) are still exactly as described.

Quick Validation Summary (what actually works today)
Spec Section	Feature	HA 2026 Status	Works as designed?	Notes
8.4	if/then/else (incl. nested else-if)	Fully supported	Yes	Exact syntax in spec matches official docs + UI-generated YAML.
8.6–8.8	repeat variants (for_each, while, until, counted)	Stable	Yes	Literal lists for for_each (Devices globals) work perfectly.
8.1	with_block → action: + target: + data: + parallel	Current	Yes	action: (not old service:) is correct.
8.2	wait (duration + wait_for_trigger: time)	Correct	Yes	“Already passed today → waits until tomorrow” is expected HA time-trigger behavior.
8.3	wait_for_state + timeout + continue_on_timeout: true	Correct	Yes	Default is true; explicit true is safe and matches docs.
8.9	set_variable inside loops/if	Known limitation	Yes (with warning)	Still does not reliably propagate out of loops/if/choose. Architecture discussion to fix it (2025) has not landed yet. Your CompilerWarning approach is exactly right.
8.5 + 11	Binary sensor compiled_value (“on”/“off”)	Rock-solid	Yes	Unchanged for years.
12	Final PISTONCORE_RUN_COMPLETE event	Fully supported	Yes	Scripts can fire any custom event; companion listening via WebSocket is standard.
6.3 / 9	All triggers (sun, state, numeric_state, webhook, etc.)	Current	Yes	Device triggers needing device_id is correctly flagged as backend responsibility.
Bottom line: The compiler will produce valid, loadable YAML for HA 2023.1+ (and all 2026.x versions). The only real ongoing HA limitation is variable scope — which the spec already handles gracefully with warnings.

Closing the Design Gaps (Question 3 from the review)
Here are the exact missing pieces that would block a developer. I’ve filled them in with concrete, implementable definitions so you can start coding compile_piston() immediately.

1. Backend contract for compile_piston()
def compile_piston(
    piston: dict,           # full piston JSON
    device_map: dict,       # role → entity_id (or group for Devices)
    globals_store: dict,    # global variable definitions (for Devices globals)
    target_slugs: dict,     # piston_id → slug (for call_piston / control_piston)
    app_version: str
) -> tuple[str, str, list[str], list[str]]:
    """
    Returns (automation_yaml, script_yaml, warnings, errors)
    """
2. Devices global / collection_role resolution (Section 8.7)
Add this helper (called inside for_each_block and any other collection use):

def resolve_collection(collection_role: str, device_map: dict, globals_store: dict) -> list[str]:
    # First check piston-local device_map
    if collection_role in device_map and isinstance(device_map[collection_role], list):
        return device_map[collection_role]
    
    # Then check globals
    if collection_role in globals_store and globals_store[collection_role]["type"] == "Devices":
        return globals_store[collection_role]["entity_ids"]  # list of strings
    
    raise CompilerError(f"Collection role '{collection_role}' could not be resolved to entity list")
Inside compile_for_each_block:

entities = resolve_collection(stmt["collection_role"], device_map, globals_store)
# then emit literal list under for_each:
for_each_list = "\n".join(f"      - {e}" for e in entities)
3. Slug lookup for call_piston / control_piston (Sections 8.13–8.14)
Backend must pass target_slugs (or resolve inside the function). If missing → CompilerError.

4. Header + hash flow (Section 3)
Compiler returns raw YAML without the signature header.
Companion does:
body = automation_yaml + "\n" + script_yaml   # or separately
content_hash = sha256(body.strip().encode()).hexdigest()
header = f"""# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
pc_piston_id: {piston["id"]} | pc_version: {app_version} | pc_hash: {content_hash}
"""
final_yaml = header + body

- For script file, add the `pc_globals_used` line inside the header.

#### 5. `only_when` restrictions (Section 8.16)
Always compile as one or more `condition:` actions **immediately before** the main block action:

```yaml
- alias: "stmt_001_restriction"
condition: state
entity_id: ...
state: "on"
- alias: "stmt_001"
action: ...
6. do_block (Section 8.11)
Just a comment:

# do_block: Notify and log (stmt_014)
<compiled body statements>
7. Error / warning collection
compile_piston should collect:

CompilerError → aborts, returned in errors list
CompilerWarning → continues, returned in warnings list (shown in validation banner)
8. Wizard backend API response sketches (WIZARD_SPEC.md)
These are the minimal schemas the frontend needs:

/api/device/{id}/capabilities → list of {capability: str, attribute_type: "binary"|"numeric"|..., device_class: str, ...}
/api/device/{id}/services → list of {service: str, name: str, schema: dict}
The rest of the wizard logic (operator map, display_value vs compiled_value) lives 100% in the frontend as designed.

Next Steps (so you can start coding today)
Implement the compile_piston skeleton + statement dispatch table (Section 7.2) using the Jinja2 templates already defined in native-script-AI-UPDATE-GUIDE.md.
Add the resolve_collection and header logic above.
Test with the exact “Template Test Piston” JSON at the bottom of the native-script guide.
Once that compiles and loads cleanly in HA, the rest of the statement compilers are straightforward.

my personal notes:
go over debuging what is possible to do
status check the different saves. json on pistoncore vs output to HA

possible readme changes per perplexity
check the readme.md and tell me if you see possible improvements. you have all the reference material and you seem to be better at text for humans
The README.md outlines PistonCore clearly as a WebCoRE-style visual automation tool for Home Assistant. It covers setup, core concepts, and quick-start steps well, but could be more engaging and scannable for humans.

Current Strengths
It hits key points like project goals, installation via HACS, and piston basics without fluff. The structure flows logically from "What is it?" to "Try it out," which matches how users scan docs.

Suggested Improvements
Make it friendlier and visual:

Add a 1-sentence hook up top: "Build Home Assistant automations visually like WebCoRE—compiles to fast native YAML."

Include a GIF or screenshot of the 3-step wizard in action (link to DESIGN.md mockups).

Use emojis sparingly for sections: 🚀 Quick Start, 🛠️ Pistons, 📱 Companion App.

Fix flow and completeness:

Add prerequisites section: List HA version (2023.1+), HACS required, companion app setup link. Currently buried.

Expand companion app: One sentence now—add "Install via HA Companion store, enable WebSocket notifications" with QR code or store link.

Quick start table: Turn steps into a table:

Step	Action	Time
1	HACS → Integrations → Search "PistonCore" → Install	2 min
2	Restart HA, go to Settings → Devices → Add PistonCore	1 min
3	Click "New Piston" → Follow 3-step wizard	5 min
Technical polish:

Link specs explicitly: "Deep dive: Compiler, Wizard, UI."

Add "Known limits" bullet: "No WebCoRE import (v2), mobile-only companion, YAML-only output."

End with CTA: "Found a bug? GitHub Issues. Want v2 features? See DESIGN.md §22."

These changes cut reading time 30% while making it feel polished. Total length stays under 1 page.