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

---

## 8. Fat Compiler Context Object

### Problem
If Python transforms HA data before handing it to Jinja2, any HA change to data
structure still requires a Python code change — the templates can't save you.
This defeats the purpose of the template system.

### Decision Needed
The compiler must pass a "fat" context object to every Jinja2 template — over-fetch
data from HA so templates have more than they need. Logic that selects or transforms
data lives in the template (Jinja2), not in the Python core. Python fetches and passes;
the template decides what to use.

### What To Do In DESIGN.md
- Add "fat context" rule to compiler architecture section
- Define the standard compiler context object — list exactly what data is available
  to Jinja2 (device states, entity attributes, variable values, helper entities, etc.)
- This list becomes the contract for template authors

---

## 9. Template Folder Manifest File

### Problem
If a user falls back to an older template set and that template uses a deprecated HA API,
the result is a cryptic Jinja2 error. No way to know if a template pack requires a newer
PistonCore version than installed.

### Decision Needed
Every versioned template folder must contain a manifest.json:

```json
{
  "ha_version_min": "2025.1",
  "ha_version_max": "2025.12",
  "pistoncore_version_min": "1.0",
  "description": "Templates for HA 2025.x automation schema"
}
```

- PistonCore reads manifest before loading any template
- If pistoncore_version_min is higher than installed: clean error "Please update PistonCore"
- If HA version outside supported range: warn user, don't silently fall back
- Same manifest applies to ha_api/ versioned folders

### What To Do In DESIGN.md
- Add manifest.json requirement to template folder spec
- Define all manifest fields and fallback/error behavior
- Apply same requirement to ha_api/ folders

---

## 10. HA API Header Templates

### Problem
HA addon ingress requires specific headers that differ from external REST calls.
If endpoints.json only stores URLs, header differences still require Python changes.

### Decision Needed
Extend endpoints.json to include a headers section per endpoint:

```json
{
  "get_states": {
    "url": "/api/states",
    "headers": {
      "Authorization": "Bearer {token}",
      "Content-Type": "application/json"
    }
  }
}
```

- Token value injected at runtime — never stored in the file
- Addon and Docker deployments can define different headers without Python changes

### What To Do In DESIGN.md
- Update ha_api/ endpoints.json format to include headers section
- Note token injection is runtime only, never stored
- Note addon and Docker may have different header requirements

---

## 11. Separate ui_version and logic_version in Piston JSON

### Problem
A single schema_version forces migration whenever either frontend layout OR compiler
logic changes. These change independently — a drag-and-drop library swap shouldn't
force compiler migration and vice versa.

### Decision Needed
Replace schema_version (item 2) with two fields:

```json
{
  "logic_version": 1,
  "ui_version": 1,
  "id": "abc123",
  "name": "My Piston"
}
```

- logic_version — compiler-facing schema (triggers, conditions, actions tree)
- ui_version — frontend-facing layout data (block positions, editor state)
- Separate migration function stacks for each

### What To Do In DESIGN.md
- Replace schema_version with logic_version and ui_version
- Define what belongs to each version scope
- Define separate migration stacks

---

## 12. Piston Identity Rule

### Problem
No documented rule for how piston ID maps to HA automation ID means future contributors
can break the mapping accidentally, orphaning automations or overwriting the wrong one.

### Decision Needed
Define as immutable core invariant:
- Every piston gets a UUID on creation — never changes even if piston is renamed
- HA automation ID is always pistoncore_{uuid}
- PyScript file is always pistoncore_{uuid}.py
- This is the permanent link between PistonCore and HA

### What To Do In DESIGN.md
- Add piston identity rule as a core invariant section
- State explicitly: UUID is immutable from creation
- State explicitly: all HA artifacts derived from UUID, never from piston name

---

## 13. Orphan Automation Cleanup

### Problem
When a piston is deleted in PistonCore, the compiled HA automation keeps running.
No cleanup strategy is defined.

### Decision Needed
On piston delete:
1. Call HA to delete the automation (DELETE /api/config/automation/config/{id})
2. Delete PyScript file if one exists
3. Call automation/reload
4. If HA is offline, queue the cleanup and retry on next connect
5. PistonCore maintains a "pending cleanup" list in userdata for failed deletes

