# Notes for Next Session
# Generated end of Session 5 — April 2026
# These corrections and decisions take priority over DESIGN.md v0.7, FRONTEND_SPEC v0.1, and WIZARD_SPEC v0.1
# Produce v0.8 / v0.2 updates at start of next session before any coding

---

## CONFIRMED CORRECTIONS FROM WEBCORE SCREENSHOTS

### 1. Piston List Layout — Single Column Not Two Column

FRONTEND_SPEC v0.1 shows a two-column layout with a folder sidebar on the left.
WebCoRE uses a single scrolling list with folder names as inline section headers/dividers.

Correct design:
- Single scrolling list
- Folder name in teal/colored text as a section header with piston count: "Security (12)"
- Pistons listed under their folder header
- No sidebar column
- Last run time shown on the right (time only — "08:46:25" not "10 minutes ago")
- true/false state shown inline next to piston name

Update FRONTEND_SPEC v0.2 to reflect this layout.

---

### 2. Status Page Shows Piston Script — Not Compiled Output

The status page shows the piston script in read-only form — the same visual document
the editor shows, rendered with syntax highlighting and statement numbers.

This is NOT compiled output (Groovy/YAML/PyScript). It is PistonCore's own visual format
rendered read-only. Compiled YAML/PyScript remains hidden — that decision is still correct.

Update DESIGN.md Section 7 status page and FRONTEND_SPEC to add read-only script view
to the status page below the action buttons and quick facts panels.

---

### 3. execute / end execute — Missing Keyword Wrapping Action Tree

The entire action tree is wrapped in an execute / end execute; block.
This is a top-level keyword at the same level as define and settings.

Correct document structure order:
1. Comment header (piston name, author, created, modified, build, version, piston ID)
2. settings / end settings; — only shown when non-empty, omit when empty
3. define / end define; — piston variables, only shown when variables exist
4. Section comments (user-added comments)
5. execute — starts the action tree
6. [all action statements indented inside]
7. end execute; — closes the action tree

Note on comment header: WebCoRE used a short alphanumeric import code in the header.
PistonCore uses the piston ID instead. Sharing is done via Snapshot/Backup export, not
a central-server short code. Document this deliberate divergence in DESIGN.md Section 10.

---

### 4. if/then/end if — Two Views of the Same Structure

EDITOR DISPLAY (while building):
  if
    [condition]
    {
      when true
        [statements]
      when false
        [statements]
    }

SAVED/EXPORT FORMAT (status page read-only view, green camera export):
  if
    [condition]
  then
    [statements]
  end if;

Both specs are correct for their context. Document this distinction explicitly in both
FRONTEND_SPEC and DESIGN.md.

---

### 5. repeat / until / end repeat Structure

The until condition appears at the BOTTOM of the repeat block, not the top.

  repeat
  do
    [statements]
  until
    [condition]
  end repeat;

Add until to FRONTEND_SPEC statement types and DESIGN.md Section 6.5 and Section 21.

---

### 6. AND / OR Between Conditions — Indentation

The and and or keywords appear at the same indent level as the conditions themselves.

  if
    Any of (@Smoke_Detectors)'s smoke changes to clear
    and
    All of (@Smoke_Detectors)'s smoke are clear
  then

---

### 7. Trace Numbers Are Statement Numbers Not Line Numbers

Trace numbers are statement-level numbers assigned when the piston is built.
They appear as comments: /* #1 */ /* #2 */ etc.
Each statement gets one number regardless of how many visual lines it occupies.
They are NOT document line numbers.

---

### 8. settings / end settings Block

Exists in WebCoRE but only shown when non-empty — omit entirely when empty.
Contents not yet defined for PistonCore. Do not implement until defined.
Add as an open item in DESIGN.md.

---

## NEW DESIGN DECISIONS — SESSION 5

### 9. Editor Save Pipeline — Confirmed Flow

