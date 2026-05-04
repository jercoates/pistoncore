# PistonCore — Claude Session Starter Prompt
# Session 19 — Compiler Spec Update + Resume Coding Edition
# Updated end of Session 18

---

## CRITICAL RULES FOR CLAUDE

1. **WebCoRE screenshots = REFERENCE** for how PistonCore SHOULD look
2. **PistonCore screenshots = showing what is WRONG** and needs fixing
3. **Never confuse the two** — always ask "is this WebCoRE or PistonCore?" before acting
4. **Do not code without permission** — present the fix list, wait for "go"
5. **Do not update specs mid-session** — code first, specs after it works in browser
6. **One problem at a time** — confirm the full list before writing any code
7. **Always ask Jeremy to upload the WebCoRE reference screenshots at session start**
   - wizard_reference_screenshots.zip — condition builder, operator list, action picker
   - session screenshots from prior session if Jeremy has them
   - Read the ANNOTATIONS.md inside each zip before writing any code

---

## Project Overview

Building PistonCore — a WebCoRE-style visual automation builder for Home Assistant.
GitHub: https://github.com/jercoates/pistoncore

Jeremy has almost no programming background. He directs vision, Claude writes code.
Sessions are limited. This prompt is Claude's memory between sessions.
Real users are watching the GitHub repo. HA Discord community is aware of the project.

---

## Architecture — Current and Locked (Session 18)

All design documents are current. DESIGN.md is v1.1.
Do NOT re-open closed decisions. Do NOT suggest AppDaemon. Do NOT suggest removing PyScript for Docker.

### Two Products

**Product 1: PistonCore Addon (PRIMARY — build this first)**
- Runs on HA OS and HA Supervised
- Installs from GitHub addon repo URL in HA addon store
- Supervisor token automatic — zero user setup
- Writes directly to /config/automations/pistoncore/ and /config/pyscript/pistoncore/
- No HACS companion needed

**Product 2: PistonCore Docker (SECONDARY — build after addon is solid)**
- Runs on Unraid, NAS, any Docker host
- Long-lived HA token entered once in settings
- Calls HA REST API directly
- Dev environment stays Docker during all v1 development

### Compiler Output Model (permanent)

| Piston Type | Output | Status |
|---|---|---|
| Simple | Native HA YAML automation + script | Permanent forever |
| Complex — addon v1 | PyScript | Until v2 |
| Complex — addon v2+ | PistonCore native runtime | Permanent for complex |
| Complex — Docker | PyScript | Permanent — never deprecated |

### Closed Decisions — Do Not Relitigate

- AppDaemon: ruled out, decision closed (DESIGN.md Section 27)
- Hybrid output model: simple pistons compile to native YAML permanently
- PyScript: permanent for Docker, deprecated for addon in v2 only
- No HACS companion: PistonCore writes to HA directly via REST API
- Frontend never calls HA directly: security invariant, no exceptions
- BASE_URL: required for all frontend connections, no hardcoded paths
- **Internal piston format: structured JSON — decided Session 18, closed**
- **Compiler reads structured JSON directly — no text parsing — decided Session 18, closed**

### Core Invariants — Never Break

- Every piston UUID is immutable from creation — all HA artifact names derive from UUID
- logic_version and ui_version are separate fields in the wrapper — never collapse into one
- Compile target boundary lives in target-boundary.json — not hardcoded in Python
- Entity IDs are never shown to the user in normal flow (see honest status below)
- **The compiler NEVER parses display text — it reads structured JSON statement objects**
- **The editor NEVER stores display text — it renders text from structured JSON on the fly**

### Entity ID Visibility — Goal With Known Gaps

The goal is that users never see raw entity IDs. This is not fully implemented yet.
Current honest status by area:

- **Device picker** — mostly working. User picks by friendly name. Entity ID resolved
  internally. Label disambiguator handles duplicate friendly names.
- **Capability/attribute display** — backend needs to strip entity IDs from HA responses
  before they reach the frontend. Not yet done.
- **HA error messages** — when HA rejects compiled output, errors contain raw entity IDs
  and YAML field names. error-translations.json handles known patterns but unknown errors
  will still leak raw HA output. Acceptable for now — flag as known gap.
- **Test Compile view** — deliberate exception. Raw YAML shown here contains entity IDs.
  This is intentional — it's a power user feature behind a button, not normal flow.

