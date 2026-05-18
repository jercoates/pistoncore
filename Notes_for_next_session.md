✅ Audit Complete — Spec vs Reality (as of May 2026)
Here's a clear, prioritized view of your documentation vs. the actual code state.
1. Core Spec Files Status


FileStatusHow Outdated?PriorityNotesDESIGN.mdMostly goodMediumHighCore architecture still holds. Some UI decisions have changed (globals drawer, status page flow).STATEMENT_TYPES.mdExcellentVery LowLowYour strongest doc. Renderer and wizard should match this closely.PISTON_FORMAT.mdGoodLowMediumJSON format is stable.FRONTEND_SPEC.mdOutdatedHighHighNeeds big update after editor/wizard changes.WIZARD_SPEC.mdOutdatedHighHighWizard has drifted a lot.WIZARD_REBUILD_SPEC.mdActive / UsefulMediumHighRecent audit file — still relevant.COMPILER_SPEC.mdMediumHighHighBackend compiler is ahead of this doc.AI_PROMPT_SPEC.mdVery GoodLowMediumSolid. write-a-piston.md is still placeholder.MISSING_SPECS.mdExists—MediumYou already have this — good.PROGRESS_TRACKER.mdOutdatedHighHighLast updated April. Needs refresh.SESSION_41_WIZARD_AUDIT.mdVery useful—HighGreat reference for wizard fixes.
Biggest drift areas: Wizard + Renderer + Frontend Spec.

2. Priority List (What to tackle)
Phase 1 — Visual & Import (Do this now)

Renderer: Add vertical structure lines (your #1 requested look feature)
Renderer: Better condition rendering + lightning bolts
Fix import round-trip for your existing pistons (kitchen_motion_test2 etc.)
Globals sidebar / device mapping polish

Phase 2 — Wizard Stability

Split wizard.js into smaller files (this will reduce Claude errors dramatically)
Fix condition/action commit bugs exposed by imports

Phase 3 — Backend & Polish

Full compile → deploy happy path
Status/trace/logs
Update outdated specs (FRONTEND_SPEC, COMPILER_SPEC, PROGRESS_TRACKER)


Prompt for Vertical Lines (Add as Notes_Vertical_Lines.md)
Create a new file called Notes_Vertical_Lines.md and put this in it for future Claude sessions:
Markdown# Vertical Structure Lines — WebCoRE Style

Highest visual priority.

Goal: Replicate the blue continuous vertical connector lines that show nesting depth in real WebCoRE (see reference screenshots).

These lines should appear on:
- if / then / else / end if blocks
- with / do / end with
- while, repeat, for_each, every, etc.

Technical approach ideas:
- CSS pseudo-elements (::before) with left border on nested containers
- Or background repeating linear gradient on the document
- Or per-line left margin with a thin colored div

Keep click handling, ghost points, and line numbers intact.

This is the single biggest thing making PistonCore not "feel" like WebCoRE right now.