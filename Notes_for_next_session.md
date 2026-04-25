

Fix semicolons on end keywords across all HTML files before cousin picks them up

info frome notebooklm on webcore piston video
Technical Manual: Advanced HVAC & Smoke Response webCoRE Piston

1. Manual Overview & System Requirements

This technical manual outlines the configuration of a multi-purpose webCoRE piston designed for high-level HVAC management and emergency response. As a Technical Lead, I have structured this automation to handle three core operational objectives within a single logic framework:

* Energy Conservation: Real-time monitoring of contact sensors (doors/windows) to prevent thermal loss by notifying users and eventually suspending HVAC operations.
* Efficiency Comparison: Intelligent comparison of outdoor ambient temperatures against internal HVAC set points to suggest passive climate control alternatives.
* Emergency Smoke Response: High-priority integration with smart smoke detectors to immediately disable air circulation upon detection, mitigating the spread of smoke or fire through the ventilation system.

Hardware & Software Requirements

Successful deployment requires the following ecosystem components:

* Thermostat: An Ecobee thermostat (ideally integrated via Ecobee Suite Manager) or any thermostat device handler compatible with SmartThings/Hubitat that supports mode switching.
* Contact Sensors: Zigbee, Z-Wave, or Wi-Fi smart sensors for all perimeter doors and windows.
* Smoke Detectors: Integrated smart smoke detectors (e.g., Nest, First Alert, or Hub-connected sensors).
* Outdoor Temperature Data: Access to the $twcweather system variable or, as utilized in this specific build, the weather temperature attribute provided directly by the thermostat’s device handler.

The fire safety automations described herein are strictly ADDITIVE. These instructions are intended to provide secondary early detection and warning. This piston must not be relied upon as a primary life-safety mechanism. It is not a replacement for professional monitoring, local fire codes, or the native alerting functions of your smoke detectors. Always maintain your hardware according to manufacturer specifications.


--------------------------------------------------------------------------------


2. WebCoRE Interface & Navigation Essentials

To build this piston effectively, you must utilize three specific UI navigation elements that are often overlooked by novice users:

* The Cog Icon (Advanced Options): Found within the condition editor for a device. This is essential for storing the specific list of "matching devices" into a variable when multiple sensors are being monitored.
* The Orange Menu (Logic Evaluation): When selecting multiple devices for a single condition, an orange bar appears above the attribute. You must toggle this to switch between "any of the selected devices" (OR logic) and "all of the selected devices" (AND logic).
* The Double Arrow Icon (Task Reordering): Located in the top toolbar of the editor. This must be enabled to drag-and-drop tasks. In this piston, the order of operations is critical for variable capture; if you do not see these arrows, click the double-arrow icon in the toolbar to enable "Move" mode.


--------------------------------------------------------------------------------


3. Local Variable Initialization

Initialize the following 10 local variables at the top of your piston. These act as the "memory" of your automation.

Variable Name	Type	Initial Value / Setup
smoke detected	Boolean	(No initial value)
hvac manual mode	Boolean	(No initial value)
doors	Device	Select specific door sensors
windows	Device	Select specific window sensors
detectors	Device	Select specific smoke detectors
detector smoke	Device	(No initial value)
open contacts	Device	(No initial value)
open contacts list	String	(Leave empty)
detector smoke list	String	(Leave empty)
hvac state	Dynamic	(Leave empty)*

Senior Engineer’s Note on "Dynamic" Types: The hvac state variable is set to Dynamic because thermostat modes can return different data formats (Strings or Integers) depending on the specific device handler used. Using a Dynamic type ensures the value is captured and restored without type-mismatch errors.


--------------------------------------------------------------------------------


4. Logic Block 1: Initial Energy Conservation Alert (5-Minute Threshold)

This block provides a "soft" warning to occupants before the system takes corrective action.

1. Add Statement: Select "Add an if" under the execute block.
2. Conditions:
  * Device: Select the doors and windows variables.
  * Attribute/Comparison: Set attribute to contact, comparison to stays, and value to open for 5 minutes.
  * Advanced: Click the cog icon and set "Store the list of matching devices into variable" to open contacts.
  * Second Condition: Add the thermostat device. Attribute thermostat mode, comparison is any of, values: auto, cool, heat.
3. Actions:
  * Set Variable: Set open contacts list = open contacts.
  * Notification: Send push notification (Store and messages = true).
  * Syntax: Use the expression: "The following contacts are open: {open_contacts_list}. Please close them as the HVAC is running."


--------------------------------------------------------------------------------


5. Logic Block 2: Automated HVAC Shutdown (10-Minute Threshold)

This block enforces energy savings by disabling the system.