Do not revert the goal. Do track these as implementation gaps to close progressively.
When working on ha_client.py for the device list fix, strip entity IDs from all
capability and attribute responses at the same time — one pass, done.

---

## CRITICAL — Piston Format Architecture (Decided Session 18)

This is the most important thing to understand before touching any code or specs.

### Internal Format = Structured JSON

Every piston is stored as a structured JSON object with a `statements` array.
Every statement is a typed data object — the wizard writes structured data, the editor
renders display text from it, the compiler reads it directly.

This is the same model WebCoRE used internally. We confirmed this by reading the
WebCoRE source code (piston.module.html). WebCoRE stored structured JSON and rendered
display text using renderComparison() and renderTask() functions. PistonCore does the same.

**The wizard writes structured JSON. The editor renders text from it. The compiler reads
structured JSON. Nothing is ever parsed from display text during normal operation.**

Example internal statement object:
```json
{
  "id": "stmt_001",
  "type": "if",
  "conditions": [
    {
      "id": "cond_001",
      "is_trigger": true,
      "aggregation": "any",
      "role": "Doors",
      "attribute": "contact",
      "attribute_type": "binary",
      "device_class": "door",
      "operator": "changes to",
      "value": "open"
    }
  ],
  "then": ["stmt_002"],
  "else": []
}
```

### Shared/Export Format = piston_text

When a piston is shared, exported as Snapshot, or generated by an AI, the format is a
small JSON wrapper containing a `piston_text` field — plain English text matching the
editor display exactly. This is what write-a-piston.md teaches AI to generate.

### AI Import Dialog — The Bridge

When a user imports a piston_text format piston (from AI, community sharing, etc.),
a dedicated AI Import dialog handles the translation:
1. PistonCore parses piston_text — matches known fixed statement patterns
2. Walks user through mapping each {role} to a real HA device via existing device picker
3. Builds structured JSON as roles are mapped
4. Piston opens in editor fully built from structured JSON

The AI Import button can be disabled for a release if parser is not complete.
The rest of import (direct JSON paste, URL, file upload) is unaffected.

### wizard_context — RETIRED

wizard_context no longer exists. It was part of the old piston_text-as-truth model.
Do not reference it. Do not implement it. The compiler reads structured JSON directly
and needs no text hints.

### Render Functions

Frontend render functions are the authoritative mapping from structured data to display text.
Same functions used for editor display AND for generating piston_text on export.
These are the equivalent of WebCoRE's renderComparison() and renderTask().
They live entirely in frontend JavaScript. The backend never renders display text.

---

## What Was Done in Session 18 (docs only, no code)

- Reviewed WebCoRE source code (piston.module.html, app.js) — confirmed WebCoRE used
  structured JSON internally, not plain text storage
- Decided internal format is structured JSON — wizard writes it, editor renders from it,
  compiler reads it directly
- Decided share/export/AI format remains piston_text — human readable, AI friendly
- Decided AI Import is a dedicated dialog — parses piston_text, user maps roles,
  builds structured JSON. Button can be disabled if not ready for release.
- Retired wizard_context concept — not needed with structured JSON
- Confirmed render functions are a frontend responsibility
- Confirmed complete operator list (conditions + triggers with extra inputs)
- Confirmed complete Location virtual device command list
- Confirmed complete statement type list from WebCoRE source:
  action (with/do), do, on (on events from), if, switch, for, each (for each),
  while, repeat, every (timer), break, exit (return/stop)
- Updated DESIGN.md to v1.1 — new Section 6, updated Section 2 bullet, updated
  Section 10.3 trigger storage, replaced Section 15.5 wizard_context with render
  functions section, Session 18 development log entry
- COMPILER_SPEC.md updated to v1.0 (see below)
- WIZARD_SPEC.md and FRONTEND_SPEC.md flagged for update — not done yet

---

## Reference Data — Captured from WebCoRE Source

### Complete Statement Type List (from piston.module.html)

| WebCoRE type | PistonCore type | Editor display |
|---|---|---|
| action | action | with {devices} / do / end with |
| do | do | do / end do |
| on | on_event | on events from / do / end on (PyScript only) |
| if | if | if / conditions / then / else / end if |
| switch | switch | switch ({expr}) / case / default / end switch |
| for | for | for ({start} to {end} step {step}) / do / end for |
| each | for_each | for each ({var} in {list}) / do / end for each |
| while | while | while / conditions / do / end while |
| repeat | repeat | repeat / do / until / conditions / end repeat |
| every | every | every {timer} / do / end every |
| break | break | break (PyScript only) |
| exit | exit | exit {value} |