### What To Do In DESIGN.md
- Add orphan cleanup to piston delete flow
- Add pending cleanup queue to userdata storage spec
- Define retry behavior on reconnect

---

## 14. v2 Runtime Engine — Hard Choice Required

### Problem
If AppDaemon is used for v2, PistonCore has three output targets: YAML, PyScript,
AppDaemon. Three targets is a long term maintenance burden that gets worse over time.

### Decision Needed
Two options — pick one before v2 design starts:

Option A: AppDaemon for v2 runtime
- Pros: Handles WebSocket plumbing, state tracking, scheduler out of the box
- Cons: Heavy dependency, three output targets, essentially writing an AppDaemon app generator

Option B: Slim internal async runner (recommended)
- Pros: PistonCore owns the stack, no external dependency, two output targets max
- Cons: More build work — must handle WebSocket reconnection, async execution, state cache
- When v2 ships: PyScript deprecated, eventually removed. YAML + internal runtime only.
- Piston JSON does not change — same file, different output target

Recommendation: Option B. Maintenance tax of three targets is worse than build cost
of the runner. State this direction in DESIGN.md now so v2 design starts right.

### What To Do In DESIGN.md
- Add v2 runtime section with Option A/B tradeoff documented
- State chosen direction (Option B recommended)
- Note PyScript deprecated in v2, removed in v3
- Note piston JSON does not change between v1 and v2

---

## Updated Summary — What Goes Into DESIGN.md Rewrite

All 14 items need sections or updates in DESIGN.md v1.0.
Items added from Gemini review: 8, 9, 10, 11, 12, 13, 14.

Priority order:
1. Items 1, 2/11, 3, 7, 8, 9, 10 — template system, versioning, API externalization
   (all tightly coupled — design together, item 2 replaced by item 11)
2. Item 4 — BASE_URL (quick frontend spec addition)
3. Item 5 — compiler error contract
4. Item 6 — global variable naming
5. Items 12, 13 — piston identity rule, orphan cleanup (core invariants)
6. Item 14 — v2 runtime direction (sets long term trajectory)
7. PyScript/runtime/extensible output target section

---

## 15. Test Compile / Preview Mode

### Problem
Users editing templates or building pistons have no way to see the compiled YAML output
before deploying to HA. A bad template edit or piston configuration silently breaks
their automations. With community-editable templates this is a critical gap.

### Decision Needed
Add a "Test Compile" / Preview mode as a required feature — not optional:
- Available on every piston from the status page
- Shows the full compiled YAML (or PyScript) output in a read-only code view
- Does NOT deploy to HA — purely a preview
- Compiler errors and warnings shown inline
- Template editors get live preview as they edit

### What To Do In DESIGN.md
- Add Test Compile as required feature in compiler spec section
- Add preview panel to status page spec in FRONTEND_SPEC.md
- Note that template editing UI must include live preview

---

## 16. PyScript Detection and Setup Prompt

### Problem
Users installing PistonCore as an addon expect everything to work out of the box.
Complex pistons require PyScript — a separate HACS integration install. Without
detection and clear UI guidance, users hit a wall with no explanation.

### Decision Needed
PistonCore must detect whether PyScript is installed in HA before allowing complex
piston deployment:
- On connect, check for PyScript integration via HA REST API
- If not found and user attempts to deploy a complex piston: show clear setup prompt
  "Complex pistons require PyScript. Install it via HACS first."
- Link to PyScript HACS page directly from the prompt
- Once v2 runtime ships, this prompt goes away entirely

### What To Do In DESIGN.md
- Add PyScript detection to startup/connect sequence
- Add setup prompt behavior to complex piston deploy flow
- Add to WIZARD_SPEC.md — wizard should warn before user builds a complex piston
  if PyScript is not detected

---

## 17. Template Manifest — Additional Fields

### Problem
Item 9 defined the basic manifest.json spec. Grok identified two additional fields
worth including now so the structure doesn't need to change later.

### Decision Needed
Add to manifest.json spec:

```json
{
  "ha_version_min": "2025.1",
  "ha_version_max": "2025.12",
  "pistoncore_version_min": "1.0",
  "description": "Templates for HA 2025.x automation schema",
  "compatibility_warnings": [
    "2025.6: service call syntax changed for light.turn_on"
  ],
  "checksum": "sha256:abc123"
}
```

- compatibility_warnings — array of human-readable notes about subtle behavioral
  changes that aren't breaking but worth knowing. Shown in PistonCore UI.
- checksum — sha256 of the template folder contents for community pack validation.
  Field exists now even if validation is not enforced until post-v1.

### What To Do In DESIGN.md
- Add compatibility_warnings and checksum to manifest.json spec in item 9

---

## 18. Addon Ingress + Direct Port — Support Both

### Problem
Choosing only ingress or only direct port locks out valid use cases. Ingress is
HA-recommended and cleaner for most users. Direct port is needed for Docker dev
and some advanced setups. Forcing one breaks the other.

### Decision Needed
Support both as options in addon config:
- Default: ingress enabled (HA-recommended, auth handled by HA, single port)
- Option: direct port exposure for users who need it
- BASE_URL handling (item 4) already covers the path prefix issue
- Test both paths thoroughly before release — many addons get this wrong

### What To Do In DESIGN.md
- Add ingress + direct port as dual-support to addon architecture section
- Note that BASE_URL handles path prefix differences transparently
- Add to open architecture questions: confirm default (ingress) before building UI

---

## 19. Background Compile / Debounce on Save

### Problem
With many pistons, compiling and deploying on every save could be noticeably slow.
If compile blocks the UI thread or hammers HA's API, the editor feels broken.

### Decision Needed
- Compilation runs as a background job — never blocks the UI
- Deploy to HA is separate from save — user explicitly deploys, or auto-deploy is debounced
- Show compile status indicator in UI (compiling / compiled / error)
- Define debounce window if auto-deploy is used (e.g., 2 seconds after last change)

### What To Do In DESIGN.md
- Add background compile job to backend architecture section
- Add compile status indicator to FRONTEND_SPEC.md
- Define auto-deploy debounce strategy

---

## 20. Token Security and Minimal Privilege

### Problem
Long-lived tokens and supervisor tokens grant broad HA access. No documented guidance
on minimal privilege or token rotation means users will use admin tokens unnecessarily
and never rotate them.

### Decision Needed
- Document recommended minimal HA token scope in setup UI and docs
- Recommend users create a dedicated HA user for PistonCore with only necessary permissions
- Add token rotation guidance to settings page
- Supervisor token: document that it is handled automatically and never exposed to user

### What To Do In DESIGN.md
- Add security section covering token scope, rotation, and supervisor token handling
- Add setup guidance to README.md

---

## Final Summary — All 20 Items for DESIGN.md Rewrite

Original items: 1-7
Added from Gemini review: 8-14
Added from Grok review: 15-20

Priority order (unchanged for 1-14, additions at end):
1. Items 1, 3, 7, 8, 9, 10, 17 — template system + manifest + API externalization
   (design together — tightly coupled, item 11 replaces item 2)
2. Item 4 + 18 — BASE_URL and ingress/port decision
3. Items 5, 19 — compiler contract and background compile
4. Items 6, 20 — global naming and token security
5. Items 12, 13 — piston identity and orphan cleanup
6. Item 14 — v2 runtime direction
7. Items 15, 16 — test compile preview and PyScript detection
8. PyScript/runtime/extensible output target section

---

## 21. PyScript as Permanent Docker Output Target

### Problem
Current documents frame PyScript as a temporary v1 stepping stone that gets deprecated
everywhere in v2. This is wrong. PyScript is only deprecated for the addon target.
Docker users are power users who are comfortable with HACS and don't need a native runtime.
Framing PyScript as temporary everywhere undersells the Docker product and creates
unnecessary confusion about its long term support.

### Decision Needed
PyScript is a permanent, long term supported output target for the Docker deployment.
It is never deprecated for Docker users.

The correct framing by deployment:

Addon target:
- v1: Simple → YAML, Complex → PyScript (requires HACS install, user prompted)
- v2: Simple → YAML, Complex → native internal runtime (PyScript no longer needed)
- v3: PyScript output target removed from addon