1. Duplicate: Right-click Logic Block 1 and select "Duplicate."
2. Modifications: Change the stays open duration to 10 minutes. Update the With block target to your specific Thermostat device.
3. Task Ordering (Critical): Use the double arrow icon to ensure tasks execute in this exact sequence:
  1. Set variable hvac manual mode = true (Locks the restoration logic).
  2. Set variable hvac state = thermostat mode (Must occur before shutdown to capture the current "cool" or "heat" state).
  3. Set variable open contacts list = open contacts.
  4. Send push notification: "HVAC shut down due to: {open_contacts_list}."
  5. Set thermostat mode to off.

Pro-Tip: If you set the mode to off before capturing the hvac state, the variable will save "off," and the system will never automatically turn back on when you close the windows.


--------------------------------------------------------------------------------


6. Logic Block 3: Automatic Status Restoration

This block handles the logic for resuming normal operations once the home is sealed.

1. Triggers:
  * Condition 1: doors and windows -> contact -> changes to -> closed (Orange menu: any of).
  * Condition 2: doors and windows -> contact -> are -> closed (Orange menu: all of).
2. Safety & State Checks:
  * smoke detected is not true.
  * thermostat mode is off.
  * hvac manual mode is true.
3. Actions:
  * Set hvac manual mode = false.
  * Set thermostat mode = {hvac_state} (Select "Expression" or "Variable" for the value, not a hard-coded string).
  * Send notification: "All contacts closed. HVAC restored to {hvac_state} mode."


--------------------------------------------------------------------------------


7. Logic Blocks 4 & 5: Efficiency Notifications

These blocks suggest opening windows when the outdoor climate is favorable.

1. Block 4 (Heating): Click "Add a new statement" -> "Add an if" -> "Add a group".
  * Set group to Logical OR.
  * Inside group: Thermostat mode changes to heat OR Thermostat operating state changes to heating.
  * Outside group: Weather temperature is greater than heating set point.
  * Action: Notification: "It is warmer outside than your heat set point. Consider opening a window."
2. Block 5 (Cooling): Duplicate Block 4. Update group to cool/cooling.
  * Change comparison: Weather temperature is less than cooling set point.
  * Action: Notification: "It is cooler outside than your AC set point. Consider opening a window."


--------------------------------------------------------------------------------


8. Logic Blocks 6 & 7: Smoke Detection & System Recovery

Logic Block 6 (Emergency Response)

1. Condition: detectors -> smoke -> changes to -> detected (Orange menu: any of).
2. Advanced: Click the cog icon and store matching devices in detector smoke.
3. Actions:
  * Set smoke detected = true.
  * Set detector smoke list = detector smoke.
  * Send SMS notification: "SMOKE DETECTED by: {detector_smoke_list}!" (Note: SMS availability depends on hub region; I recommend disabling "Store in history" for SMS to keep logs clean).
  * Send push notification: "SMOKE DETECTED by: {detector_smoke_list}!"
  * Turn off the thermostat.

Once smoke detected is set to true, the HVAC system is hard-locked in the off state for safety. Even if the smoke clears, the system will not resume normal operation until you manually enter the webCoRE dashboard and set the smoke detected boolean back to false.

Logic Block 7 (Clearance)

1. Condition:
  * detectors -> smoke -> changes to -> clear (any of).
  * detectors -> smoke -> are -> clear (all of).
2. Action: Push notification: "All smoke detectors report clear. Manual HVAC reset required."


--------------------------------------------------------------------------------


9. Testing & Validation Procedures

Standard engineering practice requires a rigorous test of all logic gates before the piston is considered "Production Ready."

1. Threshold Validation: Open one window. Verify the "Warning" notification arrives at exactly 5 minutes. Verify the "Shutdown" occurs at 10 minutes.
2. Persistence Test: While one window is open, open and close a secondary door. Verify the HVAC remains off until all contacts in the doors and windows variables are closed.
3. State Memory Test: Ensure that if the HVAC was in cool mode before shutdown, it returns to cool (and not heat or auto) upon restoration.
4. Smoke Simulation:
  * Temporarily change the trigger in Block 6 from detected to test.
  * Initiate a hardware test on your detector.
  * Verify the HVAC kills immediately and the SMS/Push includes the correct detector name via {detector_smoke_list}.
  * Important: Perform the manual reset of the smoke detected variable to confirm you can successfully exit the emergency lock state.
  * Revert the trigger from test back to detected.