1. Frontend validates piston has a name — if empty stop and highlight the field
2. Frontend sends piston JSON to backend via POST
3. Save button shows loading state: "Saving..."
4. Backend writes piston JSON to Docker volume
5. Backend runs Stage 1 internal validation
6. Backend returns success or failure plus any validation warnings
7. If success — navigate to status page, warnings appear in banner if any
8. If write fails — stay in editor, show error banner: "Save failed — your work is preserved. Try again."

Save does not touch HA at all. Deploy is a separate action.

---

### 10. Validation on Docker — No HA Dependency

| Stage | What runs | Where | Catches |
|---|---|---|---|
| 1 | PistonCore internal checks | Docker | Missing triggers, undefined globals, unmapped roles |
| 2 | py_compile or yamllint | Docker | Syntax errors |
| 3 | Stub mock import (PyScript) | Docker | Reference errors, basic logic |
| 4 | HA check_config (YAML, optional) | HA via companion | HA semantic errors — only if companion installed |

Stage 4 is optional. For PyScript, Stage 4 is dropped entirely.

---

### 11. Validation Rules File — Updateable Without Code Changes

Lives in /pistoncore-customize/validation-rules/
Two files: internal-checks.json and error-translations.json
Edit the file, restart the container — no code changes needed.
Community can contribute error translations via pull requests.
Full format documented in DESIGN.md v0.8.

---

### 12. Docker Volume Folder Structure — Confirmed Design

Two top-level folders. Names are self-explanatory without reading documentation.

/pistoncore-userdata/               YOUR DATA — pistons, globals, settings
  pistons/                          your piston JSON files
  globals.json                      your global variables
  device-definitions/               your custom device definitions
  config.json                       your PistonCore settings
  logs/
    pistoncore.log

/pistoncore-customize/              CUSTOMIZE PISTONCORE — templates, rules
  compiler-templates/
    yaml/
      automation.yaml.j2            Jinja2 template for simple pistons
      AI-UPDATE-GUIDE.md            paste into any AI to update YAML templates
      README.md
    pyscript/
      piston.py.j2                  Jinja2 template for complex pistons
      ha-stubs.py                   mock HA objects for Docker validation
      AI-UPDATE-GUIDE.md            paste into any AI to update PyScript templates
      README.md
  validation-rules/
    internal-checks.json            what PistonCore checks and error messages
    error-translations.json         plain English explanations for raw errors
    AI-UPDATE-GUIDE.md              paste into any AI to update validation rules
    README.md
  README.md                         explains the two folder system in plain English

Default file behavior: container ships with defaults, copies them to volume on first
launch only if files do not already exist. Container updates never overwrite user files.

---

### 13. AI-UPDATE-GUIDE.md — One Per Template Folder

Purpose: anyone pastes the guide into any AI and describes what they want changed.
The AI has everything needed to produce a valid updated file without asking questions.
Scoped to that folder only — nothing about other folders.
Makes maintenance independent of project maintainers.
Community members can update templates when HA changes, submit pull requests.

Cannot be written until compiler template system is designed — next session item.

Contents (once compiler is designed):
- What this folder contains and what it controls
- Input data format relevant to this template
- Template format and available placeholders
- Rules the output must follow
- Worked example: input to template to output
- What not to change
- How to test the change

---

## OPEN ITEMS — STILL UNRESOLVED (Blocking Coding)

1. Compiler template system — format, placeholders, how compiler walks the piston tree
   Must be designed before templates, AI guides, or compiler code can be written

2. settings / end settings block contents — research WebCoRE behavior before implementing

3. globals.json sandbox validation — requires running PyScript/HA environment to confirm
   which fallback solution works (task.executor, hass.data cache, or PyScript module)

4. AI Prompt feature redesign — copy format spec only produces generic output
   Needs friendly name context without exposing entity IDs. See DESIGN.md Section 11.

---

## SESSION 5 ACCOMPLISHMENTS

