# PistonCore — Claude Session Starter Prompt
# Session 16 — Architecture Pivot Edition
# Updated end of Session 15 + major architecture pivot discussion

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

## ⚠️ ARCHITECTURE PIVOT — Decided Session 16 (Read This First)

The architecture changed significantly in a design discussion this session.
The design documents in the repo are NOW STALE and need rewriting before coding resumes.
Do NOT code against the old architecture. Do NOT start coding until DESIGN.md is updated.

### What Changed

**Old architecture:**
- Single Docker container only
- PyScript for complex automations
- HACS companion integration to write files into HA
- External deployment only (Unraid, NAS, Docker host)

**New architecture:**
- Primary target: Native HA Addon (HA OS and HA Supervised)
- Secondary target: Docker container — build later once addon is solid
- PyScript: KEPT for v1 complex pistons — compiler mostly built, no reason to discard
- HACS companion integration: GONE entirely
- Auth: Supervisor token (addon) or long-lived token entered in settings (Docker)
- File writing: HA REST API directly — no companion needed
- PistonCore native runtime engine: v2 feature — architecture ready, not built yet

### Why This Is Better
- PyScript stays for v1 — working code, ship what works
- Native runtime engine is the long term PyScript replacement — designed in, built in v2
- Eliminates HACS companion (complex to distribute, significant maintenance burden)
- HA Addon = proper two-click install from addon store for the majority of HA users
- Core backend code is the same for both targets — only packaging and auth differ
- HA OS / Supervised are the dominant HA install types — this is the right primary target
- Docker HA users (no supervisor) will wait for the Docker version — they understand the limitation

---

## The Two Products (Addon First, Docker Later)

### Product 1: PistonCore Addon (PRIMARY — Build This First)
- Runs on: HA OS, HA Supervised
- Install: User adds GitHub repo URL to HA addon store, installs like any other addon
- What it does: Full hybrid — simple pistons compile to native HA YAML, complex pistons
  run via PistonCore's own WebSocket runtime
- Auth: Gets HA supervisor token automatically — zero user setup
- File writing: Writes directly to /config/automations/, calls automation/reload via REST
- No companion needed, no HACS needed
- Distribution: GitHub addon repo

### Product 2: PistonCore Docker (SECONDARY — Build Later)
- Runs on: Unraid, NAS, any Docker host, Docker-based HA installs
- Install: Docker Hub / Unraid Community Apps
- What it does: Compiler only — compiles pistons to native HA YAML, pushes via REST API
- Complex pistons: Available in editor with warning banner, no runtime execution
- Auth: Long-lived HA token entered once in PistonCore settings
- File writing: Calls HA REST API directly with token — no companion needed
- Distribution: Docker Hub, Unraid Community Apps, GitHub

### Docker HA Users (homeassistant/home-assistant container)
- Cannot install HA addons — no supervisor
- Will use Docker version when it's built
- REST API still works fine for them — same token approach
- Reasonable to tell them "Docker version coming later"

---

## The Compiler Output Model

### Compiler output targets — extensible list, not hardcoded
The compiler selects an output target based on piston complexity. This is designed
as an extensible list so adding new targets in future is an addition not a rewrite.

### v1 Output Targets
**Simple → Native HA YAML**
- Basic triggers: state change, time, sun, etc.
- Basic conditions: state, time, numeric comparisons
- Basic actions: service calls, delays, notifications
- Output: Native HA automation YAML — HA fully owns it, traces work, survives restarts

**Complex → PyScript**
- Variables and math
- Loops and repeat logic
- Dynamic conditions
- Anything needing persistent state
- Output: PyScript file deployed to HA /config/pyscript/
- PyScript must be installed in HA as a separate integration (HACS)
- This is unchanged from original design — compiler mostly built, keep it

### v2 Output Target (architecture ready, not built yet)
**Complex → PistonCore Native Runtime**
- Same complex piston features as PyScript
- Runs inside PistonCore addon via persistent WebSocket connection to HA
- No PyScript dependency — PistonCore owns the execution engine
- When built, replaces PyScript as the complex piston target
- AppDaemon worth evaluating as the foundation — already solves HA WebSocket
  persistent connection, reconnection, and async execution. Could cut v2 runtime
  development time significantly. Review before designing from scratch.
- Piston JSON format does not change between v1 and v2 — same file, different output target

### Piston JSON is the permanent master format
- Pistons are always saved as JSON in PistonCore storage — never lost
- JSON is the source of truth for sharing, backup, and recompilation
- Compiled output (YAML or PyScript) is always regeneratable from the JSON
- This is a core architectural principle — state it explicitly in DESIGN.md

