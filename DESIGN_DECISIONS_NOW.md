# PistonCore — Design Decisions Needed Now
# Written: Session 16
# Purpose: Things that must be addressed in DESIGN.md rewrite to avoid expensive rework later
# Add to session prompt and address at start of next coding session

---

## 1. Template Versioning Structure (HA Compatibility)

### Problem
HA breaks automation YAML schema regularly. If templates are built without version
awareness, every HA release that changes syntax requires a PistonCore release.

### Decision Needed
Adopt this folder structure before building more compiler templates:

```
pistoncore-customize/
  templates/
    ha_2024.x/
      automation.j2
      condition.j2
      action.j2
    ha_2025.x/
      automation.j2
      condition.j2
      action.j2
```

- PistonCore detects HA version at connect via `GET /api/`
- Loads template set matching detected version
- Falls back to nearest older version if exact match not found
- Users can edit templates in PistonCore UI (built-in code editor, CodeMirror)
- Power users can edit files directly via HA file editor (addon exposes folder to /config/)
- Community can submit template packs for new HA versions without a PistonCore release

### GitHub Update Flow
- Separate template repo (or subfolder) on GitHub tagged by HA version
- PistonCore shows "Template update available for HA X.Y" banner when newer templates exist
- User clicks to pull — no PistonCore restart needed
- Fallback: manual zip upload through PistonCore UI for offline installs

### What To Do In DESIGN.md
- Define folder structure above as the standard
- Define version detection behavior (startup, on reconnect)
- Define fallback behavior
- Define community contribution process
- Note that existing templates need to be reorganized into versioned folders

---

## 2. Piston JSON Schema Versioning

### Problem
Piston files are stored as JSON. As PistonCore evolves, the schema will change.
Without a version field, there is no way to migrate old pistons automatically.
Users who built pistons in early versions will get silent failures or broken behavior.

### Decision Needed
Add a `schema_version` field to every piston JSON now, before users start creating real pistons.

```json
{
  "schema_version": 1,
  "id": "abc123",
  "name": "My Piston",
  ...
}
```

- PistonCore checks `schema_version` on load
- If version is older than current, runs migration function before use
- Migration functions are stackable (v1→v2→v3)
- If version is missing, treat as v1 (legacy)

### What To Do In DESIGN.md
- Add `schema_version` to piston JSON spec
- Define migration strategy (stackable functions in backend)
- Define what happens when schema is unknown/future version (warn user, refuse to load)

---

## 3. HA Version Detection at Startup

### Problem
Template versioning and future compatibility features depend on knowing what HA version
PistonCore is connected to. If this isn't wired in early, every place that touches
templates assumes a fixed path and has to be found and updated later.

### Decision Needed
On every HA connect (startup and reconnect):
1. Call `GET /api/` — returns HA version in response
2. Store version in PistonCore config/memory
3. Use version to select correct template folder
4. Show detected HA version in PistonCore header or settings page
5. Re-check on reconnect in case HA was updated

### What To Do In DESIGN.md
- Add HA version detection to startup sequence
- Add version display to settings/status area
- Note that template selection is driven by detected version

---

## 4. Frontend Base URL / Ingress Path Prefix

### Problem
HA addon ingress proxies traffic through a path prefix (e.g., `/api/hassio_ingress/abc123/`).
If frontend JS hardcodes API paths like `/api/pistons`, they break under ingress.
Fixing 15+ JS files after the fact is painful and error-prone.

### Decision Needed
Define a single `BASE_URL` constant in the frontend before more JS is written.
All API calls use `BASE_URL + '/api/pistons'` not hardcoded `/api/pistons`.

```javascript
// frontend/js/config.js
const BASE_URL = window.PISTONCORE_BASE_URL || '';
```

- Docker version: `BASE_URL` is empty string, paths work as-is
- Addon ingress version: `BASE_URL` is injected by the backend at page serve time
- Zero impact on current Docker dev workflow — empty string means no change

### What To Do In DESIGN.md
- Add `BASE_URL` pattern to frontend architecture section
- Note this is required for addon ingress compatibility
- Add to FRONTEND_SPEC.md as a coding standard

---

## 5. Compiler Error/Warning Contract

### Problem
The compiler returns errors and warnings but there is no defined standard for their shape.
If each compiler module returns errors differently, the UI layer becomes inconsistent
and hard to maintain. Fixing the contract after the compiler is fully built means
touching every module.