- DESIGN.md updated to v0.7 and pushed to repo
- FRONTEND_SPEC.md v0.1 written and pushed to repo
- WIZARD_SPEC.md v0.1 written and pushed to repo
- Frontend technology confirmed: vanilla JS, HTML, CSS
- Drag and drop rules defined: within-block reorder only, cut/paste for cross-block
- Statement tree data structure defined
- Wizard capability map defined — closes DESIGN.md Section 8.1
- Lightning bolt trigger/condition distinction defined
- No-trigger upgrade flow defined
- WebCoRE screenshots reviewed — 8 corrections documented above
- Editor save pipeline defined
- Docker validation approach defined — no HA dependency
- Validation rules file design defined — updateable without code changes
- Docker volume folder structure defined — two folders, self-explanatory names
- AI-UPDATE-GUIDE.md concept defined — one per template folder, community maintainable
- Compiler template format confirmed: Jinja2

---

## NEXT SESSION AGENDA — IN PRIORITY ORDER

1. Read DESIGN.md v0.7, FRONTEND_SPEC.md, WIZARD_SPEC.md, and this notes file
2. Produce DESIGN.md v0.8 and FRONTEND_SPEC v0.2 incorporating all corrections above
3. Design the compiler template system — remaining structural blocker
4. Write AI-UPDATE-GUIDE.md files once compiler is designed
5. Update CLAUDE_SESSION_PROMPT.md
6. Begin backend scaffolding if all design blockers are resolved

Do not write production code until items 3 and 4 are complete.

---

Session 5 — April 2026
Sources: WebCoRE screenshots, design review, session discussion

---

## ADDITIONAL DECISIONS — LATE SESSION 5

### 14. Revised Auto-Detection Rule — Simpler and More Accurate

The 10-condition list in DESIGN.md Section 3.1 enumerates symptoms.
Replace with three root-cause rules that are simpler and more accurate:

**If ANY of these are true → compile to PyScript:**
1. Any non-device variable is used (Text, Number, Yes/No, Date/Time)
   Device and Devices variables are the only variable types that can stay in YAML
   because they compile to entity references, not HA helpers
2. Any HA helper would be required to implement the logic
   (input_boolean, input_number, input_text, timer, etc.)
3. Any feature used is not natively supported in a standard YAML automation block
   (waits mid-piston, loops, state persistence across triggers, cancel tasks, etc.)

**YAML only when ALL of these are true:**
- No variables of any kind, OR Device/Devices variables only
- Single trigger OR multiple triggers with no state tracking between them
- Simple linear action sequence with no branching that requires helpers
- No waits, no loops, no state persistence
- Everything maps directly to native YAML automation syntax with no workarounds

In practice the vast majority of real WebCoRE pistons compile to PyScript.
YAML is for simple set-and-forget automations only.

Update DESIGN.md Section 3.1 with these three rules. Remove the 10-condition list.

---

### 15. Helper-Based YAML — Explicitly Deferred Not Excluded

Helper-based YAML compilation (using input_boolean, input_number etc to replicate
state management in YAML) is deferred to a future version — not permanently excluded.

Reason for deferral: producing correct helper-based YAML automatically is complex,
error-prone, and took significant AI-assisted effort even for a single hand-crafted example.
V1 keeps the boundary clean — no helpers, hard PyScript boundary.

Future addition path: the AI-UPDATE-GUIDE.md in the yaml compiler template folder is
exactly the mechanism for adding helper-based patterns later. A community contributor
can add this capability without touching core code.

Document this explicitly in DESIGN.md so future contributors understand the decision.

---

### 16. PyScript Compiler Is the Real Compiler — YAML Is Trivial By Comparison

Confirmed by real-world example: a piston with variables, multiple triggers, and state
tracking required extensive AI-assisted work to produce correct YAML. The equivalent
PyScript compiles naturally because:
- Variables are just Python variables — no helpers needed
- Multiple triggers are just event listeners
- OR/AND logic is just if/elif/else
- State persists naturally within a running script
- Wait is just task.sleep()
- Cancel all pending tasks is just task cancellation

