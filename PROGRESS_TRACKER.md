# PistonCore Progress Tracker
Last updated: Session 12 — April 2026

---

## How to use this file
- Update it at the end of every session
- One line per item — done / in progress / not started / blocked
- Keep it short — this is a checklist not a design doc

---

## Backend ✅ Mostly done

| Item | Status |
|---|---|
| FastAPI app, port 7777 | ✅ Done |
| All REST API endpoints | ✅ Done |
| API key auth | ✅ Done |
| compiler.py — native HA script | ✅ Done |
| ha_client.py — HA WebSocket client | ✅ Done |
| storage.py — piston JSON read/write | ✅ Done |
| Jinja2 templates (18 snippets) | ✅ Done |
| Docker container working on Unraid | ✅ Done |
| /ws WebSocket endpoint (live logs) | ❌ Not started |
| validation-rules/internal-checks.json | ❌ Not started |
| validation-rules/error-translations.json | ❌ Not started |
| PyScript compiler | ❌ Not started |
| Companion HA integration | ❌ Not started |

---

## Frontend — Pages

| Item | Status |
|---|---|
| List page — renders pistons by folder | ✅ Done |
| List page — search | ✅ Done |
| List page — new piston modal (blank/duplicate/import) | ✅ Done |
| List page — bulk export (zip all pistons) | ❌ Not started |
| List page — layout improvements (not centered) | ❌ Not started |
| Status/Debug page — basic layout | ✅ Done |
| Status/Debug page — Test button (no Live Fire label) | ✅ Done |
| Status/Debug page — Deploy button removed (deploy in trace only) | ✅ Done |
| Status/Debug page — read-only piston script view | ✅ Done |
| Status/Debug page — log panel | ✅ Done |
| Status/Debug page — trace view | ❌ Not started |
| Editor page — full width, no centering | ✅ Done |
| Editor page — continuous document renderer | ✅ Done |
| Editor page — line numbers | ✅ Done |
| Editor page — teal keywords | ✅ Done |
| Editor page — orange device refs {Device} | ✅ Done |
| Editor page — ghost text insertion points | ✅ Done |
| Editor page — right-click context menu | ✅ Done |
| Editor page — editable name in toolbar | ✅ Done |
| Editor page — save → status page | ✅ Done |
| Editor page — cancel new piston → delete → list | ✅ Done |
| Editor page — PyScript warning bar | ✅ Done |
| Editor page — compile target badge | ✅ Removed (was confusing) |
| Dark/light mode toggle | ✅ Done |

---

## Visual Test Checklist — Run This After Every Deploy

Open browser at http://192.168.1.226:7777 and answer yes/no:

**List page:**
- [ ] Pistons grouped by folder with teal folder headers?
- [ ] "+ New" opens a modal with 3 options (blank/duplicate/import)?
- [ ] Clicking blank piston goes straight to editor (not status page)?
- [ ] Dark/light toggle in header switches the theme?

**Editor page:**
- [ ] Editor fills the full width of the screen (not a narrow centered column)?
- [ ] Piston name is editable by clicking it in the toolbar?
- [ ] Line numbers visible on left side?
- [ ] Keywords (define, execute, if, then, else, end if;) in teal?
- [ ] Device references in orange {curly braces}?
- [ ] Ghost text "· add a new statement" visible and gray/italic?
- [ ] Clicking ghost text — does anything happen? (wizard not done yet — should at minimum not crash)
- [ ] Save button works and goes to status page?
- [ ] Cancel on a brand new piston goes back to list?
- [ ] Cancel on an existing piston goes back to status page?

**Wizard (NOT DONE YET — check after wizard session):**
- [ ] Clicking "+ add a new condition" shows Condition vs Group choice? (screenshot 17)
- [ ] Device picker shows search box + physical devices + globals + system vars? (screenshots 29-31)
- [ ] Operator list has two sections — Conditions and Triggers? (screenshot 22)
- [ ] "Which interaction" row appears for trigger operators? (screenshot 22)
- [ ] Statement type picker shows cards for if/action/timer/loops? (screenshot 28)
- [ ] "Add a new task" shows With... / Do... layout? (screenshot 32)
- [ ] Completed condition looks like screenshot 27?
- [ ] Completed action looks like screenshot 37?

---

## Wizard — Detailed Status

| Item | Status |
|---|---|
| Current wizard.js | ❌ Wrong pattern — needs full rewrite |
| Condition vs Group first step | ❌ Not started |
| Device picker (search + physical + globals + system vars) | ❌ Not started |
| Attribute/capability picker | ❌ Not started |
| Operator list (Conditions / Triggers sections) | ❌ Not started |
| Which interaction step | ❌ Not started |
| Value input (varies by attribute type) | ❌ Not started |
| Statement type picker (card grid) | ❌ Not started |
| Add a new task modal (With / Do) | ❌ Not started |
| Variable type picker | ❌ Not started |
| Back / Add more / Add buttons | ❌ Not started |
| Cancel / Delete / Save buttons (task wizard) | ❌ Not started |
| Cog icon advanced options | ❌ Not started |
| Plain English sentence builder at top | ❌ Not started |

---

## Docs / Housekeeping

| Item | Status |
|---|---|
| README.md — update to reflect active coding | ❌ Needed |
| DESIGN.md — review for discrepancies from new directions | ❌ Needed |
| FRONTEND_SPEC.md — update after wizard works in browser | ❌ Hold until wizard done |
| WIZARD_SPEC.md — update after wizard works in browser | ❌ Hold until wizard done |
| CLAUDE_SESSION_PROMPT.md — keep current | ✅ Updated Session 12 |
| PROGRESS_TRACKER.md — this file | ✅ Created Session 12 |

---

## Known Discrepancies — Design vs Reality
Things that changed from the original design that need DESIGN.md updated:

1. **Compile target badge** — spec says show it in editor. Decision: removed. Replace with PyScript warning bar only when needed.
2. **Deploy button** — spec says it's on status page. Decision: removed from status page. Deploy only in trace/debug screen (not yet built).
3. **Status page as hub** — spec and sessions confirmed: status page is where you land after saving. Editor is not the hub.
4. **New piston flow** — spec didn't define this clearly. Decision: new piston → editor directly (skip status page). All other pistons → status page first.
5. **Globals sidebar** — WebCoRE has it always open on the right. Decision: button-triggered drawer instead (Jeremy prefers this).
6. **Folder in editor** — WebCoRE doesn't have folder in editor. Decision: keep it there anyway (convenient).
7. **"Live Fire" label** — removed. Test button is plain "Test".
8. **Grok WIZARD_SPEC v0.4** — reviewed but NOT adopted. Our v0.3 + session decisions + annotated screenshots are authoritative.