Keep for future prompts:
NotebookLM prompt:
"From this video, extract only information about the webCoRE user interface and how it works. I want to know: how the editor looks and is laid out, how the wizard works step by step when adding a trigger, condition, or action, what happens when you click on something to add or edit a statement, how the device picker works, how the condition and operator selection works, what the different wizard steps look like and in what order they appear, how the document renders keywords and indentation, and any UI behaviors like right-click menus, drag to reorder, the cog icon, the orange menu, and ghost text insertion points. Do not include information about how to build any specific piston or what the piston does — only how the UI works.
or : For every action the user takes in the wizard, document the sequence: what they clicked to open it, what the first screen shows, what options were available, what they selected, what appeared next, and what the final result looked like in the editor document. Capture this as a step-by-step flow so it can be used to rebuild the exact wizard behavior.
  feedback from grok:
  Code Review: PistonCore (excluding grok-frontend/ and session2_archive/)
Overall Status (as of April 24, 2026): The project has advanced rapidly from design-only to a functional early-stage implementation. The core backend (FastAPI + compiler) is largely complete and follows the specs closely. The frontend is a solid vanilla JS SPA foundation with real structure. Docker setup works. This is impressive progress for what was "coding just beginning" recently.
1. Backend (backend/ folder) — Strong
Strengths:

Clean architecture: storage.py owns all FS I/O (excellent separation). compiler.py is well-organized with per-section comments tying directly to COMPILER_SPEC.md. ha_client.py handles WS cleanly with caching.
Compiler (compiler.py): Implements most of the spec (triggers, conditions, sequence compilation, Jinja2 templating, globals scanning, slug handling, error/warning system). It’s modular — easy to extend with new statement types via _compile_sequence(). Uses proper Jinja environment.
API (api.py): Well-documented endpoints, clear distinction between Save (JSON only) and Deploy (compile + companion). Good use of Pydantic/dependencies. API key protection (optional for dev).
main.py: Simple, handles static frontend serving correctly with path awareness for Docker.
HA integration: WebSocket client with proper auth, entity/area merging, capability detection, and services schema — aligns perfectly with wizard needs. Caching is thoughtful.

Areas for Improvement:

Error handling & robustness: Compiler has CompilerError but some paths (e.g., missing templates) could be more graceful. _mark_pistons_stale_for_global uses a naive string search — could miss edge cases.
Testing: No unit/integration tests visible yet (add pytest + fixtures for compiler roundtrips against spec examples).
Security: CORS is * (fine for LAN/Docker but document tightening). API key is simple shared secret — good start.
TODOs: Companion stub in deploy (expected). Some HAClientError paths could return more user-friendly messages.
Dependencies: Minimal and appropriate (FastAPI, Jinja, PyYAML, websockets).

2. Frontend (frontend/ folder) — Good Foundation
Strengths:

Pure vanilla JS + HTML/CSS (no framework bloat — matches spec).
Modular JS files (app.js, editor.js, wizard.js, etc.) with clear responsibilities.
UI structure ready for structured editor: pages for list/status/editor, globals drawer, wizard modal, context menu, reconnect banner.
API client abstraction in api.js.

Areas for Improvement:

Editor completeness: The tree-style piston editor (drag/drop, nested if/then, statements) is the hardest part. It’s scaffolded but will need heavy work for real-time rendering, undo, and live validation.
Wizard: Dynamic device/service picking is critical — ensure it fully implements WIZARD_SPEC.md (attribute_type priority, role mapping, etc.).
Styling/UX: CSS exists but polish needed for WebCoRE-like feel (indentation, statement blocks, top-to-bottom flow).
WebSocket/HA status: Reconnect logic present — test thoroughly with flaky networks.
Accessibility & mobile: Early stage; add ARIA, keyboard nav for editor.

3. Customization Layer (pistoncore-customize/)

Excellent design: Jinja templates + validation rules live here so HA churn is absorbed without code changes.
Templates folder structure present with native-script target (matches compiler defaults).

4. Docker / Deployment

Dockerfile, docker-compose.yml, docker-entrypoint.sh, requirements.txt — recent and functional.
Volumes for userdata and customize are correctly set up. Good dev overrides via env vars.

5. Documentation & Maintainability

Excellent: Every major file has clear headers referencing specs. README.md, backend README, AI prompts all helpful.
Consistency: Code follows the "backend serves the spec" philosophy.
Versioning: App at 0.9 — matches design.

Recommendations / Next Priorities

Compiler completeness — Finish remaining statement types (loops, waits, with_block, etc.) and test against the driveway lights example in COMPILER_SPEC.md.
Frontend editor — Prioritize the visual tree renderer and statement insertion (this is the "wow" factor).
Companion integration — Implement the HA custom component for true deploy/reload.
Tests + validation — Add automated tests for compiler + sample pistons.
Error surfacing — Make sure frontend shows warnings/errors clearly (compile_check on save is already wired).
Performance — Compiler is sync; for very large pistons it could block — consider background tasks later.