### Complete Operator List

**Conditions (no lightning bolt):**
is, is any of, is not, is not any of, is between, is not between, is even, is odd,
was, was any of, was not, was not any of, changed, did not change,
is equal to, is not equal to, is less than, is less than or equal to,
is greater than, is greater than or equal to

**Triggers (⚡ lightning bolt):**
changes, changes to, changes to any of, changes away from, changes away from any of,
drops, drops below, drops to or below, rises, rises above, rises to or above,
stays, stays equal to, stays any of, stays away from, stays away from any of,
stays unchanged, gets, gets any, receives, happens daily at, event occurs,
is any and stays any of, is away and stays away from

**Duration label:** stays operators = "For the next..." / was/changed operators = "In the last..."

### Location Virtual Device Commands

Set variable, Execute piston, Set timezone, Send push notification, Log to console,
Make HTTP request, Send email, Wait, Set HA mode, Raise event

(File System Commands — skip v1, Hubitat specific)

---

## Development Sequence — Clarified

Docker is the dev and delivery path for ALL core feature work. The addon is the
primary product for end users but Docker gets built and validated completely first.
Addon packaging is a separate phase after the core is solid in Docker.

---

## Next Session — Start Here

### Step 1: WIZARD_SPEC.md and FRONTEND_SPEC.md Updates

These two docs still reference the old piston_text-as-truth model and wizard_context.
They need to be updated to reflect:
- Wizard writes structured JSON statement objects (not text)
- Editor renders text from structured JSON using render functions
- wizard_context is retired
- AI Import dialog is a new feature (see Section 6.3 of DESIGN.md)
- is_trigger flag on condition objects replaces position-based trigger detection

Do this BEFORE any coding on the wizard or editor.

### Step 2: Statement Type Reference Document

Before compiler coding begins, create a reference document (STATEMENT_TYPES.md) that
defines for each statement type:
1. The structured JSON object format (all fields, types, required vs optional)
2. The render function output (what display text it produces)
3. The HA YAML the compiler emits

This document is the foundation the compiler is built on. It is also what the AI Import
parser uses to recognize statement patterns in piston_text.

The WebCoRE source in Session 14 chat (piston.module.html, app.js) is the reference.
Use it to verify statement field names and structure.

### Step 3: Resume Coding

**PRIORITY 0 — Device List Clutter (wizard is unusable at scale without this)**

Jeremy has 179+ Hubitat devices migrated to HA. With HA's entity model, one physical
device can have 10-20 entities. The wizard currently shows all of them — one row per
entity — making it completely unusable at scale. This must be fixed before anything else.

Three-layer fix in ha_client.py:

1. **Filter entity_category flags** — HA marks entities as diagnostic or config in the
   entity registry. These are firmware versions, signal strength, last seen, update
   available, memory usage — never useful for automation logic. Filter them out.
   Field to check: entity_category == "diagnostic" or entity_category == "config"
   This alone eliminates most of the Sonos/media player clutter.

2. **Group by device not entity** — the picker should show one row per physical device
   (e.g. "Sonos Living Room" once), not one row per entity (15 Sonos rows).
   This is the design intent — it needs to be properly implemented.
   Device grouping data is available from the HA device registry.

3. **"Only show devices in areas" toggle** — user-controlled filter. Devices without
   an area assigned in HA are usually auto-discovered junk (Sonos found via mDNS,
   Chromecast, etc.) that the user never deliberately set up. Toggle off by default,
   user can enable it to hide everything without an area. Store preference in config.json.

Also: auto-discovered devices the user never set up need a "hide this device" option
in My Device Definitions screen so users can permanently remove specific devices from
the picker without deleting them from HA.

**Device picker vs variable picker — separation is by TYPE, not by variable vs device.**

Device-type variables belong IN the device picker. Non-device variables belong in
the variable picker. A variable's type determines which picker it appears in.

**Device picker shows:**
- Physical HA devices (grouped by area then name)
- Device-type global variables (@SmokeDetectors, @AlertLights, @Speakers)
- Device-type local piston variables ($device, $currentDevice)
- Virtual devices (Time, Date, Location, System Start)
- NO scalar/non-device variables

