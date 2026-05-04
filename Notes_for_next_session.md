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
random info to look through from other ais
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