Verdict: This is a high-quality, spec-driven foundation. The separation of concerns, template-driven compiler, and no-lock-in philosophy are executed well. With the editor polished and companion finished, this will be a genuinely useful tool for ex-WebCoRE users on HA.
Grok code fixes with context for the changes:
Frontend Fix Recommendation: Align Editor + Wizard with Real WebCoRE Behavior
The current frontend (as of the latest commits) has a solid SPA foundation and good structure, but the editor rendering and wizard flow diverge from the actual WebCoRE UI shown in the screenshots you provided. This is likely what caused Claude to go off track.
Core Problems Identified (vs. Screenshots)

Wizard Entry Point — Current code jumps straight to "statement type picker" or "condition vs group" in some places. Screenshots show Condition vs Group is the very first wizard step for conditions (screenshot 17), and Statement Type Picker is the entry for actions (screenshot 28).
Editor Rendering — Current _renderActionNodes() uses a mix of "if/when true/when false" and block syntax. WebCoRE uses clean top-to-bottom flow with if / then / else if / else / end if structure (screenshots 9, 16, 37).
Insertion Points — Ghost text is good, but WebCoRE has very specific "click anywhere on a blank line" + right-click context menu behavior (screenshot 4).
Wizard Steps Order — Screenshots reveal a very deliberate multi-step sequence (especially for conditions: What to compare → Attribute → Interaction → Operator → Value/Duration). The current wizard.js partially implements this but not in the exact order/flow.
Visual Style — Needs tighter match to WebCoRE’s indentation, keyword coloring, and inline completed statements.

Proposed Fix (Minimal, High-Impact Changes)
1. Update editor.js — Better Tree Rendering (Match Screenshots 9, 16, 37)
Replace the _renderActionNodes function with a cleaner version that mirrors WebCoRE’s visual style:
JavaScript// In editor.js — replace _renderActionNodes
function _renderActionNodes(nodes, depth = 1) {
  const pad = `indent-${Math.min(depth, 6)}`;
  let html = '';
  let stmtNum = 1; // reset per call or track globally

  nodes.forEach((node, i) => {
    const id = node.id || `stmt-${Date.now()}-${i}`;
    const num = stmtNum++;

    if (node.type === 'if_block') {
      html += `<div class="stmt-node ${pad}" data-type="if" data-id="${id}">
        <span class="stmt-num">${num}</span><span class="kw">if</span>
      </div>`;

      // Conditions inside if
      (node.conditions || []).forEach(c => {
        html += `<div class="stmt-node indent-${depth+1} condition-inline">${_conditionText(c)}</div>`;
      });

      html += `<div class="${pad}"><span class="kw">then</span></div>`;
      html += _renderActionNodes(node.then_actions || [], depth + 2);

      if (node.else_if_actions && node.else_if_actions.length) {
        // Support else if chains
        node.else_if_actions.forEach(elif => {
          html += `<div class="${pad}"><span class="kw">else if</span></div>`;
          (elif.conditions || []).forEach(c => html += `<div class="indent-${depth+2}">${_conditionText(c)}</div>`);
          html += _renderActionNodes(elif.actions || [], depth + 3);
        });
      }

      if (node.else_actions && node.else_actions.length) {
        html += `<div class="${pad}"><span class="kw">else</span></div>`;
        html += _renderActionNodes(node.else_actions, depth + 2);
      }

      html += `<div class="${pad}"><span class="kw">end if;</span></div>`;

    } else if (node.type === 'with_block') {
      // Matches screenshot 37
      html += `<div class="stmt-node ${pad}" data-type="with" data-id="${id}">
        <span class="stmt-num">${num}</span><span class="kw">with</span> (${node.devices?.join(', ') || ''})
      </div>`;
      html += `<div class="${pad}"><span class="kw">do</span></div>`;
      html += _renderActionNodes(node.actions || [], depth + 1);
      html += `<div class="${pad}"><span class="kw">end with;</span></div>`;

    } else {
      // Simple statements (Turn On, etc.)
      html += `<div class="stmt-node ${pad}" data-type="${node.type}" data-id="${id}">
        <span class="stmt-num">${num}</span>${_nodeLabel(node)}
      </div>`;
    }

    // Ghost insertion point after every statement
    html += `<div class="ghost-text ${pad}" data-insert="action" data-parent="${id}" data-index="${i+1}">+ add a new statement</div>`;
  });

  return html;
}
2. Wizard Flow Fix in wizard.js (Critical — Matches Screenshots 17–28)
Update the entry point for conditions to always start with the Condition vs Group choice (screenshot 17), and ensure action statements go through the full type picker first.
JavaScript// In wizard.js — improve open()
function open({ context, ...opts }) {
  // ... existing state setup

  if (context === 'condition' || context === 'trigger') {
    _renderConditionOrGroupStep();           // ← This is correct per screenshot 17
  } else if (context === 'action') {
    _renderActionTypeStep();                 // ← Full statement type picker (screenshot 28)
  }
}
Then ensure the condition wizard follows this exact sequence (from screenshots):

