# Notes for Next Session — Session 13

---

## Process Changes Starting This Session

### After every code delivery, Claude will:
1. Give you a plain-English yes/no checklist of what to test in the browser
2. Be honest about what is NOT done yet — no hiding gaps
3. Break the work into one small goal at a time, not everything at once

### You do not need to:
- Read the code files
- Understand the error messages
- Write long explanations of what's wrong

### You DO need to:
- Run the visual test checklist from PROGRESS_TRACKER.md after each deploy
- Tell Claude which checklist items fail — even just "wizard step 1 no" is enough
- Send a screenshot if something looks wrong — one screenshot is worth a paragraph

### Grok as second opinion:
If something feels off, you can paste the latest wizard.js or editor.js to Grok and ask:
"Does this match WIZARD_SPEC.md and the WebCoRE screenshots I showed you?"
Paste Grok's answer to Claude. Claude should not grade its own work.

---

## Priority Order for Session 13

1. **Wizard rewrite** — the only priority
   - Upload wizard_reference_screenshots.zip at start of session
   - Claude reads WIZARD_SCREENSHOTS_NOTES.md before writing any code
   - One step at a time: Condition vs Group → device picker → operators → value input
   - After each step: Claude gives you the yes/no test checklist for that step only

2. **README.md update** — we are actively coding now, the readme is stale
   - Should reflect: what the project is, current status, how to run it on Unraid
   - Remove any "planned" language for things that are already built

3. **DESIGN.md discrepancy review** — several decisions changed from the original spec
   - See "Known Discrepancies" section in PROGRESS_TRACKER.md
   - Claude should flag any other gaps it finds while working
   - Do NOT rewrite DESIGN.md during wizard session — flag and list, fix separately

---

## Do NOT Do in Session 13 (unless wizard is fully working)

- Home page layout changes
- Bulk export zip feature
- Global variable create/edit flow
- Status page tweaks
- Any backend work
- Updating FRONTEND_SPEC.md or WIZARD_SPEC.md (wait until wizard works in browser)

---

## Files to Have Ready for Session 13

- Paste: CLAUDE_SESSION_PROMPT.md (updated version from Session 12)
- Upload: wizard_reference_screenshots.zip
- Upload: these notes (Notes_for_next_session.md)
- Optional: screenshot of current editor in browser so Claude can see current state

---

## Quick Reminders — Decisions Made Session 12

- Dark mode toggle = keep, working
- Globals button in header = keep on every page
- Folder field in editor = keep even though WebCoRE didn't have it
- Save → status page (clean save only — warnings keep you in editor)
- New piston → editor directly → save → status page
- Cancel new piston = delete it, go to list
- Cancel existing piston = go to status page
- No compile target badge — PyScript warning bar instead
- No Deploy button on status page — trace screen only (not built yet)
- .piston files ARE the JSON files
- Bulk export = zip of all JSONs (not built yet)
- Grok WIZARD_SPEC v0.4 = reference only, not authoritative