The compiled PyScript structure mirrors the WebCoRE piston structure almost directly —
just Python syntax instead of WebCoRE syntax. This makes the PyScript compiler
template straightforward to design and maintain.

Design the PyScript compiler template first and completely.
The YAML compiler template is simple enough to add after.

---

### 17. Cancel All Pending Tasks — Missing From Spec

The WebCoRE screenshot shows "Cancel all pending tasks" as a statement type.
This is not in DESIGN.md Section 21 or FRONTEND_SPEC statement types.

Add to both. In PyScript this compiles to task cancellation.
In YAML this forces PyScript compilation (not native to YAML).

---

---

## WIZARD AND FEATURE FINDINGS — LATE SESSION 5 (FROM SCREENSHOTS)

### 18. Variable Types — Full WebCoRE List

Our spec has: Text, Number, Yes/No, Date/Time, Device, Devices
WebCoRE actual list:

Basic:
- Dynamic
- String (text)
- Boolean (true/false)
- Number (integer)
- Number (decimal)
- Large number (long)
- Date and Time
- Date (date only)
- Time (time only)
- Device

Advanced lists (list variant of every basic type):
- Dynamic list
- String list (text)
- Boolean list (true/false)
- Number list (integer)
- Number list (decimal)
- Large number list (long)
- Date and Time list
- Date list (date only)
- Time list (time only)

Decision for PistonCore v1:
- Implement basic types first
- Integer vs decimal separation should be kept — affects how values are handled
- Date-only and Time-only are useful and should be included
- List variants are a v2 feature unless there is strong demand
- Update DESIGN.md Section 4.3 with the corrected basic type list

---

### 19. Statement Type Picker — Full List From Screenshots

WebCoRE shows two groups when adding a statement:

Basic statements:
- If Block
- Action (with/do block)
- Timer

Advanced statements:
- Switch (pattern matching against a set of values)
- Do Block (groups statements into a single block)
- On event (executes only when certain events happen)
- For Loop (count-based iteration)
- For Each Loop (iterates over a device list)
- While Loop (condition-based loop)
- Repeat Loop (executes until condition is met)
- Break (interrupts inner loop)
- Exit (stops piston immediately)

From clipboard (paste previously copied statement)

Gaps in current PistonCore spec:
- Switch statement — not in spec
- Do Block — not in spec
- On event — not in spec
- For Loop (count-based) — not in spec (we have For Each only)
- While Loop — not in spec
- Break — not in spec
- Clipboard paste — not in spec

All of these are implementable in PyScript.

Decision: Add all to DESIGN.md Section 21 V1 feature set.
Evaluate which are truly needed for v1 vs v2 based on real user need.
Switch, While Loop, Break, and On event are likely needed for power users.
Timer may overlap with HA's own scheduler — evaluate before implementing.

---

### 20. Condition Wizard — First Step Is Condition vs Group

The condition wizard does NOT go straight to device picker.
First step presents two choices:

Condition — "a single comparison between two or more operands,
the basic building block of a decisional statement"
[Add a condition]

Group — "a collection of conditions, with a logical operator between
them, allowing for complex decisional statements"
[Add a group]

Groups are how WebCoRE handles complex AND/OR logic — they are
first-class objects, not just chained conditions.

This is completely missing from WIZARD_SPEC v0.1.
Update WIZARD_SPEC v0.2 to add this as the first wizard step.

---

### 21. Which Interaction Step — Physical vs Programmatic

After selecting a device and attribute in the condition wizard,
a step appears: "Which interaction"
Options: Any interaction / Physical interaction / Programmatic interaction

This distinguishes between a state change caused by a person physically
using a device vs a state change caused by an automation or app.

Not in WIZARD_SPEC v0.1. Add to v0.2.

HA equivalent: context.id tracking or context.parent_id on state changes.
This is implementable in PyScript — evaluate feasibility in sandbox.

---