### What Replaced the HACS Companion
HA REST API called directly:
- `POST /api/config/automation/config/{automation_id}` — create/update automation
- `POST /api/services/automation/reload` — reload automations
- Addon uses supervisor token. Docker uses long-lived token. That's it.
- PistonCore never touches HA core files — only files it created itself

---

## Design Documents — Rewrite Needed Before Coding Resumes

ALL of these are stale. Rewrite at the START of the next coding session, before any code changes.

### DESIGN.md — Full rewrite to v1.0
- Keep PyScript as v1 complex piston output — do NOT remove
- Remove HACS companion references — replaced by direct REST API calls
- Add two-product architecture (addon primary, Docker secondary)
- Add compiler output targets as extensible list (YAML, PyScript for v1; runtime for v2)
- Add v2 runtime engine section — architecture designed in, not built yet
- Add note to evaluate AppDaemon as v2 runtime foundation before designing from scratch
- Add piston JSON as permanent master format — core architectural principle
- Add deployment target section
- Update auth model (supervisor token for addon, long-lived token for Docker)
- Add versioned template folder structure (ha_YYYY.x/) for YAML compiler templates
- Add versioned ha_api/ folder structure for HA endpoint externalization
- Add piston JSON schema_version field and migration strategy
- Add HA version detection at startup sequence
- Add BASE_URL pattern to frontend architecture section
- Add compiler error/warning object shape to compiler spec
- Add global variable naming rules and pistoncore_ prefix convention
- Update Section 5: "No entity IDs ever visible" — compromise reached in Session 15:
  show friendly name prominently, append parsed entity suffix to disambiguate
  ("Basement — Volume"). No raw entity_id shown.
- Keep all still-valid sections

### FRONTEND_SPEC.md — Update
- Add complexity indicator UI element
- Add Docker vs Addon feature availability flags
- Remove PyScript-related UI elements
- Everything else stays

### WIZARD_SPEC.md — Minor update
- Note which wizard features are runtime-only vs compiler
- Otherwise largely unchanged

### README.md — Rewrite
- Was flagged stale in Session 13, still stale
- Two-product install story
- Feature comparison table (addon vs Docker)
- Remove all "planned" language for things already built

---

## Open Architecture Questions (Resolve Before Coding)

1. **Complex pistons in Docker version** — show features with warning banner and allow
   building but block deployment? Or hide complex features entirely in Docker?
   Current thinking: show with warning, allow building, block deployment.

2. **Global variables in addon runtime** — push to HA input_boolean/input_number helpers,
   or stay internal to PistonCore only? Has UX implications for HA dashboard use.

3. **Addon ingress vs direct port** — HA addons can expose a port directly OR use ingress
   (cleaner but adds path prefix). Must decide before building addon UI.

4. **Docker version runtime mode** — if PistonCore Docker is running on the same host as HA,
   should it ever support runtime mode? Or keep Docker strictly compiler-only forever?

5. **Global variables** — push to HA input helpers or stay internal to PistonCore only?

---

## Infrastructure — Current Dev Setup (Unchanged)

- Unraid server at 192.168.1.226, port 7777
- Files are copied directly over the network to Unraid — NOT deployed via git pull
  (git pull has a caching issue that overwrites changes)