Docker target:
- v1: Simple → YAML, Complex → PyScript (permanent, long term supported)
- v2: Simple → YAML, Complex → PyScript (unchanged) OR native runtime if user wants it
- No deprecation planned for Docker PyScript support

This also makes Docker a stronger product in its own right — not a "lite" version
but a full featured alternative for power users who prefer external deployment,
run Unraid/NAS, and are comfortable with HACS. That is a real and significant audience.

No addon companion needed for PyScript on Docker. PyScript is a HACS integration
users install once. PistonCore Docker just generates the files. Low ongoing burden.

### What To Do In DESIGN.md
- Add explicit statement: PyScript is permanently supported for Docker target
- Update two-product table to show Docker keeps PyScript long term
- Update v2 runtime section: native runtime is addon-only, Docker keeps PyScript
- Remove any language implying PyScript is deprecated everywhere in v2
- Frame Docker product as full featured power user alternative, not lite version

---

## 22. Frontend Must Never Talk To HA Directly

### Problem
If any frontend JavaScript ever calls HA APIs directly using the supervisor token,
that is a security vulnerability. The supervisor token must never leave the backend.

### Decision Needed
Hard rule — non-negotiable:
- All HA communication goes through the PistonCore backend only
- Frontend calls PistonCore API endpoints only
- Backend calls HA — never the frontend
- Supervisor token is backend-only, never exposed to frontend or browser
- Enforce this in code review and document it as a security invariant in DESIGN.md

### What To Do In DESIGN.md
- Add as security invariant: frontend never touches HA directly
- Add to FRONTEND_SPEC.md as a hard rule
- Note: if JS ever fetches from HA directly that is a bug, not a feature

---

## 23. HAClient Abstraction — Urgent, Before More Features

### Problem
Auth logic for supervisor token (addon) vs long-lived token (Docker) will sprawl
into multiple files if not centralized now. Fixing scattered auth later requires
touching every file that makes HA calls.

### Decision Needed
Define and implement HAClient abstraction before any more backend features are built:

```python
HAClient(auth_mode="supervisor" | "token", token=None)
```

- Single class handles all HA communication
- Auth mode is config-only — rest of codebase never knows which mode is active
- Supervisor token injected via SUPERVISOR_TOKEN environment variable — never stored
- All HA API calls go through this class — nothing else calls HA directly
- This is urgent — do it before addon packaging work starts

### What To Do In DESIGN.md
- Add HAClient as a core backend component
- Define auth_mode interface
- Add to backend architecture section
- Flag as must-do before addon packaging

---

## 24. WebSocket Connections Also Need BASE_URL Treatment

### Problem
Item 4 (BASE_URL) covers HTTP API paths. Ingress also affects WebSocket connections
and static assets. The trace/debug WebSocket will break under ingress if it uses
a hardcoded path.

### Decision Needed
BASE_URL treatment applies to ALL frontend connections — not just fetch calls:
- WebSocket connections use BASE_URL prefix
- Static asset paths use BASE_URL prefix
- Absolute URLs anywhere in frontend use BASE_URL prefix
- No exceptions — ingress will break anything hardcoded

### What To Do In DESIGN.md
- Expand BASE_URL section to explicitly cover WebSockets and static assets
- Add to FRONTEND_SPEC.md: BASE_URL applies to all connection types

---

## 25. Test Ingress Before UI Is Complete

### Problem
Docker dev environment (localhost:7777) hides ingress bugs completely. Addons that
work perfectly in Docker break when running under HA ingress. Finding this after
UI is "done" means significant rework.

### Decision Needed
Ingress compatibility testing is a first-class development requirement:
- Set up a test HA instance with the addon running under ingress before UI is finished
- Test every frontend feature under ingress, not just Docker
- Add ingress test to definition of "done" for any UI feature
- Do not consider UI complete until ingress is verified working

### What To Do In DESIGN.md
- Add ingress testing requirement to development process section
- Note that Docker-only testing is insufficient for addon target

---

## 26. State Rehydration on HA Restart (v2 Runtime)