### 22. Device Picker Sections — Action Wizard

The action device picker has five sections:
1. Virtual devices (Location — system-level commands)
2. Physical devices (full device list)
3. Local variables (device type variables defined in this piston)
4. Global variables (device type global variables)
5. System variables: $currentEventDevice, $device, $devices,
   $location, $previousEventDevice

System variables are completely missing from our spec.
These are runtime context variables injected by WebCoRE.
PistonCore equivalent needs to be defined — what context variables
does a running PyScript piston have access to?

Add system variables to DESIGN.md and WIZARD_SPEC.

---

### 23. Action Task Wizard — "Add a new task" Not "Add a new action"

The task wizard title is "Add a new task" not "Add a new action".
"With... {device}" shown at top.
"Do... Please select a command" is the only step.
Commands are filtered to the selected device plus location commands.
Add more / Add buttons work same as condition wizard.

Commands are tagged by type: emulated / custom / device / location
This tagging tells the user what kind of command it is.

---

### 24. Location Commands — Full List From Screenshots

These are system-level commands not tied to a specific device.
They appear in the command list for every device via the Location virtual device.

From screenshots (partial list — scroll was cut off):
- Append to file
- Append to fuel stream (Hubitat-specific — skip)
- Cancel all pending tasks
- Capture attributes to global store
- Capture attributes to local store
- Clear fuel stream (Hubitat-specific — skip)
- Clear piston tile (Hubitat-specific — skip)
- Delete file
- Execute piston
- Execute Rule (Hubitat-specific — skip)
- LIFX commands (integration-specific — comes from HA service registry)
- Log to console
- Make a web request
- No operation
- Read fuel stream (Hubitat-specific — skip)
- Restore attributes from global/local store
- Resume piston
- Send an IFTTT Maker event (comes from HA service registry if installed)
- Send email (comes from HA service registry if configured)
- Send notification
- Send PUSH notification
- Send SMS notification (comes from HA service registry — Twilio etc)
- Set Hubitat Safety Monitor status (Hubitat-specific — skip)
- Set location mode
- Set piston state
- Set piston tile colors/footer/text/title (Hubitat-specific — skip)
- Set variable
- Store media
- Wait for date and time
- Wait for time
- Wait randomly
- Wait
- Wake a LAN device
- Write to file

---

### 25. Action Philosophy — If HA Has a Service for It, It's Available

Key design decision confirmed this session:

PistonCore never maintains its own integration or command list.
The action wizard pulls live services from HA's service registry.
If the user has Twilio installed — SMS appears automatically.
If they have SMTP configured — email appears automatically.
If they have the mobile app — push notification appears automatically.

PistonCore only needs to define explicitly the location/system commands
that are NOT HA services — Wait, Set variable, Execute piston, etc.

This means PistonCore inherits every HA integration automatically.
No version updates needed when new integrations appear in HA.
This is stronger than WebCoRE which maintained its own integration list.

---

### 26. "Only During These Modes" — Mode Restriction on Actions

After selecting a command (e.g. Turn on), a new field appears:
"Only during these modes" with options: Day / Evening / Night / Away

This is a Location Mode restriction built into every action.
Not in our spec. This is a WebCoRE/Hubitat concept.

HA equivalent: HA has input_select or zone-based mode tracking
but no native "location mode" concept like SmartThings/Hubitat.

Decision: Do not implement "Only during these modes" as a built-in
action restriction in v1. HA users handle mode-based logic through
conditions and if blocks. If a user needs mode-based restrictions,
they add a condition checking their mode input_select.
Document this as a deliberate divergence from WebCoRE.

---

### 27. Control Another Piston — First-Class Feature

Confirmed: Starting, stopping, enabling, disabling, and triggering
other HA automations from within a piston is a first-class feature.

Implementable entirely through native HA services:
- automation.turn_on
- automation.turn_off
- automation.trigger
- automation.reload

These survive PistonCore uninstall completely — they are native HA services.

