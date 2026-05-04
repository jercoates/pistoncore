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