**Variable picker shows:**
- Non-device local piston variables ($count, $message, $status)
- Non-device global variables (@BatteryStatus, @AwayMode)
- System variables ($now, $sunrise, $sunset, $index, $hour, etc.)
- NO physical devices, NO device-type variables

**PRIORITY 1 — Wizard: AND/OR prompt between conditions**
- After first condition added, prompt for AND/OR before building next one
- Currently just stacks conditions with no group_operator set

**PRIORITY 2 — Wizard: Operator order still wrong**
- Triggers should appear FIRST with ⚡ prefix
- Conditions second
- Currently reversed

**PRIORITY 3 — Wizard: Orange "Any of selected devices" banner**
- Should appear above compare row when ANY device is selected (not just multi-device)
- Partially fixed in Session 15 — needs verification with real devices

**PRIORITY 4 — Wizard: Value input for binary/enum from real HA devices**
- When real HA device selected, attribute type from API.getCapabilities(entity_id)
- Value widget not updating correctly for binary/enum types from real devices
- Works for demo devices — verify with real HA devices after connection confirmed

### Step 4: After Bug Fixes

Wire up compilation and deployment to HA. COMPILER_SPEC.md must be done first.

---

## Infrastructure — Current Dev Setup

- Unraid server at 192.168.1.226, port 7777
- Files copied directly over network to Unraid — NOT deployed via git pull
  (git pull has a caching issue that overwrites changes)
- Jeremy pushes to GitHub manually after a session's fixes are confirmed working
- Docker rebuild command:
  ```
  cd /mnt/user/appdata/pistoncore-dev
  git pull
  docker build -t pistoncore .
  docker stop pistoncore && docker rm pistoncore
  docker run -d \
    --name pistoncore \
    --restart unless-stopped \
    -p 7777:7777 \
    -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata \
    -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize \
    pistoncore
  ```
- When Docker build uses cached layers: use `docker build --no-cache`
- Browser cache: Ctrl+Shift+R or incognito window
- Frontend: vanilla JS/HTML/CSS, no framework
- Backend: Python FastAPI, port 7777

---

## HA Connection — Working as of Session 15

- HA settings modal opens by clicking the "HA Disconnected" badge in the header
- Saves ha_url and ha_token via PUT /config
- Tests connection via GET /devices
- Badge updates to "HA Connected" on success
- Jeremy's HA is at http://192.168.1.65:8123
- Long-lived token saved in config — Jeremy has it ready if needed

---

## Files Changed in Session 15 (last code session)

- frontend/js/wizard.js — device picker, caps, modal size, value inputs, banner
- frontend/css/style.css — modal size, wiz-body scrolling, spacing
- frontend/js/app.js — HA badge click, HASettings module, checkHAConnection
- frontend/index.html — HA settings modal markup
- backend/ha_client.py — domain filter, label parser, area sort

---

## Editor Document — Confirmed Rendering Rules

### Simple mode shows:
- Comment header block
- settings / end settings
- define block — ALWAYS shown in both Simple and Advanced
- execute block with · add a new statement
- NO "only when" blocks unless they have content

### Advanced mode shows everything including:
- only when (restrictions) block with ghost text
- only when inside execute with ghost text

### Mode persistence:
- Simple/Advanced preference saved to localStorage (pc_simpleMode)
- Default is Advanced

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

---

## Variable Naming Conventions — Confirmed

- **`@`** prefix = global variables (`@SmokeDetectors`, `@AlertLights`)
- **`$`** prefix = local piston variables (`$count`, `$device`, `$now`)
- System variables also use `$` prefix (`$currentEventDevice`, `$sunrise`)
- No global variables sidebar — globals managed through dedicated globals screen only

**Variable picker dropdown display format (match WebCoRE exactly):**
Shows type + name together in one string: "string Battery_Status", "device currentDevice"
Not just the name alone — type keyword comes first.

**Define block rendering (confirmed from WebCoRE screenshot):**
```
device currentDevice;
device Smoke_CO = Basement Smoke detector, Kitchen Detector;
string Battery_Status_Smoke;
```
Type keyword first, then variable name, then = and value/devices if set, semicolon at end.
Device globals show their member friendly names inline after the = sign.

**Variable types — full list in correct order (match WebCoRE exactly):**
1. Dynamic
2. String (text)
3. Boolean (true/false)
4. Number (integer)
5. Number (decimal)
6. Large number (long)
7. Date and Time
8. Date (date only)
9. Time (time only)
10. Device

