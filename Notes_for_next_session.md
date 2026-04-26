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

---

## Feature Idea — Virtual Test Devices in Companion HA App

**The problem:** When building a piston that triggers on smoke detected, motion, contact open, etc. 
you need a way to manually fire that trigger for testing — just like Hubitat lets you go to a 
virtual device page and press "smoke detected" to trigger pistons.

**HA does not have this natively.** Helpers are variables not devices. Template entities require 
config.yaml edits. Neither is the same as a Hubitat virtual device.

**The solution — add to the companion HA integration:**
- Register virtual devices of any type through HA's entity registry
- Types needed: virtual switch, virtual smoke detector, virtual motion sensor, 
  virtual contact sensor, virtual presence sensor, virtual lux sensor
- Each virtual device appears in HA as a real entity — automations, pistons, 
  and HA itself treat it exactly like a physical device
- PistonCore UI gets a "Trigger" button next to each virtual device — pressing it 
  fires the device state change (smoke detected, motion active, contact open, etc.)
- This lets users test pistons without owning the physical hardware

**Why this approach is correct:**
- Registers through HA's entity registry — does NOT touch config.yaml or internal HA structure
- Companion app owns and manages these entities — clean removal when companion is uninstalled
- Fills a real gap that HA is missing — useful to ALL HA users not just PistonCore users
- Matches Jeremy's goal: enhance HA without touching its internals

**Priority:** Add to companion app spec when we get there. Not blocking current work.

---

## Future Distribution Directions — Windows App + Cloud Hosting

### Windows App (post-launch)
Many people who want WebCoRE-style automation for HA don't know Docker and don't want to learn.
A Windows app version removes that barrier entirely.

**Approach:** PyInstaller bundles the Python backend + frontend into a single .exe or installer.
- User double-clicks, local web server starts, browser opens automatically
- Files save to C:\Users\<username>\Documents\PistonCore\ (pistons, globals, config)
- Upgrading is clean — new app version, same Documents folder, all pistons preserved
- Bulk export zip makes moving to a new PC easy
- storage.py already uses a single path config variable — changing to Windows path is one line
- Inno Setup or NSIS wraps it into a proper installer with Start Menu shortcut + uninstaller
- Estimated work: 2-3 days once main project is done

**Note:** App still needs to connect to HA over the network — this only removes the Docker
barrier for running PistonCore itself, not HA.

### Cloud Hosting / Web-Facing (post-login feature)
The goal: host PistonCore in the cloud so people can use it like webCoRE was hosted —
no local server needed at all, just a browser and a HA instance.

**Requirements before this is possible:**
- Login system (already planned as post-v1 feature)
- Multi-user data isolation (each user's pistons are private)
- HA connection from cloud → user's local HA instance (reverse tunnel or HA Cloud API)

**The login system is already in the design docs as planned.** Once login exists,
cloud hosting is a natural next step. This would make PistonCore accessible to the
widest possible audience — the same people who loved webCoRE on SmartThings.

**Priority order:**
1. Get core working (current focus)
2. Windows app (removes Docker barrier)
3. Login system (already planned)
4. Cloud hosting option (enables webCoRE-style hosted service)

All of these are the same codebase — Docker, Windows app, and cloud hosted are just
different deployment targets for the same Python + vanilla JS project.
