# PistonCore — Claude Session Starter Prompt
# Session 13 — Updated end of Session 12

---

## CRITICAL RULES FOR CLAUDE

1. **WebCoRE screenshots = REFERENCE** for how PistonCore SHOULD look
2. **PistonCore screenshots = showing what is WRONG** and needs fixing
3. **Never confuse the two** — always ask "is this WebCoRE or PistonCore?" before acting
4. **Do not code without permission** — present the fix list, wait for "go"
5. **Do not update specs mid-session** — code first, specs after it works in browser
6. **One problem at a time** — confirm the full list before writing any code

---

## Project Overview

Building PistonCore — a WebCoRE-style visual automation builder for Home Assistant.
GitHub: https://github.com/jercoates/pistoncore

Jeremy has almost no programming background. He directs vision, Claude writes code.
Sessions are limited. This prompt is Claude's memory between sessions.
Real users are watching the GitHub repo.

---

## Infrastructure

- Unraid server at 192.168.1.226, port 7777
- Docker rebuild command:
  ```
  cd /mnt/user/appdata/pistoncore-dev && git pull && docker build -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
  ```
- Frontend: vanilla JS/HTML/CSS, no framework

---

## Three Pages — Confirmed Layout

1. **List page** — home screen, OK as-is
2. **Status/Debug page** — land here after saving or clicking a piston
3. **Editor page** — full width, no centering, fills viewport, continuous document renderer

---

## Editor Document — Confirmed Rendering Rules

### Blank new piston in SIMPLE mode shows ONLY:
```
/* **** */
/* * New Piston */
/* **** */
/* * Created : date */
/* * Modified : date */
/* **** */
settings
end settings;

define
  · + add a new variable
end define;

execute
  · + add a new statement
end execute;
```
NO "only when" on a blank simple piston.
"only when" only appears when content exists OR in Advanced mode.

### If block — correct keywords:
```
if
  · add a new condition
then
  · add a new statement
else
  · add a new statement
end if;
```
NO curly braces. Keywords: if / then / else / end if; NOT "when true"/"when false"

### Comment format: `/* text */` — correct spacing, no extra spaces

---

## Wizard — Confirmed Rules

### NEVER two modals open at once
Statement picker closes on selection. Condition wizard only opens from ghost text clicks.

### Variable wizard initial value — matches WebCoRE:
Dropdown options: Nothing selected / Physical device(s) / Value / Variable / Expression / Argument
- Physical device(s) → device picker
- Value → text input
- Variable → Local / Global / System variable picker
- Expression → textarea
- Argument → text input

### Demo devices — always visible without HA
Virtual + Demo devices render immediately. HA devices load in background.

---

## Known Bugs — Fix List for Session 13

Upload `variable_wizard_screenshots.zip` — read ANNOTATIONS.md inside first.

1. **editor.js** — "only when" showing twice on blank simple piston
2. **wizard.js** — two modals open at once (statement picker + condition wizard)
3. **wizard.js** — variable initial value is plain text, needs full dropdown matching WebCoRE
4. **editor.js** — comment format wrong (extra spaces in /* */)

**DO NOT start coding until Jeremy confirms the full fix list.**

---

## Future Plans (noted, not blocking)

- Virtual test devices in companion HA app
- Windows app via PyInstaller
- Login system (post-v1)
- Cloud hosting (after login)

---

## Session Log Summary

Sessions 1-11: Design, backend, Docker, frontend scaffold.
Session 12: Editor + wizard rewrites. Demo devices. Multiple bugs found, partially fixed.

## Next Session — Start Here

1. Upload `variable_wizard_screenshots.zip`
2. Read ANNOTATIONS.md from the zip
3. Confirm fix list with Jeremy
4. Fix bugs in order
5. Run visual checklist after each fix
6. Update README.md (stale)
7. Review DESIGN.md for discrepancies
