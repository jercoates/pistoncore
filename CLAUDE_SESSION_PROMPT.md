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
- Entity IDs are never shown to the user in normal flow (see honest status below)

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

## Development Sequence — Clarified

Docker is the dev and delivery path for ALL core feature work. The addon is the
primary product for end users but Docker gets built and validated completely first.
Addon packaging is a separate phase after the core is solid in Docker.

Do not think of this as "Docker then addon" as two separate builds. It is one build
that runs in Docker throughout development. Addon packaging is wrapping, not rebuilding.

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
- Lock script entity ID format — script.pistoncore_{uuid} explicitly, not slug-based
- Slug is ONLY used for automation alias: field (human readable label in HA UI)
- Remove all slug-based filename/entity ID examples — replace with UUID format
- Remove slug collision handling for filenames — UUIDs are unique, no collision possible
  (slug collision handling may still be needed for alias: field — clarify in spec)
- Add fat compiler context object spec (DESIGN.md Section 14)
- Add compiler error/warning contract (DESIGN.md Section 18)
- Add Test Compile endpoint spec (returns compiled output, does not deploy)
- Add Docker native runtime as planned future output target (see note below)

### Step 2: Resume Coding (after COMPILER_SPEC.md is updated)

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

Also: auto-discovered devices the user never set up (Sonos, Chromecast, mDNS/SSDP
discoveries) need a "hide this device" option in My Device Definitions screen so users
can permanently remove specific devices from the picker without deleting them from HA.

**Device picker vs variable picker — separation is by TYPE, not by variable vs device.**

Device-type variables belong IN the device picker. Non-device variables belong in
the variable picker. A variable's type determines which picker it appears in.

- Define block wizard: where all variables are created — completely separate UI
- HA helpers (input_boolean etc.) are variables — created in define block wizard,
  never appear in device picker

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

Device picker section order after grouping fix:

  [Area Name]
    Device Name              ← one entry per physical device
  [Another Area]
    Device Name
  No Area
    Device Name              ← unassigned devices, always shown by default
  Device Variables
    @SmokeDetectors          ← device-type globals
    $currentDevice           ← device-type local variables
  Virtual
    Time / Date / Location / System Start

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

1. **Wizard produces service_call, compiler expects with_block — FORMAT DECISION NEEDED**
   - _saveDeviceCmd() produces {type:"service_call", devices:[entityId]}
   - Compiler _compile_sequence() has no handler for service_call
   - This is not just a wizard bug — it is an unresolved format contract question
   - Decision must be made when COMPILER_SPEC.md is updated:
     Option A: Fix in wizard — wizard produces with_block, compiler never sees service_call
     Option B: Fix in compiler — add _normalize_action() to handle both formats
   - Recommendation: Option A. Piston JSON should be canonical format (with_block).
     Compiler should never normalize malformed input — clean contract is easier to maintain.
   - Whatever is decided must be locked in COMPILER_SPEC.md before compiler work starts

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

**Reference screenshot for next session:**
Upload the WebCoRE task wizard screenshot (1777693803441_image.png) — shows:
- Set variable wizard layout with Variable section and Value/Expression section
- "Only during these modes" orange bar (per-task restriction)
- Variable picker dropdown showing type + name format
- Define block rendering in the editor behind the modal

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

## Note for Next Session — Docker Native Runtime Option

When updating COMPILER_SPEC.md, add a note about this future Docker capability:

Docker version should eventually support an opt-in native runtime mode as an alternative
to PyScript for complex pistons. Two reasons this matters:

1. PyScript is a community project — it's well maintained now but depending on it
   permanently for Docker users carries long term risk if it stops being maintained.

2. Most people running the Docker version of HA put PistonCore on the same machine.
   The native runtime talking back to HA over localhost is essentially zero latency
   and zero network risk — arguably cleaner than the addon in some ways.

Implementation is straightforward given the existing architecture:
- Add runtime_mode: "pyscript" | "native" to Docker config.json
- Compiler checks deployment_type + runtime_mode and routes accordingly
- Piston JSON does not change — same file, different output target
- WebSocket connection to HA already exists for device data — same plumbing
- Native runtime engine is being built for addon v2 anyway — Docker just reuses it

This fills a real gap: Docker HA users who don't want HACS, or who want full
execution tracing that PyScript can't provide. Not v1 scope — note it in
COMPILER_SPEC.md as a planned extensible output target so the routing logic
is designed to accommodate it from the start.

---

## Next Session Checklist

1. Read this prompt fully
2. Confirm with Jeremy: start with COMPILER_SPEC.md update, or jump to bug fixes?
3. If bug fixes: ask Jeremy to upload current frontend files before touching any code
4. Ask Jeremy for WebCoRE reference screenshots if wizard work is on the agenda
5. Present full fix list before writing any code — wait for go
6. After each fix: give yes/no test checklist, wait for screenshot
7. Generate updated session prompt at end of session
