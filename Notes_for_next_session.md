# Notes for Next Session
# Created end of Session 18
# Add these to specs/prompt at start of next session before coding

---

## CRITICAL — Audit All Existing Code Before Any Coding

All existing code was written against the old piston_text model. Full audit needed:
- compiler.py — built against piston_text input, needs full rewrite for structured JSON
- wizard.js — partially built against old model
- editor.js — same
- ha_client.py — review for any piston format assumptions

Upload ALL code files at session start. Audit before touching anything.

---

## Compile Target Downgrade — Not Defined (Grok caught this)

Currently spec'd: user adds break → prompted to convert to PyScript → converts.
Not defined: user then removes break → does piston auto-downgrade to native script?

Decision needed before coding compile target logic:
- Option A: Auto-downgrade — compiler re-scans on every save, sets target automatically
- Option B: Manual only — user must explicitly downgrade via a button
- Option C: Prompt — offer to downgrade when complexity scan finds no PyScript features

Recommendation: Option A is cleanest — compiler owns the decision, not the user.
Add to DESIGN.md Section 3.1 before coding starts.

## From Grok Code Review — Specific Code Fixes Needed

**BASE_URL injection — CRITICAL for addon (quick fix)**
backend/main.py does not inject window.PISTONCORE_BASE_URL when serving index.html.
Frontend uses it correctly but it is never set by the backend.
Fix: inject it as a template variable when serving index.html.
Must be done before any addon ingress testing.

**Companion stubs in deploy endpoint — remove during audit**
Some places in the backend deploy endpoint still reference old companion stubs.
Find and remove during the code audit. Search for "companion" in backend files.

**Good news from Grok review**
Foundation is solid and matches specs. Not a rebuild — just updating existing
code to match the new architecture decisions from Session 18. Should go faster
than expected. Compiler, wizard, editor, ha_client all have good bones.
---

## STATEMENT_TYPES.md — Must Create Before Compiler Coding

Explicitly called out as missing in session 18. Blocker for compiler and wizard.
Defines for each statement type:
1. Full structured JSON schema (all fields, types, required vs optional)
2. Render function output (display text produced)
3. HA YAML the compiler emits

WebCoRE source in Session 14 chat (piston.module.html) is the reference.
Create this file BEFORE writing any compiler or wizard code.

---

## Canonical Piston JSON Schema File

Currently spread across DESIGN.md Section 6 and COMPILER_SPEC.md.
Should be extracted into one canonical schema file (piston-schema.json or PISTON_FORMAT.md)
that both specs reference. Prevents drift between docs.
Not a blocker for coding but creates debt if skipped.

---

## FRONTEND_SPEC.md — Needs Update Before Frontend Coding

Still references old model in places. Update to reflect:
- Wizard writes structured JSON (not text)
- Editor renders text from structured JSON using render functions
- wizard_context retired
- AI Import dialog is a new feature
Do this before any frontend/wizard coding resumes.

---

## Sharing Side — Needs Design Decision

When user exports a Snapshot, backend needs to produce piston_text from structured JSON.
Render functions currently planned as frontend-only JavaScript.
Two options:
- Backend gets its own Python render functions (duplication but clean separation)
- Export goes through a frontend render step before sending to backend

Decision needed before export/import feature is coded.

---

## From Grok Review — Lower Priority But Note

- WebSocket drop handling during wizard — preserve state on disconnect
- Ghost text insertion point recalculation after drag/cut/paste — needs detail
- Validation error contract — which errors block Deploy button vs warning only
- Orphaned file cleanup (pending_cleanup.json) — needs more detail
- No testing strategy defined for compiler output against real HA

random info to look through from other ais.  THIS IS THINGS TO GO OVER AND PULL USEFULL INFO FROM NOT DESIGN DISISTIONS.  go over carefully there is a lot of good informaion here at least i think there is.  but remember this is just copy and pasted conversations.
i have regularly asked multiple ais about this but i find it useful to keep doing this. i use claude for all programing to keep the code as clean as possible but possible fixes are good reference but i dont know if i need that now, that type of stuff is in the folder i had you skip. deeper recommendations is probably the most useful to me at this point. recomendations on how to speed up the wizard developement would be helpfull as wellGot it. Thanks for the context — you're using Claude for heavy lifting on clean code (smart), and you want deeper strategic recommendations rather than tactical code fixes right now. Here's focused advice tailored to where you are.
Overall Strategy Recommendation
You're in a good spot: core structure exists, editor + basic wizard are moving, compiler skeleton is there. The biggest risk isn't technical skill — it's scope creep and wizard complexity slowing you down. The wizard is the hardest and most important part.
Core Philosophy Adjustment:

Prioritize "happy path" first — Get one full end-to-end simple piston (trigger → condition → action → deploy → test) working perfectly before adding advanced features.
Make the wizard dumber/faster in the short term. You can refine it later.

Deeper Recommendations — Wizard Development
The wizard is your biggest time sink. Here's how to accelerate it without sacrificing quality:

Narrow Scope Ruthlessly for v1
Finish Condition Wizard + basic if block first (you're close).
Then do Action Wizard for the most common cases only: with/do service calls, set_variable, wait, log_message.
Defer: full groups, advanced aggregation, on_event, TEP/TCP cog, system variables, expressions, multi-device "Any/All" edge cases.

Speed Techniques (Practical)
Step-by-step wizard as a state machine — Have a single currentStep + wizardState object. Each step is a function that renders the UI and returns next step ID. This is much easier to debug than deeply nested modals.
Backend-driven steps — Let the backend return the next possible options based on current wizard state. Reduces frontend logic.
Reuse components aggressively:
One Device Picker component (used everywhere).
One Operator Picker (with ⚡ trigger vs condition split).
One Value Input renderer (based on attribute_type).

Plain English sentence builder — Maintain a simple template array in wizard state and update it on every change. Don't over-engineer this.
Fake it until you make it — For early testing, hardcode some common device capabilities in frontend so you can iterate wizard UI without waiting on real HA responses.

Wizard Data Flow Optimization
Cache device capabilities aggressively (backend + frontend).
Make device picker search fast (local filter after initial load).
Use debounce on capability fetches.

Testing Workflow That Speeds You Up
Create 5–6 "golden" test pistons (simple light on motion, time-based, etc.).
After any wizard change, import one and verify the rendered document + compiled output.
Use your chicken-lights-lumen.piston example as regression test.


Broader Project Recommendations
Prioritization Order (Next 2–4 Weeks):

BASE_URL + Ingress readiness (addon blocker)
Full Save → Deploy → Test roundtrip for a simple piston
Action wizard (basic service calls)
Status page + logs (makes testing rewarding)
Polish editor (drag, context menu, ghost text reliability)

Risk Management

Document known limitations openly in README (e.g., "Complex pistons require PyScript", "Some WebCoRE patterns need PyScript").
Add a "Limitations vs WebCoRE" section — manages user expectations.
Keep Notes_for_next_session.md religiously updated — it's clearly helping you.

Workflow Tip
Since you vibe code with Claude:

Give Claude very narrow, concrete prompts: "Implement only the device picker panel as described in lines X-Y of WIZARD_SPEC.md using existing patterns in wizard.js"
After major features, ask for a cleanup pass focused on consistency.

You're not hitting your limits — you're hitting the natural difficulty curve of building something this ambitious. The fact that you're regularly cross-checking with multiple AIs (including this) is exactly why this project has stayed coherent.
The wizard will feel painful until the first 3–4 statement types are fully working end-to-end. Once that muscle memory is built, the rest goes faster.
more from grok:
Prompt for Claude:
We are working on PistonCore. The editor needs to correctly handle if blocks to match WebCoRE behavior.
Current Problem (see attached screenshot):
Left side = real WebCoRE (correct)
Right side = PistonCore (broken)
In PistonCore:

When adding an if statement, it is not creating the proper block structure.
It incorrectly shows only when instead of if + then / when true / when false.
The structure is malformed.
I cannot easily delete or fix the incorrect statement.

Requirements (match FRONTEND_SPEC.md and WIZARD_SPEC.md exactly):

When the user adds an if block (via wizard or ghost text), it must create a proper structured if statement with:
if line
Condition area
then branch with ghost text
Support for else if / else
Proper end if; closing
Correct indentation and visual { } braces where appropriate

The editor must support:
Editing existing if blocks
Deleting an entire if block (including all branches)
Adding statements inside then / else branches
Ghost text insertion points inside blocks

Fix the underlying tree model / rendering so that malformed states like the one in the screenshot cannot be created, or can be easily cleaned up.

Key files to focus on:

frontend/js/editor.js (main rendering and tree logic)
frontend/js/wizard.js (how it inserts if blocks)
Any shared statement rendering or block handling code

Please analyze the current implementation, identify why if blocks are rendering incorrectly (especially the only when bug), and provide a clean fix with minimal changes to existing code style. Prioritize making basic if creation + editing + deletion work reliably.
Use the attached screenshot as reference for the desired visual structure.

You can paste this directly. It gives Claude clear context, references the specs, points to the right files, and focuses on the exact visual/functional mismatch you're seeing.
Would you like me to adjust anything in the prompt before you use it? (e.g. make it more narrow, add specific JSON structure details, etc.)

on front end choice from grok:
Is There a "Better" Way?
For this specific project, no — vanilla is still the best choice. But here are realistic alternatives ranked:

ApproachProsConsRecommendationVanilla JS (current)Lightweight, no build, full control, matches specMore manual workStick with itPreact or petite-vueTiny, close to vanilla, better state/reactivityAdds small dependency + learningOnly if pain gets too highSvelteExcellent for this kind of UIRequires build step → breaks addon simplicityNot worth itReactGreat component modelHeavy, build step, overkillStrongly avoid
My Recommendation
Stay with vanilla, but improve your architecture slightly:

Strengthen the core abstractions in editor.js:
Have a clear Statement class or well-defined render functions per type.
Better tree traversal / insertion / deletion helpers.

Consider a very light state management helper (optional) — something like a tiny event bus or just better separation between model + view.
Keep the code clean (you're already doing this well with Claude).

Bottom line: Your approach is correct for the goals of the project. The problems you're hitting are normal complexity for a WebCoRE-style visual editor — not because vanilla was the wrong choice.
The if block bug you showed is fixable within vanilla. It's mostly about tightening the tree model and render logic.

Next from Grok:
Prompt for Claude:
We are working on the PistonCore editor in vanilla JS.
Current Issue:
Even if a statement was inserted in the wrong place, the delete functionality is not working. Users cannot remove incorrect or unwanted statements/blocks. This is a major usability blocker.
From the screenshot:

There is a malformed statement that should be an if block but isn't.
Delete button/context menu does not successfully remove it.

Task:
Focus on making delete robust and reliable for all statement types, especially blocks (if, with, repeat, etc.).
Please:

Review the current delete logic in editor.js (and any related files).
Identify why delete is failing on blocks or nested statements.
Provide a clean, robust implementation for:
Deleting a single statement
Deleting an entire block (including all child statements)
Proper cleanup of the tree model after deletion
Updating the UI immediately after delete

Add safeguards so malformed states are easier to recover from.

Requirements:

Stay vanilla JS
Keep existing code style
Make delete work from both button and right-click context menu
Handle edge cases (deleting last statement in a branch, deleting root-level statements, etc.)

High Priority Architecture Note:
Check / strengthen the underlying statement tree model and block handling (especially if blocks, nesting, parent/child relationships, delete, and insertion points) before going much deeper on the wizard.
This is currently the foundation everything else depends on.

from gemini conversation:
you missed a key thing im doing both in v1. v2 is a possible built in automation engine in case pyscript doesnt keep being updated.

Ah, that’s a crucial distinction. You're building dual-path compilation right out of the gate for V1. That is a much smarter "insurance policy" for the project.

By having the compiler target both Native HA YAML and PyScript simultaneously, you aren't just bridging a gap—you're future-proofing. If a user wants 100% native stability, they take the YAML path. If they need the "webCoRE magic" that HA can't handle natively, they take the PyScript path. And if PyScript ever goes "stale," your V2 engine is already halfway there because you've been practicing the native translation all along.

Since the Wizard is your current focus, here is how that "Dual-Path" strategy changes the JSON cleanup you're doing with Claude:

1. The "Capability Flag" in the JSON
Since the Wizard doesn't know (and the user shouldn't care) which engine will run the piston, the JSON needs to be "engine-agnostic."

The Strategy: As the Wizard builds the JSON, it should silently flag blocks that require PyScript.

Example: A simple IF light is on THEN turn off stays "Green" (YAML compatible). A loop with a break or a complex task cancellation gets flagged "Yellow" (Requires PyScript).

The Benefit: This allows your UI to eventually tell the user: "This piston is 100% native HA compatible" or "This piston requires PyScript for complex logic."

2. Standardized Service Calls
Since you're doing both paths, the way the Wizard saves an Action is the most likely spot for a mismatch.

The Check: Ensure the JSON saves the "Action" in the standard HA domain.service format (e.g., light.turn_on).

The Logic:

YAML Path: The compiler writes a standard - service: light.turn_on.

PyScript Path: The compiler writes light.turn_on(entity_id="...").

If the JSON is clean, the same Wizard output feeds both "contractors" (the YAML writer and the PyScript writer) perfectly.

3. The "State" Sync Problem
If a piston runs in PyScript, it might handle variables differently than an HA native automation.

The Fallout: If you switch a piston from PyScript to YAML later, will it still "remember" its variables?

The Fix: Have Claude ensure that any Variable defined in the Wizard corresponds to a real or virtual "helper" that both engines can see. This keeps the data consistent regardless of which engine is driving the car.

The "V2" Safety Net
By framing V2 as a "possible built-in engine," you're essentially saying: "I'm going to follow the HA rules as much as possible, but I'm keeping the Python power in my back pocket." Your next prompt for the JSON cleanup should be:

"We are building for two targets in V1: Native HA YAML and PyScript. The JSON we create must contain all the metadata needed for both. Look at the WIZARD_SPEC.md and for every condition, identify if it is 'Native Compatible' or 'PyScript Only.' Make sure the JSON structure supports both paths without losing information."

How is the Wizard handling the "Variable" creation right now? Is it just naming them (e.g., "my_timer"), or is it asking the user to pick a type like string, number, or boolean? Getting those types locked down in the JSON is what makes the "Dual-Path" compilation actually work.

im having claude build a decision tree that flags and notifies the user that it has to use pyscript to make it work. before launch i will have a first use screen come up with all the disclaimers about pyscript and any other possible complications that may bother the end users so i can hopefully not get the what the hell messages or problems from users.

Using a decision tree to flag the "PyScript boundary" is the right move for transparency. In the Home Assistant community, users are generally okay with third-party tools as long as they know why they are using them and what happens if that tool goes away.

Here is how you can structure that first-use screen and the decision tree notifications to keep the "what the hell" messages to a minimum.

1. The Decision Tree Logic
Claude should flag the PyScript requirement based on "Complexity Triggers." If the piston contains any of the following, the UI should immediately show a small icon (like a Python logo) or a toast notification.

Feature	Why it triggers PyScript	UI Notification Text
Nested Loops	HA YAML doesn't support "Break" or "Continue" in loops easily.	"Complex loop detected: requires PyScript for execution."
Variable Math	Complex expressions (e.g., (a + b) / c) are messy in Jinja2.	"Advanced math used: switching to PyScript for accuracy."
Wait for Change	Tracking if a state stays the same after an automation starts.	"Temporal logic detected: PyScript required for state tracking."
Custom Persistence	Variables that need to survive a restart without a Helper.	"Advanced variables: using PyScript for state memory."
2. The "First Use" Disclaimer Screen
Since you aren't a coder, you want to frame this as a "Power User Choice." Here is a breakdown of what that screen should cover to protect you and inform them:

The "Why": Explain that PistonCore is a translator. It speaks "Native HA" for simple things and "PyScript" for the heavy lifting.

The Dependency: Clearly state that PyScript is a HACS integration. If they don't have it, complex pistons won't run.

The "No Lock-in" Promise: Emphasize that PistonCore compiles to these files. If they delete PistonCore, their automations keep running (as long as PyScript stays).

The Stability Warning: "While we strive for 100% reliability, complex Python logic can occasionally behave differently than native YAML. Use for non-critical systems first."

3. The "Silent Guardrail"
To help with the cleanup fallout you mentioned earlier, have Claude add a "YAML-Only Mode" toggle in the settings.

If toggled ON: The Wizard will grey out or hide any options that would force a PyScript dependency.

This is perfect for "purist" users who refuse to use third-party engines but still want the WebCoRE editor feel.

Pro-Tip for the Cleanup:
Since you’re managing the "fallout" of the JSON changes, ensure the decision tree is metadata-driven. This means the "flag" shouldn't be hardcoded in the JavaScript. Instead, the JSON for a loop block should just have a property like "requiresEngine": "pyscript".

This way, if you eventually build that "V2 built-in engine," you just update the metadata from "pyscript" to "v2" and the UI handles the change automatically without you having to touch the decision tree code again.

Are you planning to include a "Check for PyScript" button on that first-use screen to verify they actually have the integration installed? That’s a great way to catch problems before they even write their first piston.

from perplexity:
My overall take: this is a genuinely strong project idea with a real gap in the Home Assistant ecosystem, and your biggest advantage is that the architecture is opinionated in the right places. The biggest risk is not the concept — it’s execution complexity around the editor/wizard/tree model, cross-target compilation, and the long tail of Home Assistant edge cases that only show up under real installs and long-running automations.

Overall take
The core concept is solid because it solves a real pain point: Home Assistant is powerful, but many users still want a WebCoRE-style visual logic builder that compiles into durable HA-native artifacts instead of creating hard lock-in to a proprietary runtime. The decision to make structured JSON the source of truth, keep the frontend away from HA directly, and use UUID-based artifact ownership gives the project a cleaner foundation than many hobby-grade automation tools ever get.

I also think the “hybrid forever” stance is smart: simple pistons stay native YAML, complex ones use PyScript, and the JSON model remains stable across targets. That is a better long-term posture than forcing everything through a custom runtime too early.

What looks especially strong
Clear product identity: a visual automation builder, not a platform clone.

Strong source-of-truth model: structured JSON drives editor, export, and compiler.

Good security boundary: backend-only HA access, no token leakage to browser.

Good safety model: managed file signatures, owned directories only, no touching unrelated HA files.

Good future-proofing: versioned templates and external compile-boundary data instead of hardcoded assumptions.

Biggest risks
Editor/tree integrity
Your hardest problem is probably not compilation — it is making the editor’s internal tree impossible to corrupt. The notes already show malformed if blocks, deletion failures, and insertion-point issues, which means tree operations are still a foundational risk. If the editor can create invalid intermediate states, every downstream layer suffers: rendering, wizard edit flows, validation, compile target detection, and export/import all become fragile.

My blunt take: until statement insertion, deletion, branch ownership, and re-rendering are rock solid, you should treat most wizard expansion as dangerous scope.

Spec drift
You already know this one, but it is still the top project-management risk. DESIGN.md is authoritative, while COMPILER_SPEC.md is explicitly described as stale in parts, and the notes also say old code still assumes the retired pistontext model. That combination creates a hidden trap where implementation can become “locally clean but globally wrong” if coding continues before a schema and statement reference are frozen.

Dual-target semantic drift
The native-YAML/PyScript split is smart, but it creates a subtle risk: two pistons that look identical in the UI may not behave identically once compiled to different runtimes. Variable timing, loop behavior, waits, context tracking, async task cancellation, and “call another piston and wait” are all places where users will assume one mental model while HA or PyScript behave differently.

That means the problem is not just target selection; it is target equivalence. You will eventually need a list of “same UI, slightly different runtime semantics” and explicit user-facing warnings for them.

Important problems not fully covered
Migration and drift after HA changes
You cover HA versioned templates well, but less attention is given to what happens when a piston that compiled fine last month now compiles differently because HA changed semantics rather than just syntax. Template versioning helps formatting and schema churn, but not necessarily behavior drift, especially around waits, triggers, reload timing, and numeric state quirks.

Deterministic round-trip behavior
The docs strongly define structured JSON as truth, but there is still a practical gap around whether every user-visible editor structure can be re-rendered, exported, re-imported, and compiled without semantic loss. The notes already flag the sharing/export side because render functions may exist only in frontend JS right now, which can create backend/frontend drift later.

Concurrency and race conditions
The docs mention global helper race conditions as still unsolved, and I think this is a bigger risk than it first appears. Once multiple pistons deploy, update globals, call each other, or are tested repeatedly during development, you can get odd state races that users will experience as “sometimes wrong” rather than “broken every time,” which is the hardest class of bug to debug.

Long-running automation lifecycle
The limitations doc calls out long waits and runtime/resource issues as not yet handled. That matters a lot because users drawn to WebCoRE-like tools are exactly the users who will build “turn on at sunset, wait until bedtime, then resume if…” style automations that live for hours.

If those flows become flaky under HA native scripts, user trust will drop fast, even if the editor is excellent.

Multi-entity device ambiguity
The wizard depends on mapping user-friendly devices to underlying entity capabilities, but HA’s model often splits one physical device into many entities. That means users may think they selected “the front door sensor,” while the compiler actually needed a particular contact entity, battery entity, or event entity, and picking the wrong one will look like wizard unreliability, not HA weirdness.

Error UX after deploy failures
You already note that HA reload can fail silently or slowly, and that the old version may stay active. The not-fully-covered problem is user mental model: many users will assume “I clicked deploy, so the new logic is live,” and may never realize they are still running yesterday’s version unless the UI is extremely explicit.

Test safety and user trust
The live-fire warning is good, but I think accidental side effects will still be a bigger support burden than it looks on paper. Users testing locks, sirens, TTS speakers, garage doors, and HVAC automations will remember surprises more than architectural elegance.

A future safe-test mode or action-level suppression mode would probably pay off heavily, even if it is imperfect.

The one thing I think you should add
You need a canonical semantic contract document, not just schema docs. Right now the repo clearly wants:

DESIGN.md for architecture,

WIZARD_SPEC.md for UI flow,

FRONTEND_SPEC.md for implementation,

COMPILER_SPEC.md for output.

But what is still missing is one short, brutal “truth table” style doc that says:

statement type,

valid JSON shape,

valid editor render,

native target behavior,

PyScript target behavior,

downgrade/upgrade rules,

warnings shown to user.

The notes already point toward STATEMENTTYPES.md, and I think that is exactly right. Without that, drift will keep coming back.

Strategic advice
Build around a golden path
Get one complete path perfect:

create piston,

add trigger,

add condition,

add one action,

save,

compile,

deploy,

test,

trace.

If that flow is beautiful and dependable, the project will feel real very quickly.

Freeze the internal model before broadening the wizard
The notes already imply this, and I agree strongly: lock the statement tree and canonical schema before adding more statement types or advanced wizard paths. Fancy wizard logic on top of unstable data structures will waste huge amounts of time.

Treat HA behavior validation as a product feature
Your docs already say assumptions must be tested against real HA behavior before spec or code. Keep doing that, because this project is unusually exposed to “docs say yes, runtime says maybe” problems in HA.

Bottom line
My honest take is that PistonCore has the bones of a very compelling project, not just a neat side tool. The strongest parts are the product vision, source-of-truth model, file ownership/safety rules, and the decision to compile to durable HA artifacts instead of trapping users in your app.

The biggest danger is that the UI/editor/wizard layer becomes a complexity sink before the tree model, schema contract, and cross-target semantics are nailed down. If you keep scope tight, validate HA behavior relentlessly, and create one canonical statement contract file, I think this project has a very real chance to become something people in Home Assistant actually adopt.

more from perplexity:

do you see any more possible missed problems that are not in the notes. i wish it whas easier for you to see the code but i would have to pay to have you look at that as well.
Completed 3 steps
Yes — I do see a few likely missed problems that are not clearly captured in your notes, and these are the kinds of things that can bite later because they sit in the seams between specs rather than inside one obvious bug.

Likely missed issues
localStorage vs sandbox rule
Your website/app platform rules say sandboxed iframes block localStorage, but the frontend spec still says Simple/Advanced mode and unsaved work should be preserved in local browser storage. That is a direct architectural mismatch, not just a wording issue.

If that remains unresolved, you can end up with editor state behavior that works in one environment and silently fails in another, especially under addon ingress or embedded contexts. I would explicitly decide on one persistence policy now: in-memory only, backend draft save, or best-effort browser storage with graceful fallback.

Render-path contradiction
The notes already call out the export/share render decision, but there is a deeper contradiction: DESIGN says render functions live entirely in the frontend, then also says backend uses that same render logic for Snapshot export. Those two claims cannot both be literally true in a vanilla JS + Python backend architecture unless you duplicate logic or define a canonical shared renderer contract.

This is bigger than export formatting, because if editor text, status-page text, snapshot text, and AI-import expectations drift even slightly, users will start seeing “same piston, different sentence” bugs. I would treat this as a source-of-truth problem, not just an export feature choice.

Spec drift on compile target UX
DESIGN says compile target auto-detection is compiler-owned and the user never chooses, while COMPILER_SPEC still includes “Convert one click” language that sounds like a user-driven transition flow. That is subtle, but it will cause frontend behavior drift if Claude implements from one doc and not the other.

I’d lock one rule: either compile target is purely derived state, or it is a persisted user-visible state with prompts. Right now the docs read like both.

Wizard-specific risks
Condition tree and trigger tree may be under-modeled
The notes correctly focus on malformed if blocks and delete behavior, but I think the larger risk is that triggers, conditions, and groups are still described partly as document rendering concepts and partly as JSON logic concepts. That often creates editor code that “looks right” before it is structurally safe.

If I were trying to avoid a future rewrite, I would formalize one invariant: every edit operation must act on an AST-like structure first, and rendering is a pure projection. If renderable branch labels like when true, when false, then, and end if are ever treated as quasi-nodes, you will keep getting insertion/delete bugs.

Group conditions need a canonical model now
The wizard spec includes “Condition” vs “Add a group,” plus arrays with groupoperator, aggregation, and nested block behavior, but I do not see a clearly locked canonical JSON shape for nested condition groups. That means the hardest part of the condition builder may still be underdefined even if basic single-condition flows work.

That is exactly the kind of thing that looks fine for happy-path demos and then explodes when you add AND/OR, nested groups, promotion of conditions to triggers, or editing an existing complex condition.

Backend/data risks
Background compile race conditions
The frontend spec says background compilation runs on a 2-second debounce and never blocks the UI, while save/deploy are separate operations and websocket reconnects can interrupt capability loading. I do not see a clearly defined job-cancellation/versioning rule for overlapping compile requests against a rapidly changing piston.

Without a revision token or monotonic edit version, you risk stale compile results overwriting fresh status indicators, especially when users type fast, drag statements, or reconnect after disconnect. That is the kind of bug users experience as “it said compiled, but for the wrong version.”

Missing-device handling may conflict with “warn but never block”
DESIGN says pistons never fail to compile because a device is missing and users are warned, not blocked. But some actions and triggers can become semantically meaningless if a required role disappears, especially for single-device triggers or service-call actions.

So there is a hidden policy question: what is the compiler supposed to emit when a required trigger role is missing but deployment is still allowed? Warn-only is clean philosophically, but not always operationally clean. I’d define per-statement fallback behavior before implementation.

Global helper race conditions are broader than deployment
HA_LIMITATIONS already mentions simultaneous deploy races for globals, but the design also says globals are read live by compiled pistons and tracked through globalsindex.json. That implies rename, delete, type-change, and helper recreation semantics could cause stale references even outside deploy collisions.

I would add one more explicit rule: global variables need immutable internal IDs and a compatibility policy for type changes, not just rename handling. Parts of that are implied, but I’d make failure behavior explicit.

Product risks
README may over-promise current state
README says core editor and wizard are working and highlights several functioning features, while the notes still describe foundational wizard/editor tree issues and old-model audit risk. That can create expectation mismatch for contributors or early testers.

That is not a code bug, but it is a real project risk because outside feedback quality drops when people assume more is stable than actually is. Tightening the “works today” wording could reduce noise and bad AI suggestions.

“No code, no lock-in” needs nuance around PyScript
The README pitch is strong, but the project also says complex pistons depend on PyScript for now, permanently on Docker. That is mostly explained elsewhere, but the top-level framing may still cause user surprise if they discover runtime dependency details later.

You already plan disclaimers, which is good. I’d just make sure the first-use language and README headline are aligned enough that users do not feel bait-and-switched.

The two I’d prioritize first
If you want the highest-value missed problems, I’d put these at the top:

State persistence contradiction: localStorage/browser storage vs sandbox/no-storage rule.

Canonical renderer/source-of-truth problem: frontend render functions vs backend export/import parity.

Those are the kind of issues that create a lot of weird secondary bugs and AI churn because they are not one broken function — they are unresolved contracts.
more from perplexity:
i am having issues with claude seeing the limitiations of what is actually working if its there it works. the not failing with missing devices is for pistions that have multiple devises called in a action or statement not just one. if it is one that only calls for a single it should shut down. some of these background issues are not resaulved because more things have to be dicided on or i have just not got the development there to see how it needs to work.
Completed 2 steps
Yes — your clarification means the current wording in the design docs is too broad, and that broad rule will cause Claude to assume behavior is already decided when it is not. The docs currently say a piston “never stops running because a device is missing” and “always runs with whatever devices are available,” which reads like a universal rule, not a scoped rule for multi-device actions or conditions only.

What needs clarified
Your intended rule is narrower: graceful degradation should apply when a single action or statement references multiple devices and one or more are missing, but a statement that depends on exactly one required device should fail that piston path rather than silently continuing. That is not how the current design text reads today, so Claude is likely following the document literally instead of your intent.

Where the conflict is
The strongest source of confusion is DESIGN.md Section 15.6, which says pistons always run with whatever devices are available and that a piston never stops running because a device is missing. In parallel, the wizard and design docs already distinguish between single-device and multi-device constructs through aggregation and multi-device comparison handling, so your narrower rule fits the existing architecture, but it has not been written as the governing rule yet.

Better rule to adopt
I would rewrite the missing-device rule as:

Multi-device statement: continue with remaining valid devices, but warn.

Single-device required statement: treat as invalid at runtime or deploy-time for that statement, and stop that branch or piston according to the statement type.

Trigger using a missing single device: that trigger is non-functional and should surface clearly as broken.

Action targeting one missing device: do not no-op silently; mark failure in logs/status.

Why this is better
That gives you resilience where it helps, like “any of these four doors” still working if one sensor is gone, without masking real breakage when a piston depends on one specific lock, switch, or sensor. It also matches the existing multi-device aggregation model in the wizard spec, which already treats grouped devices as a special case rather than the same thing as a single-device statement.

Claude-facing wording
A good instruction to add near the top of the spec set would be:

Missing-device handling is scoped, not universal.
If a statement references multiple devices in one action or condition, missing devices are ignored and the statement executes against remaining valid devices.
If a statement references exactly one required device, that statement must not silently continue; it should fail clearly and stop the relevant branch/piston behavior as defined.
Do not generalize graceful degradation from multi-device statements to single-device statements.

That would directly counter the overly broad language Claude is currently reading from the design docs. The need to make unresolved areas explicit is also supported by your own notes, which already say some design decisions remain undefined and must be decided before coding.

Unresolved areas to mark
You also mentioned that some background issues are not resolved because more decisions are still needed or development has not reached the point where the right behavior is obvious. That matches your notes file, which already lists multiple undefined or deferred decisions, including compile-target downgrade behavior and other architectural gaps that should be decided before coding resumes.

My recommendation
Before asking Claude to implement more missing-device logic, update DESIGN.md and probably HA_LIMITATIONS.md with an explicit split between:

single-device required semantics,

multi-device degraded semantics,

deploy-time warning behavior,

runtime log behavior,

UI messaging on the status page.

Suggested spec language
You could add something like this:

Single-device references: If a statement, trigger, condition, or action depends on one specific device and that device is missing, it must not silently continue as if successful. Show warning/error state and stop the affected execution path.

Multi-device references: If a single statement references multiple devices, missing devices are removed from the effective device set and execution continues against the remaining devices.

User communication: The editor and status page must tell the user whether the piston is degraded-but-functional versus broken due to a missing required device.
