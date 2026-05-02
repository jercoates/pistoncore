# PistonCore — Claude Session Starter Prompt
# Session 18 — Compiler Spec + Resume Coding Edition
# Updated end of Session 17

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
Real users are watching the GitHub repo.

---

## Architecture — Current and Locked (Session 17)

All design documents were rewritten to v1.0 in Session 17. The architecture is locked.
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

### Core Invariants — Never Break

- Every piston UUID is immutable from creation — all HA artifact names derive from UUID
- logic_version and ui_version are separate fields — not a single schema_version
- Compile target boundary lives in target-boundary.json — not hardcoded in Python
- Entity IDs are never shown to the user in any screen

---

## What Was Done in Session 17 (docs only, no code)

All four repo docs rewritten. Key changes:
- DESIGN.md v1.0: all 28 design decisions incorporated
- FRONTEND_SPEC.md v0.6: BASE_URL, AI Help button, complexity indicator, compile status
- WIZARD_SPEC.md v0.4: runtime target section added
- README.md: two-product story, feature comparison, AI orientation section
- write-a-piston.md created: first user-facing AI prompt file
- COMPILER_SPEC.md flagged as stale — must update before compiler coding
- AI-REVIEW-PROMPT.md flagged as stale

These were committed to GitHub. All four docs are current.

---

## Next Session — Start Here

### Step 1: COMPILER_SPEC.md Update (before any coding)

COMPILER_SPEC.md is stale — written against old architecture (references companion,
uses old schema_version, assumes hardcoded compile target boundary). Must update before
compiler work begins. Key things that changed:

- Remove all companion references — PistonCore writes to HA directly via REST API
- Replace schema_version with logic_version + ui_version
- Add compile target boundary — reads from target-boundary.json, not hardcoded
- Add HAClient as the auth abstraction for all HA calls
- Update file paths — pistoncore_{uuid}.yaml not piston name based
- Add fat compiler context object spec (DESIGN.md Section 14)
- Add compiler error/warning contract (DESIGN.md Section 18)
- Add Test Compile endpoint spec (returns compiled output, does not deploy)

### Step 2: Resume Coding (after COMPILER_SPEC.md is updated)

Bug fix priority from Session 15 (still outstanding):

**PRIORITY 1 — HA Device List Quality**
- Some entities still showing that shouldn't (Sonos auto-discovered media_player entities)
- "Only show devices in areas" filter toggle — devices without area assigned are often junk
- Virtual test devices showing wrong state/attributes — verify with real physical devices first

**PRIORITY 2 — Wizard: AND/OR prompt between conditions**
- After first condition added, prompt for AND/OR before building next one
- Currently just stacks conditions with no group_operator set

**PRIORITY 3 — Wizard: Operator order still wrong**
- Triggers should appear FIRST with ⚡ prefix
- Conditions second
- Currently reversed

**PRIORITY 4 — Wizard: Orange "Any of selected devices" banner**
- Should appear above compare row when ANY device is selected (not just multi-device)
- Partially fixed in Session 15 — needs verification with real devices

**PRIORITY 5 — Wizard: Value input for binary/enum from real HA devices**
- When real HA device selected, attribute type from API.getCapabilities(entity_id)
- Value widget not updating correctly for binary/enum types from real devices
- Works for demo devices — verify with real HA devices after connection confirmed

### Step 3: After Bug Fixes

Wire up compilation and deployment to HA. Requires COMPILER_SPEC.md done first.

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

## Backend / Compiler Gaps — Fix After Wizard Works End to End

1. **Wizard produces service_call, compiler expects with_block**
   - _saveDeviceCmd() produces {type:"service_call", devices:[entityId]}
   - Compiler _compile_sequence() has no handler for service_call
   - Fix: add _normalize_action() to compiler, or make wizard produce with_block

2. **Entity ID vs Role in device_map**
   - Wizard stores entity_id on subject but compiler resolves via device_map[role]
   - Need _entityToRole() in wizard and Editor.registerDeviceRole() to auto-populate
     piston.roles and piston.device_map when user picks a device

3. **Trigger format mismatch**
   - Wizard produces {type:"trigger", operator:"changes to", compiled_value:"on"}
   - Compiler expects {type:"state", target_role:"...", to:"on"}
   - Fix: add _normalize_trigger() pre-processing step in compiler

4. **Binary sensor compiled_value lookup must live in wizard**
   - DEVICE_CLASS_LABELS table (door→Open/Closed, motion→Detected/Clear, etc.)
     must be in wizard so it sets compiled_value correctly before saving

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

## Session Log Summary

Sessions 1-11: Design, backend, Docker, frontend scaffold.
Session 12: Editor + wizard rewrites. Demo devices. Multiple bugs found, partially fixed.
Session 13: Major wizard and editor fixes. Variable wizard layout, define block rendering,
            mode persistence, condition picker improvements, edit-in-place for statements.
Session 14: Condition builder inline device/attribute pickers. Demo device search fix.
            Argument option added. Add more reset. Any-of single device fix. CSS for dropdowns.
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

---

## Next Session Checklist

1. Read this prompt fully
2. Confirm with Jeremy: start with COMPILER_SPEC.md update, or jump to bug fixes?
3. If bug fixes: ask Jeremy to upload current frontend files before touching any code
4. Ask Jeremy for WebCoRE reference screenshots if wizard work is on the agenda
5. Present full fix list before writing any code — wait for go
6. After each fix: give yes/no test checklist, wait for screenshot
7. Generate updated session prompt at end of session