Condition vs Group
What to compare (device/variable picker — screenshot 18/19)
Attribute list (device-specific + Generic — screenshot 20)
Which interaction (Any/Physical/Programmatic — screenshot 21) ← Often missing in current impl
Operator list (split Conditions / Triggers — screenshot 22)
Value / Duration input (screenshot 23–25)
"Add more" chaining (screenshot 26)

Add a small helper in wizard.js:
JavaScript// After selecting device + attribute
function _renderInteractionStep() {
  _setBody(`
    <div class="wizard-step-title">Which interaction?</div>
    <div class="wizard-options-grid">
      <div class="wizard-card" data-interaction="physical">Physical</div>
      <div class="wizard-card" data-interaction="programmatic">Programmatic</div>
      <div class="wizard-card" data-interaction="any">Any</div>
    </div>
  `);
  // ... wire clicks to proceed to operator
}
3. CSS Polish (Quick Wins)
Add to frontend/css/style.css:
CSS.stmt-node { padding: 6px 12px; margin: 2px 0; border-left: 3px solid #4a90e2; }
.kw { color: #c678dd; font-weight: 600; }
.ghost-text { color: #888; font-style: italic; padding: 4px 12px; cursor: pointer; }
.ghost-text:hover { background: #2a2a2a; color: #ccc; }
.condition-inline { font-style: italic; color: #98c379; }
4. Right-Click Context Menu
Make sure the context menu (already in index.html) supports the common WebCoRE options from screenshot 4:

Copy / Cut / Duplicate / Delete / Move Up / Move Down


Implementation Priority

Fix wizard entry + condition flow (biggest "off track" issue).
Update editor rendering for if/then/else/with structure.
Add the interaction step (screenshot 21).
Test with the screenshots as ground truth.

other grok insites:
PistonCore is running fine in Docker (good), but the biggest blocker right now is the Home Assistant connection.
Quick Diagnosis from your screenshots

HA WebSocket keeps failing → "PistonCore: WebSocket gave up after 5 attempts"
This is why you see the red banner and why wizard/device features are disabled.
You're accessing it at http://192.168.1.226:7777

Immediate Fix (Try This First)

Check your Home Assistant WebSocket URL
In PistonCore, go to the top-right or settings area (or look in backend/config.py / environment variables).
Make sure the HA URL is set to:
ws://192.168.1.226:8123/api/websocket   (or wss:// if you use SSL)

Long-term better fix — Add this to your docker-compose.yml so containers can talk easily:

YAMLservices:
  pistoncore:
    ...
    environment:
      - HA_URL=http://homeassistant:8123   # or the container name
      - HA_TOKEN=your_long_lived_access_token_here
    network_mode: bridge   # or put both on same custom network

Restart both containers after changing.

Quick test: Once connected, the red banner should disappear and you’ll see real devices in the wizard.

About the Code (since you’re using Claude)
I’m happy to act as your reviewer / shortener / fixer.
Just paste any chunk of code Claude gives you (or the whole file) and I’ll:

Shorten it where possible
Make it cleaner / more reliable
Point out bugs
Make it match the WebCoRE screenshots better

referances: 
Here are smarter, lower-effort ways to gather high-quality context for the PistonCore wizard (without taking thousands of screenshots yourself):
1. Best Single Source: The Official webCoRE Wiki
This is your gold standard. It has step-by-step flows, variable types, operators, etc.
Key pages to feed Claude (or me):

https://wiki.webcore.co/Creating_your_first_piston → Full basic condition + action flow
https://wiki.webcore.co/Piston → Anatomy of statements, conditions, groups, etc.
https://wiki.webcore.co/Variable_data_types → Exact variable picker options
https://wiki.webcore.co/Expressions → How expressions work (very important for value step)
https://wiki.webcore.co/ (main page has links to Functions, etc.)

Action for you: Copy-paste the text from 2–3 of these pages into Claude with a prompt like:
"Use this as ground truth for the wizard flow in PistonCore..."
2. Community Forum Threads (Real User Examples)
Search these and paste example pistons + screenshots:

https://community.webcore.co/ (main forum)
Hubitat webCoRE threads (they often post full piston JSON or detailed steps)

3. YouTube Videos + Transcripts (Zero Screenshot Work)
Many people recorded themselves building pistons. Ask Claude to summarize a video or use a transcript tool.
Good search terms to give Claude:

“webCoRE how to create condition”
“webCoRE statement types tutorial”
“webCoRE device variable wizard”

4. Leverage Your Existing Screenshots (Smart Way)
Instead of new ones, do this once:

Upload all your current screenshots to Claude (or describe them).
Ask: "Here are the reference screenshots. Extract every possible wizard step, option list, and decision tree from them. Output as structured JSON or markdown steps."
Save that output as your permanent reference.

5. Dynamic HA-Driven Context (Best Long-Term Solution)
Since you're targeting Home Assistant, make the wizard pull real data instead of hard-coding everything:

Use your ha_client.py to fetch:
All entity domains + attributes
Supported services/commands per device type
State attributes for common entities (light, sensor, etc.)

Build capability maps (you already started this) — e.g., lights support turn_on, set_brightness, etc.
For operators: Dynamically show relevant ones based on attribute type (numeric → > < =, text → contains/is, etc.)

This way you don’t have to manually maintain “all possible HA things” — the app learns them at runtime.
6. Sample Pistons as Test Data

Ask me (or Claude) to generate 8–10 realistic piston JSON examples covering:
Simple if/then
With/Do blocks
Duration + "did not change"
Device variables, system vars ($currentEventDevice, etc.)
Else-if chains

Import them into PistonCore and use them to test wizard round-trips.


Recommended Next Move (Low Effort)

Go to https://wiki.webcore.co/Creating_your_first_piston and copy the whole page.
Paste it to Claude with:
"Update the wizard.js flow to exactly match this webCoRE behavior. Prioritize the condition wizard steps."
Do the same for the Variable_data_types page.

1. Piston Anatomy (Full from wiki)
Sections (4 types):

Settings section
Define section (variables)
Function section (reusable)
Execute section (main logic)

Statements (core building blocks):

Executive statements (do things):
Action
Do (group statements)
With / Do / End With (device context block)

Decisional statements:
If Block (if / then / else if / else / end if)
For Each Loop, While Loop, Repeat, etc. (loops — lower priority for v1)


Condition / Comparison structure:

Condition = one or more Comparisons
Condition Group = multiple Conditions joined by AND / OR / XOR
Comparison = Operator + 1–3 Operands

Operands (what you can pick in the wizard):

Physical Device + Attribute
Virtual Device
Variable (local / global)
Value (constant, can contain {expression})
Expression (full math/logic)
Argument (from triggers)

System Variables (must be in every picker):

$currentEventDevice
$previousEventDevice
$devices
$location
$now, $hour, $minute, $second, $locationMode, etc.


2. Variable Data Types (Exact & Complete List)
Dynamic (loose-typed — discouraged)
String
Boolean
Number (Integer)
Number (Decimal)
Date and Time
Date
Time
Device (can hold multiple devices)
Device Variable Initial Value Options (exact from wiki + screenshot 14):

Nothing
Physical Device(s)
Expression


3. Condition Wizard Flow (Exact Order from Wiki + Screenshots)

Condition vs Group (FIRST screen — screenshot 17)
What to compare? (screenshot 18–19)
Physical Device(s)
Virtual Device
Variable (local/global)
System Variable

Attribute list (screenshot 20)
Device-specific attributes (top)
Generic attributes section (bottom)

Which interaction? (CRITICAL — screenshot 21)
Any
Physical
Programmatic

Operator list (split into TWO sections — screenshot 22)
Conditions section
Triggers section

Right operand (Value / Variable / Expression / Argument)
Duration (only for certain operators — screenshots 23–25)
Duration value type: Value / Variable / Expression / Argument
Time unit picker (milliseconds → years)

Add or Add more (chains conditions — screenshot 26)


4. Action / Statement Wizard Flow

Statement Type Picker (screenshot 28 — 12 types total)
Device Picker (screenshot 29–31)
Virtual devices
Physical devices
Global variables
System variables ($currentEventDevice, etc.)

Command / Task Picker (screenshots 32–35)
Device-specific commands
Location commands

Parameters (level, color, etc.)
Restrictions (optional — skip for HA v1)


5. Expressions (Full Details)
How to use:

In Value fields: {expression}
In Expression fields: direct

Operands in expressions:

Literal strings, numbers
Variables ($now)
Functions (see section 7)
Device attributes: [device:attribute]
Devices: [device]

Full Operator List (from Expressions page):
Arithmetic:

+ (addition)
- (subtraction)
* (multiplication)
/ (division)
\ (integer division)
% (modulo)
** (exponential)

Bitwise:

&  ^ ~ ~& ~| ~^ << >>

Logical:

&& || ^^ ! !! !& !| !^
== != < <= > >=

Order of Operations and full logical truth table are also in the wiki.

6. Functions (Complete List from Wiki)
String functions:

concat(), contains(), endsWith(), format(), indexOf(), json(), lastIndexOf(), left(), lower(), mid(), random(), replace(), right(), startsWith(), string(), substr(), substring(), title(), upper(), text(), trim(), trimLeft()/ltrim(), trimRight()/rtrim(), urlEncode(), encodeURIComponent()

Numeric functions:

avg(), abs(), ceil()/ceiling(), decimal(), float(), floor(), max(), median(), min(), number(), power(), round(), sqr()/sqrt(), stdev(), sum(), variance()

Date and Time functions:

addDays(), addHours(), addMinutes(), addSeconds(), addWeeks(), date(), datetime(), formatDuration(), formatDateTime(), time()


7. Creating Your First Piston – Exact Tutorial Steps (Wiki)
(The basic motion-lights example shows the real wizard flow in action):

Add new piston → blank
Add statement → Add an if
Add a condition
Select Physical Device → motion sensor → attribute “motion”
Operator: “changes to” (under Triggers)
Value: “active”
Add statement under “then” → Add an action
Select device → command “Set Level…” → level 100

Updated Master Reference – With HA Realism Filter
Here's the revised maximum-detail master reference. I've added a dedicated "HA Adaptation & Limitations" section so any AI (Claude or others) always filters webCoRE features for what's actually feasible in Home Assistant.

# PistonCore Wizard Master Reference – MAX DETAIL + HA FILTER
Ground Truth: webCoRE Wiki + Screenshots + HA Constraints (April 2026)
Instruction for AI (Claude etc.):
When implementing anything from this document, always ask/consider: "Is this possible natively in Home Assistant?" If not, map it to the closest HA equivalent (services, templates, choose, input helpers, scripts, or PyScript fallback). Never promise or expose options that cannot be compiled to valid HA YAML + Jinja2.
1. HA Adaptation & Limitations (Critical)


















































webCoRE FeatureHA Equivalent / LimitationPistonCore RecommendationWith / Do / End With blockNo direct equivalent → emulate with choose or scriptUse with_block → compile to nested script or chooseModes (Day/Evening/Night)Not built-in → use input_select or HA mode helpersSkip or map to template condition"Only during these modes"Template conditionShow but compile as JinjaGlobal Variablesinput_number / input_boolean / input_text / input_datetimeMap to HA helpers + stale detection"Physical / Programmatic" interactionHA state changes are mostly unifiedShow the step but default to "Any"Advanced loops (For Each, While)Limited in native YAML → use repeat or PyScriptSupport simple cases natively, fallback for complexLocation commandsHA services (homeassistant.*, script.*, etc.)Map to service callsFull expression languageJinja2 templatesTranslate {expression} → Jinja2
Golden Rule for PistonCore:
Everything must compile to native HA automations + scripts when possible. Use PyScript only for truly unsupported complex logic.
2. Piston Anatomy (webCoRE → HA Mapping)

Define → HA input helpers (globals) + local variables in script
Execute → Automation trigger + condition + action (with choose for if/else)
If / Then / Else If / Else → choose action with multiple options
With / Do → Group actions on same device(s) using templates or repeated service calls

3. Variable Data Types (Full List – Use in Picker)
Exact webCoRE types (show all, but note HA mapping):

Dynamic
String → input_text
Boolean → input_boolean
Number (Integer) → input_number (step 1)
Number (Decimal) → input_number (step 0.01)
Date and Time → input_datetime
Date → input_datetime (date only)
Time → input_datetime (time only)
Device → Store entity_id(s) as string or list

Initial Value Options for Device Variables:

Nothing
Physical Device(s)
Expression

4. Condition Wizard – Exact Flow (with HA notes)

Condition vs Group (screenshot 17) — Keep exactly
What to compare? (screenshots 18-19)
Physical Device(s)
Variable (local/global)
System Variable ($currentEventDevice, etc.)

Attribute (screenshot 20) — Pull live from HA entity attributes
Which interaction? (screenshot 21) — Keep UI but default "Any"
Operator (screenshot 22) — Split Conditions / Triggers. HA mostly uses state triggers + template conditions.
Right operand — Value / Variable / Expression ({{ }} in HA)
Duration (screenshots 23-25) — HA for: key on state triggers
Add / Add more

5. Action / Statement Wizard – Exact Flow

Statement Type Picker (screenshot 28) — Show all 12 types, but grey out or note HA limitations
Device Picker (screenshots 29-31) — Live from HA entities + globals + system vars
Command Picker (screenshots 32-35) — This must come from HA services (light.turn_on, switch.toggle, etc.)
Parameters — Dynamic from HA service schema
Restrictions — Map to conditions

6. Full Operators (from webCoRE – filter for HA)
Conditions section (state-based):

is, is not, is one of, is not one of, is any of, etc.
changed, changed to, did not change, stays, etc.

Triggers section:

changes to, becomes, etc.

HA Mapping: Most map to state trigger + for: + template conditions.
7. System Variables (Must Include)
$currentEventDevice, $previousEventDevice, $devices, $location, $now, $hour, $minute, $second, $locationMode, etc. → Map to HA trigger data or states() calls.
8. Functions (Full List – Translate to Jinja2)
String: concat, contains, lower, upper, replace, trim, etc.
Numeric: abs, max, min, round, sqrt, etc.
Date/Time: addDays, formatDateTime, etc. → Jinja2 filters + now() + as_timestamp



For referance only needs claude review:
# PistonCore Wizard Specification

**Version:** 0.4  
**Status:** Living Document — Maximum Detail + HA Realism Filter  
**Last Updated:** April 24, 2026

This document is the **single source of truth** for the wizard.  
Read `DESIGN.md` and `FRONTEND_SPEC.md` first.

**Golden Rule (for any AI or developer):**  
For every feature, step, operator, or option:  
1. Show the **full webCoRE behavior** first.  
2. Then document the **HA adaptation / limitation**.  
3. Prefer native HA (services, templates, `choose`, input helpers). Use PyScript only as fallback.

---

## 1. HA Adaptation & Limitations (Apply to Everything)

| webCoRE Feature                    | HA Equivalent / Limitation                              | PistonCore Decision |
|------------------------------------|---------------------------------------------------------|---------------------|
| With/Do/End With block             | No direct equivalent                                    | Support in JSON, compile to repeated service calls or nested choose |
| Physical vs Programmatic interaction | Limited context tracking (requires PyScript)         | Keep wizard step but default to "Any" |
| Modes / "Only during these modes"  | No native modes                                         | Map to template conditions or input_select |
| Full expression language           | Jinja2 (`{{ }}`)                                        | Translate `{expr}` → Jinja2 |
| Advanced loops                     | `repeat` native; complex → PyScript                     | Simple native, complex fallback |
| Global Variables                   | HA Helpers (`input_*`)                                  | Full support + stale piston tracking |

---

## 2. Core Wizard Behaviors (Unchanged — Excellent)

(Keep your existing "Core Wizard Behaviors" section as-is — it's perfect.)

---

## 3. First Step — Condition or Group

(Keep your current section exactly — it matches screenshots perfectly.)

---

## 4. Triggers vs Conditions — Lightning Bolt Distinction

(Keep your current section — very well written.)

---

## 5. Which Interaction Step

(Keep your current section, but add note:)
> Default to "Any" for v1. Only enable Physical/Programmatic for PyScript pistons once context tracking is proven reliable.

---

## 6. Capability Map & Full Operator Tables

(Your existing tables are great. Expanded versions below for completeness.)

### Binary Sensors (Most Important HA Nuance)
(Keep your excellent table with device_class → friendly labels.)

### Numeric, Enum, Numeric with Position, etc.
(Your tables are solid — no major changes needed, but ensure every type from webCoRE is listed.)

### System Variables (Must Appear in Pickers)
- `$currentEventDevice`
- `$previousEventDevice`
- `$device`
- `$devices`
- `$triggerValue`
- `$previousValue`
- `$now`, `$hour`, `$minute`, `$second`, `$locationMode`, etc.

---

## 7. Action Wizard — Device Commands

(Your current section is excellent. Only minor tweak:)

**System Commands** (PistonCore-defined, not from HA services):
- Wait
- Wait for state
- Wait randomly (PyScript only)
- Set variable
- Cancel all pending tasks (PyScript only)
- Execute piston
- Control piston
- Log to console
- No operation
- Make a web request (PyScript only)
- Wake LAN device (WOL)

All other commands come live from HA service registry.

---

## 8. Wizard Internal State & Output Objects

(Your JSON examples are very good — keep them.)

---

## 9. Simple vs Advanced Mode Differences

(Your current section is perfect — keep it.)

---

## 10. Backend API Requirements for Wizard

(Your list is solid. Add one more if missing:)
- `GET /api/zones` for location operators
- `GET /api/globals` for global variables

---

## 11. Open Items / Future Work

- Interaction step feasibility (PyScript context tracking)
- Full expression editor (v2)
- Simulator / step-through debugging (v2)
- "Followed by" sequence operator (excluded from v1)

---

**This is now the authoritative spec.**  
When giving instructions to Claude, tell it:

> "Follow WIZARD_SPEC.md v0.4 exactly. Use maximum detail. Always apply the HA realism filter."

---

**What would you like next?**

1. I review the next code Claude produces for `wizard.js`
2. I generate sample piston JSON files that test all major wizard paths
3. I create a short checklist for `Notes_for_next_session.md`
4. Something else

Just say the word and we’ll keep rolling. You're in a really good place now. 🚀