In the action wizard this should appear as:
"Control another piston" → Start / Stop / Enable / Disable / Trigger
"Control an HA automation" → same options for non-PistonCore automations

Add to DESIGN.md Section 21 and WIZARD_SPEC.

---

### 28. Independence Guarantee — Clarified

The honest independence statement for all PistonCore features:

Simple YAML pistons:
- Run forever after PistonCore uninstall ✅
- Run with HA app only ✅
- Not affected by PyScript removal ✅

Complex PyScript pistons:
- Run after PistonCore uninstall ✅ (PyScript still installed)
- Run with HA app only ✅ (PyScript still installed)
- Stop if PyScript is removed ❌

Global variables:
- Still readable by PyScript after PistonCore uninstall ✅
- Fail if PyScript is removed ❌
- globals.json file persists in HA config after uninstall ✅

HA service calls from pistons (notifications, device control etc):
- All work after PistonCore uninstall ✅
- All work with HA app only ✅
- Not affected by PyScript removal ✅ (for YAML), ❌ (for PyScript)

This table should be added to DESIGN.md Section 23.

---

### 29. Help Files for End Users — Next Design Item

Jeremy wants end user help documentation written soon.
Writing help files before coding is complete improves the design —
it forces clarity on flows that look fine in a spec but confuse users.

Suggested help file structure:
- Getting Started — what PistonCore is and isn't
- Your First Piston — step by step walkthrough
- Understanding Triggers vs Conditions
- Using Variables
- Sharing Pistons (Snapshot vs Backup)
- Troubleshooting

This can be worked on independently of coding progress.
Add to next session agenda.

---

## REVISED NEXT SESSION AGENDA — IN PRIORITY ORDER

1. Read DESIGN.md v0.7, FRONTEND_SPEC.md, WIZARD_SPEC.md, this notes file
2. Produce DESIGN.md v0.8 incorporating all corrections
3. Produce FRONTEND_SPEC.md v0.2 incorporating layout corrections
4. Produce WIZARD_SPEC.md v0.2 incorporating wizard flow corrections
5. Design the compiler template system — primary remaining blocker
6. Write AI-UPDATE-GUIDE.md files once compiler is designed
7. Begin end user help file outline
8. Update CLAUDE_SESSION_PROMPT.md
9. Begin backend scaffolding only after compiler template system is defined

---

---

## CLAUDE PROJECTS VERIFICATION FINDINGS — SESSION 5

### 30. Dry Run UI Distinction — Needs Visible UI Treatment

DESIGN.md Section 15 describes both dry run paths but FRONTEND_SPEC
does not make the distinction visible in the actual UI design.

The user must see clearly BEFORE pressing Test whether they are getting:
- A preview (YAML — shows what would be called without calling it)
- A live fire (PyScript — executes real actions on real devices)

This is not just a documentation gap — it is a UI design gap.
The Test button or a label near it must indicate which mode applies
based on the piston's compile target before the user clicks.

Example: 
- YAML piston: [▶ Test — Preview Mode]
- PyScript piston: [▶ Test — Live Fire ⚠]

Update FRONTEND_SPEC v0.2 to show this distinction in the UI.

---

### 31. Call Another Piston — Fire-and-Forget Warning Timing

WIZARD_SPEC does not define where in the wizard flow the fire-and-forget
limitation warning appears for YAML pistons calling another piston.

Current gap: a user could finish building the entire call_piston statement
before finding out it cannot wait for completion in YAML mode.

Correct behavior: the warning must appear at the moment the user selects
an operator or option that implies waiting — not at the end of the wizard.

Specifically: if the piston is YAML-bound and the user adds a Call Another
Piston statement, immediately show:
"Simple pistons trigger the called piston but cannot wait for it to finish.
To wait for completion, convert this piston to Complex (PyScript)."
[Convert and continue] [Use fire-and-forget] [Cancel]

This prompt appears before the user picks the target piston — not after.

Update WIZARD_SPEC v0.2 to show this warning timing explicitly.