### Problem
If the v2 runtime has pistons mid-execution when HA restarts, behavior is undefined.
Users need to know what to expect and the runtime needs a defined strategy.

### Decision Needed
Define rehydration behavior before v2 runtime is designed:
- On HA reconnect, runtime resubscribes to all active piston triggers
- In-flight executions at time of disconnect are abandoned — not resumed
- Pistons that were mid-delay restart from the beginning on next trigger
- State cache is rebuilt from HA on reconnect, not from memory
- Document this behavior clearly in UI — users should understand pistons don't resume mid-execution

### What To Do In DESIGN.md
- Add state rehydration section to v2 runtime design
- Define abandoned execution behavior explicitly
- Note in UI spec: show reconnection status clearly

---

## 27. Addon Permissions — Minimum Required Only

### Problem
Over-permissioned addons raise red flags with users and in any future official store
review. Defining permissions late means auditing and potentially breaking changes.

### Decision Needed
Define minimum required permissions in addon config.json now:
- homeassistant API access — required for service calls and state reads
- filesystem access to /config — required for writing automation files
- hassio_api — only if supervisor token access requires it
- No other permissions
- Document why each permission is needed

### What To Do In DESIGN.md
- Add permissions section to addon architecture
- List minimum required permissions with justification for each
- Note: request only what is needed, nothing more

---

## 28. AppDaemon — Definitively Off The Table

### Problem
Item 14 left AppDaemon as an open question with Option B recommended. Based on
detailed ChatGPT analysis this is now a closed decision. AppDaemon is ruled out.

### Why (definitive reasoning)
Three fatal mismatches for PistonCore specifically:

1. Programming model mismatch — AppDaemon expects static Python classes.
   PistonCore needs dynamic pistons loaded from JSON at runtime. You end up
   building a runtime layer inside AppDaemon that ignores its intended model.
   At that point AppDaemon is just a transport layer you're fighting.

2. Observability is impossible — WebCoRE's real value was logs, traces, and
   visibility into execution. PistonCore must replicate this. You cannot get
   clean observability riding on top of another runtime you don't control.
   This single point rules out AppDaemon for a product like PistonCore.

3. Two-runtime debugging — PistonCore logic → AppDaemon → HA is three layers.
   When something breaks users cannot tell which layer caused it. Unacceptable
   for a product targeting non-technical users.

### What To Build Instead
Slim purpose-built async runtime. Actual scope:
- HA WebSocket client with reconnection logic
- Event router (state_changed, time, etc.)
- Execution engine that walks piston JSON
- Scheduler for delays and time triggers
- Estimated build time: 2-4 weeks of focused backend work, not months

### Spike Approach (reduces risk)
Use AppDaemon briefly as a throwaway spike to validate event model and test
piston execution concepts. Learn from it. Then build the real thing from scratch.
Spike is disposable — not the foundation.

### What To Do In DESIGN.md
- Update item 14 — AppDaemon is ruled out, decision is closed
- Define v2 runtime as purpose-built slim async runner
- Add scope estimate (2-4 weeks) to set expectations
- Add spike approach as optional risk reducer
- Remove all "evaluate AppDaemon" language — replace with "AppDaemon ruled out, see item 28"

---

## Final Summary — All 28 Items for DESIGN.md Rewrite

Original items: 1-7
Added from Gemini review: 8-14
Added from Grok review: 15-20
Added from session discussion: 21
Added from ChatGPT review: 22-28

Priority order for DESIGN.md rewrite:
1. Items 1, 3, 7, 8, 9, 10, 17 — template system, manifest, API externalization
2. Items 4, 18, 24 — BASE_URL, ingress/port, WebSocket coverage
3. Items 5, 19 — compiler contract, background compile
4. Items 6, 20 — global naming, token security
5. Items 11, 12, 13 — versioning split, piston identity, orphan cleanup
6. Items 14/28 — v2 runtime direction (AppDaemon ruled out, slim runner confirmed)
7. Items 15, 16 — test compile preview, PyScript detection
8. Items 21, 22, 23 — PyScript permanent for Docker, frontend/HA boundary, HAClient
9. Items 25, 26, 27 — ingress testing, state rehydration, addon permissions
10. PyScript/runtime/extensible output target section