Advanced lists (v2 — show grayed out in v1 with "Coming in v2" tooltip):
Dynamic list, String list, Boolean list, Number list (integer),
Number list (decimal), Large number list (long), Date and Time list, Date list, Time list

---

## Wizard — Confirmed Rules

- NEVER two modals open at once
- if_block selection goes to condition builder FIRST, inserts block AFTER condition done
- Uses _extra['block-id'] exclusively — unified mechanism
- Backdrop is transparent — no dark overlay
- Modal is centered, 720px wide, fills screen height, wiz-body scrolls
- Condition builder: ONE screen, everything visible at once
- Device picker opens as inline panel BELOW the row with search
- Operator order: Triggers FIRST with ⚡, Conditions second
- Value inputs: binary/enum → dropdown, numeric → number input, free text → textarea

---

## Import Flow — Two Paths, Define Block Is Primary Interface

**Simple path** — automatic "Rebuild piston items" screen after import, one row per unknown
device role, user maps all roles at once then saves.

**Complex path** — close the rebuild screen, open in editor, click each device variable in
the define block individually, "Edit variable" modal opens for just that variable.

Both paths must be supported.

### Define Block Is the Primary Device Management Interface

Every device variable in the define block is clickable. Clicking opens Edit Variable modal.
This is how import mapping works AND how ongoing editing works. Same flow, same modal.

### How device_map Gets Populated

When user picks devices in Edit Variable modal:
1. PistonCore updates the structured JSON statements — device variable now has selected entities
2. PistonCore updates device_map — role name → entity IDs mapping
3. Both happen simultaneously on Save in the modal

### Statement Edit-in-Place — Resolved

User clicks any statement in the editor → wizard opens pre-populated with that statement's
current structured JSON values → user changes what they want → Save rewrites the
structured JSON for that statement.

The wizard reads from and writes to structured JSON — never from display text.

---

## Note on Docker Native Runtime Option

When updating COMPILER_SPEC.md, add as a planned future extensible output target.
Docker version should support opt-in native runtime as alternative to PyScript.
Config: runtime_mode: "pyscript" | "native" in Docker config.json.
Same runtime engine as addon v2 — Docker just reuses it.
Design the compiler output target routing to accommodate this from the start.

---

## Session Log Summary

Sessions 1-11: Design, backend, Docker, frontend scaffold.
Session 12: Editor + wizard rewrites. Demo devices. Multiple bugs found, partially fixed.
Session 13: Major wizard and editor fixes. Variable wizard layout, define block rendering,
            mode persistence, condition picker improvements, edit-in-place for statements.
Session 14: Condition builder inline device/attribute pickers. Demo device search fix.
            Argument option added. Add more reset. Any-of single device fix. CSS for dropdowns.
            WebCoRE source code pulled into session — piston.module.html and app.js in context.
Session 14.5: wizard.js and editor.js structural bug fixes. Step stack, device selection,
              refreshConditionRows, operator order, if_block unified mechanism.
Session 15: Wizard improvements (larger modal, device search panel, domain caps map,
            context-aware value inputs, agg banner). HA settings page with WebSocket
            connection. Real devices loading. Domain filter + label disambiguator in backend.
Session 16: Architecture pivot. Companion dropped, addon primary, Docker secondary.
            PyScript permanent for Docker. AppDaemon ruled out. 28 design decisions doc'd.
            No code written.
Session 17: All four repo docs rewritten to v1.0. Data-driven compile boundary added.
            Hybrid-permanent decision locked. AI instruction file system defined.
            write-a-piston.md prompt created. COMPILER_SPEC.md flagged stale. No code written.
Session 18: Major architecture decision — internal format changed from piston_text-as-truth
            to structured JSON-as-truth. WebCoRE source reviewed and confirmed this model.
            wizard_context retired. AI Import dialog defined. DESIGN.md v1.1 produced.
            COMPILER_SPEC.md v1.0 produced. No code written.

---

## Next Session Checklist

1. Read this prompt fully — especially the CRITICAL piston format section
2. Confirm with Jeremy: start with WIZARD_SPEC.md/FRONTEND_SPEC.md updates, or jump to coding?
3. If coding: ask Jeremy to upload current frontend files before touching any code
4. Ask Jeremy for WebCoRE reference screenshots if wizard work is on the agenda
5. Present full fix list before writing any code — wait for go
6. After each fix: give yes/no test checklist, wait for screenshot
7. Generate updated session prompt at end of session