---

### 32. execute / end execute — Rendering Artifact Not a Data Node

Claude Projects raised the question: does execute / end execute become
a node type in the statement tree JSON, or is it purely a rendering artifact?

Confirmed answer: RENDERING ARTIFACT ONLY. Not a data node.

The piston JSON actions array IS the execute block.
The editor renders execute / end execute; around the actions array
automatically when displaying the document.
No execute node exists in the serialized JSON.

The compiler treats the actions array as the execute block body directly.

Document this explicitly in FRONTEND_SPEC v0.2 data structure section
and in DESIGN.md Section 18 JSON format to prevent developer confusion.

---

## FINAL NEXT SESSION AGENDA — IN PRIORITY ORDER

1. Read DESIGN.md, FRONTEND_SPEC.md, WIZARD_SPEC.md, this notes file
   and permanent notes ask each ai — in that order
2. Produce DESIGN.md v0.8 incorporating all corrections (items 1-17, 30-32)
3. Produce FRONTEND_SPEC.md v0.2 incorporating all corrections
4. Produce WIZARD_SPEC.md v0.2 incorporating all corrections
5. Design the compiler template system — primary remaining blocker
6. Write AI-UPDATE-GUIDE.md files once compiler is designed
7. Begin end user help file outline
8. Update CLAUDE_SESSION_PROMPT.md
9. Poll other AIs (Grok, Gemini, Perplexity) against v0.8/v0.2/v0.2
   Do this AFTER specs are updated — not before

Do not write production code until compiler template system is designed.
Do not poll other AIs until v0.8/v0.2/v0.2 are published.

---

Session 5 complete — April 2026

---

## COMPILER TEMPLATE DESIGN APPROACH — CONFIRMED

### Breaking the Chicken and Egg Problem

The compiler template system cannot be designed abstractly because:
- The Jinja2 template needs to know what variables the compiler passes
- The compiler needs to know what the template expects
- Both depend on how the piston tree is walked
- The piston tree walk depends on which statement types exist

The solution is to work BACKWARDS from known good output — not forwards
from abstract structure.

### Session 6 Compiler Exercise — Do This BEFORE Producing v0.8

Use the driveway lights piston — already in DESIGN.md Section 18 as the
example piston JSON. It is simple enough to work with but complete enough
to reveal the full compiler structure.

Step 1 — Write valid PyScript for the driveway lights piston BY HAND
Do not use a template. Write what correct PyScript output should look like
for that specific piston. This is the target output.

Step 2 — Work backwards to the template
Given the hand-written PyScript output, identify what parts are fixed
(always the same for any piston) and what parts are variable (filled in
from piston JSON). The fixed parts become the template. The variable
parts become the placeholders.

Step 3 — Work backwards to the compiler
Given the template placeholders, determine what data the compiler needs
to provide. This reveals what the compiler must extract from the piston
JSON and how it must walk the tree to get it.

Step 4 — Define the compiler walk
Document the exact recursive function the compiler uses to walk the
statement tree and generate the template context object.

Step 5 — Verify
Feed the piston JSON through the designed compiler logic on paper.
Confirm it produces the same output as the hand-written PyScript.

Once this works for the driveway lights piston the structure is defined.
Adding new statement types (Switch, While, etc.) is just adding new cases
to the compiler walk and new blocks to the template.

### Why This Approach Works

- Starts from something concrete and correct
- Reveals the structure naturally instead of imposing it abstractly
- The AI-UPDATE-GUIDE files write themselves once the template exists
- The ha-stubs.py mock objects become obvious from the PyScript output
- The globals.json access pattern is visible in the hand-written PyScript

### This Is a Design Session — Not a Coding Session

No code is written in session 6 until this exercise is complete on paper.
The output of this exercise is a document — COMPILER_SPEC.md — that
defines the template format, the compiler walk, and the placeholder names.
That document is what gets reviewed by other AIs before any code is written.

---