- Jeremy pushes to GitHub manually after a session's fixes are confirmed working
- Docker rebuild command:
  ```
  cd /mnt/user/appdata/pistoncore-dev
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

Note: Dev environment will stay Docker on Unraid during development. The addon packaging
is a future step — build and validate the core functionality in Docker first, then package
as an addon.

---

## HA Connection — Working as of Session 15

- HA settings modal opens by clicking the "HA Disconnected" badge in the header
- Saves ha_url and ha_token via `PUT /config`
- Tests connection via `GET /devices`
- Badge updates to "HA Connected" on success
- Jeremy's HA is at http://192.168.1.65:8123
- Long-lived token is saved in config — Jeremy has it ready if needed

---

## Three Pages — Confirmed Layout

1. **List page** — home screen, OK as-is
2. **Status/Debug page** — land here after saving or clicking a piston
3. **Editor page** — full width, no centering, fills viewport, continuous document renderer

---

## Device Picker — Current State

The condition wizard device panel now:
- Connects to real HA and shows live devices ✅
- Filters to useful domains only (light, switch, binary_sensor, sensor, etc.) ✅
- Parses entity_id to disambiguate duplicate friendly names ("Basement — Volume") ✅
- Sorts by area then name ✅

---

## Known Bugs — Fix List for Session 16

### ⚠️ Do design doc rewrites BEFORE touching any of these

### PRIORITY 1 — HA Device List Quality

**Problem:** Even with domain filtering, the device list still has issues:
- Some entities that shouldn't appear are still showing (HA auto-discovered integrations
  like Sonos that Jeremy didn't set up — these appear as media_player entities)
- Virtual test devices Jeremy set up in HA are not showing correct state/attributes
  in the attribute picker (may be a virtual device config issue, not a PistonCore bug —
  verify with real physical devices first)
- HA has entities for devices "not actually set up" — these come from HA's auto-discovery
  (mDNS/SSDP). No clean way to filter these without user input. Options to discuss:
  1. Add an "Only show devices in areas" filter toggle — devices without an area assigned
     are often auto-discovered junk
  2. Let user hide specific entities from the picker (My Device Definitions screen)
  3. Accept it as a known HA limitation and document it

### PRIORITY 2 — Wizard: AND/OR prompt between conditions (Add more)

- WebCoRE asks how new condition relates to previous one (AND or OR)
- Currently just stacks conditions with no group_operator set
- Fix: after first condition is added, prompt for AND/OR before building next one

### PRIORITY 3 — Wizard: Operator order still wrong

- Triggers should appear FIRST with ⚡ prefix
- Conditions second
- Currently reversed in PistonCore

### PRIORITY 4 — Wizard: Orange "Any of the selected devices" banner

- Should appear above compare row when ANY device is selected (not just multi-device)
- Currently hidden until multiple devices selected
- Partially fixed in Session 15 but needs verification with real devices

### PRIORITY 5 — Wizard: Value input for binary/enum attributes from real HA devices

- When a real HA device is selected (not demo), attribute type comes from
  `API.getCapabilities(entity_id)` — but the value widget isn't updating correctly
  for binary/enum types from real devices
- For demo devices this works. For real HA devices verify it works after HA connects.

---

## Backend / Compiler Gaps — Fix AFTER Wizard Works End to End

These don't affect the browser UI but matter when Deploy is wired up.

1. **Wizard produces `service_call`, compiler expects `with_block`**
   - `_saveDeviceCmd()` produces `{type:"service_call", devices:[entityId]}`
   - Compiler `_compile_sequence()` has no handler for `service_call`
   - Fix: add `_normalize_action()` to compiler, or make wizard produce `with_block`

2. **Entity ID vs Role in device_map**
   - Wizard stores `entity_id` on subject but compiler resolves via `device_map[role]`
   - Need `_entityToRole()` in wizard and `Editor.registerDeviceRole()` to auto-populate
     `piston.roles` and `piston.device_map` when user picks a device

3. **Trigger format mismatch**
   - Wizard produces `{type:"trigger", operator:"changes to", compiled_value:"on"}`
   - Compiler expects `{type:"state", target_role:"...", to:"on"}`
   - Fix: add `_normalize_trigger()` pre-processing step in compiler

4. **Binary sensor compiled_value lookup must live in wizard**
   - DEVICE_CLASS_LABELS table (door→Open/Closed, motion→Detected/Clear, etc.)
     must be in wizard so it sets `compiled_value` correctly before saving
   - Compiler reads `compiled_value` directly into HA YAML — wrong value = silent HA failure

---

## Editor Document — Confirmed Rendering Rules

### Simple mode shows:
- Comment header block
- settings / end settings
- define block — ALWAYS shown in both Simple and Advanced (Jeremy uses it constantly)
- execute block with `· add a new statement`
- NO "only when" blocks unless they have content

### Advanced mode shows everything including:
- only when (restrictions) block with ghost text
- only when inside execute (triggers/conditions) with ghost text

### Mode persistence:
- Simple/Advanced preference saved to localStorage (`pc_simpleMode`)
- Default is Advanced (Jeremy prefers Advanced)

### Define block rendering — matches WebCoRE:
```
device light = Cave Light ;
```

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

### NEVER two modals open at once
- if_block selection goes to condition builder FIRST
- Only inserts if_block AFTER condition is completed
- Uses `_extra['block-id']` exclusively — unified mechanism

### Wizard backdrop — no dark overlay
- Backdrop is transparent
- Modal is centered, floats over document

### Condition builder layout:
- ONE screen, everything visible at once
- Row: `[Physical device(s) ▾]` `[device picker button]` `[attribute ▾]`
- Device picker opens inline panel BELOW the row with search
- "Which interaction" row always visible (not conditional on device selection)
- Operator dropdown below that (Triggers first ⚡, Conditions second)
- Value row appears below operator when needed — textarea for free text types

### Modal size:
- 720px wide, fills most of screen height
- wiz-body scrolls, modal does not grow

### Value inputs:
- Binary/enum attributes → dropdown of actual values
- Numeric attributes → number input with unit
- Free text (Value/Variable/Expression/Argument) → textarea that wraps

---

## Session 15 — What Was Fixed

1. ✅ Device picker changed to inline panel with search
2. ✅ Static domain capability map added (DOMAIN_CAPS) for offline/local variable use
3. ✅ Local device variable caps now derived from entity domain instead of hardcoded "switch"
4. ✅ Modal size increased to 720px wide, full height
5. ✅ Value inputs changed to textareas for free-text types
6. ✅ Orange "Any of the selected devices" banner added (shows on device select)
7. ✅ "Which interaction" row always visible
8. ✅ HA settings modal built — click badge to open, save URL+token, test connection
9. ✅ HA WebSocket connection working — real devices loading in wizard
10. ✅ Domain filter added to ha_client.py — junk entities removed
11. ✅ Entity label parser added — "Basement — Volume" disambiguation
12. ✅ Devices sorted by area then name

---

## Files Changed in Session 15

- `frontend/js/wizard.js` — device picker, caps, modal size, value inputs, banner
- `frontend/css/style.css` — modal size, wiz-body scrolling, spacing
- `frontend/js/app.js` — HA badge click, HASettings module, checkHAConnection
- `frontend/index.html` — HA settings modal markup
- `backend/ha_client.py` — domain filter, label parser, area sort

---

## Future Plans (noted, not blocking)

- Addon packaging (after core is working and validated in Docker dev environment)
- v2 PistonCore native runtime engine to replace PyScript (evaluate AppDaemon first)
- AND/OR prompt between conditions (Priority 2 above)
- Virtual test devices in HA
- Login system (post-v1)
- Cloud hosting (after login)
- "Only show devices in areas" filter toggle for device picker
- My Device Definitions screen (hide/rename entities from picker)
- WebCoRE-style toolbar icons
- Docker product (after addon is solid)

---

## Session Log Summary

Sessions 1-11: Design, backend, Docker, frontend scaffold.
Session 12: Editor + wizard rewrites. Demo devices. Multiple bugs found, partially fixed.
Session 13: Major wizard and editor fixes. Variable wizard layout, define block rendering,
            mode persistence, condition picker improvements, edit-in-place for statements.
Session 14: Condition builder inline device/attribute pickers. Demo device search fix.
            Argument option added. Add more reset. Any-of single device fix. CSS for dropdowns.
            Attribute changed to native select. COMPILER_SPEC open item 8 added.
Session 14.5: wizard.js and editor.js structural bug fixes. Step stack, device selection,
              refreshConditionRows, operator order, if_block unified mechanism.
Session 15: Wizard improvements (larger modal, device search panel, domain caps map,
            context-aware value inputs, agg banner). HA settings page with WebSocket
            connection. Real devices loading. Domain filter + label disambiguator in backend.
Session 16: Architecture pivot discussion. HACS companion dropped — replaced by direct REST
            API. Primary target shifted to native HA Addon. Docker version secondary (later).
            PyScript KEPT for v1 — compiler mostly built, no reason to discard. Native runtime
            engine planned for v2 — AppDaemon flagged as potential foundation to evaluate.
            Piston JSON confirmed as permanent master format — core principle. Seven design
            decisions documented for DESIGN.md rewrite. No code written this session.

---

## Next Session — Start Here

1. Read this prompt fully — pay close attention to Architecture Pivot and Compiler Output Model
2. This is a design document rewrite session — confirm with Jeremy before touching any code
3. Resolve open architecture questions with Jeremy (listed above)
4. Rewrite DESIGN.md to v1.0 using the checklist above — this is the priority
5. Update FRONTEND_SPEC.md (BASE_URL standard, complexity indicator, feature flags)
6. Update WIZARD_SPEC.md (note PyScript vs runtime for complex features)
7. Rewrite README.md (two-product story, remove stale planned language)
8. After documents done: ask Jeremy to upload files and resume bug fix list
9. Bug fix priority: Priority 1 (device list quality) → Priority 2 (AND/OR) → etc.
10. After each fix: give Jeremy yes/no test checklist, wait for screenshot
11. Generate updated session prompt at end of session