### Decision Needed
Define the error object shape once now:

```json
{
  "level": "error | warning | info",
  "code": "TRIGGER_FORMAT_MISMATCH",
  "message": "Human readable explanation",
  "context": "optional: which piston block caused this"
}
```

- Compiler always returns `{ yaml: "...", errors: [], warnings: [] }`
- UI has one error display component that handles all compiler output
- Error codes allow future localization without changing logic

### What To Do In DESIGN.md
- Add error object shape to compiler spec section
- Add return contract to compiler API spec
- Update FRONTEND_SPEC.md with error display component requirements

---

## 6. Global Variable Naming Convention

### Problem
If globals are ever pushed to HA input helpers (input_boolean, input_number, etc.),
the helper entity_id is derived from the variable name. Globals named casually
(e.g., "my var", "test", "x") will either fail HA validation or collide with
existing helpers. Changing the naming convention after users have created globals
breaks their existing pistons.

### Decision Needed
Define a naming rule now:
- Globals must be lowercase, underscores only, no spaces (enforce in UI)
- PistonCore prefixes all HA helper names with `pistoncore_` to avoid collisions
  (e.g., global "motion_count" → HA helper `input_number.pistoncore_motion_count`)
- UI enforces naming rule at creation time with clear error message

### What To Do In DESIGN.md
- Add global variable naming rules to globals section
- Add `pistoncore_` prefix convention for HA helper integration
- Add UI validation requirement to FRONTEND_SPEC.md

---

## 7. HA API Call Externalization

### Problem
`ha_client.py` currently has HA REST API endpoints and response field names hardcoded
in Python. When HA changes an API response format or endpoint path, it requires a
PistonCore code release to fix — users are stuck waiting. Same problem as YAML schema
changes but on the API call side.

### Decision Needed
When `ha_client.py` is refactored for addon auth (supervisor token vs long-lived token),
externalize all HA endpoint URLs and response field mappings to config files in the
customize volume at the same time. One pass, done forever.

```
pistoncore-customize/
  templates/          ← YAML compiler templates (item 1)
  ha_api/             ← HA API call definitions
    ha_2025.x/
      endpoints.json  ← URL paths for every HA API call PistonCore makes
      fields.json     ← response field names PistonCore reads from HA responses
```

Example endpoints.json:
```json
{
  "get_states": "/api/states",
  "get_services": "/api/services",
  "get_version": "/api/",
  "call_service": "/api/services/{domain}/{service}",
  "reload_automations": "/api/services/automation/reload",
  "write_automation": "/api/config/automation/config/{automation_id}"
}
```

- `ha_client.py` loads endpoints.json on startup, never has hardcoded URLs
- When HA changes an endpoint, user updates endpoints.json — no PistonCore release needed
- Same versioned folder structure as YAML templates — community maintainable
- Same GitHub update flow — PistonCore shows "API update available" banner

### When To Do This
During the `ha_client.py` refactor for addon auth. Not before, not after — at the same time.
Doing it separately costs an extra session. Doing it together costs maybe 30 extra minutes.

### What To Do In DESIGN.md
- Add `ha_api/` folder to customize volume structure
- Add endpoint externalization to ha_client architecture section
- Note that this is done during addon auth refactor, not as standalone work

---

## Summary — What Goes Into DESIGN.md Rewrite

All seven items above need sections or updates in DESIGN.md v1.0.
None require code changes right now — they are design decisions that shape
how code gets written going forward.

**Also add to DESIGN.md:**
- PyScript stays as v1 complex piston output — compiler mostly built, keep it
- Piston JSON is the permanent master format — core architectural principle, state explicitly
- Compiler output targets documented as extensible list — YAML and PyScript for v1,
  native runtime added in v2 without changing piston JSON or frontend
- v2 runtime engine section — evaluate AppDaemon as foundation before designing from scratch.
  AppDaemon already handles HA WebSocket persistent connection, reconnection, and async
  execution. Building PistonCore runtime on top of AppDaemon could cut v2 development
  time significantly vs building from scratch.

Priority order for the rewrite:
1. Items 1, 2, 3, 7 — template versioning, schema versioning, HA version detection,
   API externalization (all tightly coupled, design together)
2. Item 4 — BASE_URL (quick, add to frontend spec)
3. Item 5 — compiler error contract (add to compiler spec)
4. Item 6 — global variable naming (add to globals section)
5. PyScript/runtime/extensible output target section (add to compiler architecture)
