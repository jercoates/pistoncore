"What technical assumptions in this design are most likely to be wrong?"
"What features described here cannot work the way they are described?"
"What has been left undefined that will block a developer from writing code?"

Add "ask Claude for better commit message names"

Gemini Review: 
As an AI review session participant, I have analyzed DESIGN.md, COMPILER_SPEC.md, WIZARD_SPEC.md, and FRONTEND_SPEC.md. My focus is strictly on technical feasibility and implementation blockers for the 2026 Home Assistant ecosystem.

Question 1 — Technical Assumptions Likely to be Wrong
The "Wait Until Time" via wait_for_trigger (COMPILER_SPEC 8.2):

Assumption: Using a time trigger inside a wait_for_trigger block in a script.

The Reality: In native HA scripts, wait_for_trigger supports platform: time only as of recent versions, but it does not evaluate a time that has already passed for that day. If a piston runs at 11:01 PM and has a wait until 11:00 PM, the script will hang for 23 hours and 59 minutes. WebCoRE users expect "if time is past, proceed immediately." Native HA scripts do not naturally "fall through" past times without an explicit condition check before the wait.

Physical vs. Programmatic Interaction (WIZARD_SPEC):

Assumption: Context IDs (context.id) reliably distinguish "Physical" from "Programmatic."

The Reality: This is highly dependent on the integration. While Z-Wave JS and Zigbee2MQTT are getting better at reporting origin: local, many Wi-Fi and cloud-poll integrations report all state changes as "null" context or "supervisor" context. Labeling this as a core feature may lead to significant user frustration when it works for a light switch but fails for a garage door.

The "Atomic" Reload (FRONTEND_SPEC 3):

Assumption: Calling automation.reload and script.reload is sufficient for a "Deploy."

The Reality: If a PistonCore automation is currently running (e.g., in a wait), reloading the YAML terminates all active instances of that automation/script immediately. Unlike WebCoRE, which maintained state better during "saves," an HA reload is a hard stop.

Question 2 — Features That Cannot Work as Described
Wait for State with Timeout (COMPILER_SPEC 8.4):

Problem: You describe a native HA wait_for_trigger with a timeout that "continues to the next statement."

Why: In native HA scripts, if a wait_for_trigger hits its timeout, the script continues, but there is no native way to branch logic based on whether it timed out unless you immediately follow it with a condition block to check the state again. The "Timeout Action" described in the spec requires a manual choose block injection by the compiler to verify the result of the wait.

$currentEventDevice in Native Scripts (WIZARD_SPEC):

Problem: Using $currentEventDevice in a native YAML script.

Why: Native HA automations pass a trigger object, but scripts do not unless the automation explicitly passes the trigger data as a variable to the script call. If the compiler generates a separate script and automation file, the script will have no knowledge of what triggered the automation unless the service: script.piston_name call includes data: { trigger_info: "{{ trigger }}" }.

Question 3 — Undefined Information Blocking Development
The piston_id Mapping (Compiler Block):

The compiler needs to know if it is responsible for generating the unique id for the HA automation: block or if the piston_id from the JSON is used. If the id is not consistent in the YAML, the "Trace" and "Log" features will break because HA won't be able to link the execution back to the PistonCore UI.

Binary Sensor device_class source (Wizard Block):

The Wizard Spec mentions a lookup table for "Open/Closed" vs "Detected/Clear." Blocker: The backend needs to know how to handle a custom binary sensor that has no device_class. Does the wizard default to "On/Off"? The spec implies a lookup, but the "fallback" for a null class is not explicitly mapped in the JSON schema.

Variable Persistence (Compiler Block):

Native HA scripts lose all local variable states the moment the script ends. If "Piston Variables" are meant to persist between runs (like WebCoRE), the compiler cannot use script variables; it must use input_text or input_number helpers. The spec is silent on where "Local Piston Variables" are physically stored in HA.

Question 4 — COMPILER_SPEC.md Review
Section 8.9 (Loops): Confirmed Problem. Native HA repeat loops create a new scope. If you "Set Variable" inside a loop, that value is often lost when the loop finishes unless the variable was defined at the very top of the script's sequence. The compiler must explicitly initialize all variables at the start of the sequence to ensure scope persistence.

Section 11 (Binary Rule): Correct. Handling the on/off compiled value is the correct way to interface with the HA state machine.

Section 12 (Completion Events): Suspicion. If a script is killed by the user or an HA restart, the pistoncore_run_complete event will never fire. The frontend will show the piston as "Running" forever. You need a "Heartbeat" or a way to detect "Stale" runs in the FRONTEND_SPEC.

Section 8.3 (With/Do Blocks): Edge Case. If multiple entities are in a with block, native HA service calls can be sensitive. If one entity in a list fails (e.g., a dead Zigbee node), HA may stop the entire script. The compiler should ideally wrap these in continue_on_error: true if the user wants WebCoRE-style "fire and forget" resilience.

Summary of Confirmed Technical Problems
Script Scope: Loops will break variable updates without a "Variable Initialization" block at the script head.

Wait Logic: "Wait until time" will hang for 24 hours if the time has already passed.

Variable Storage: Native scripts are stateless; piston variables will reset to default every run unless mapped to HA Helpers.
