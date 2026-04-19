# PistonCore — Session 4 Additional Notes
# Generated from Grok review findings and session discussion
# Add these to the "Notes for next session" file in the repo

---

## IMPORTANT — These notes contain corrections and additions to DESIGN.md v0.6
## Where these notes conflict with DESIGN.md v0.6, these notes take priority.
## Do not code against v0.6 in the areas these notes cover until DESIGN.md v0.7 is published.

---

## Grok Review — Priority 1: globals.json File I/O Inside PyScript

PyScript runs in an async executor environment. Plain Python `open()` / `json.load()` file reads may block HA's event loop causing performance problems or failures. This is not confirmed safe — it must be the first thing tested in the sandbox.

**Real risks:**
- Blocking the HA event loop on file read
- Permission failures on supervised installs or Docker volume mount restrictions
- AppArmor restrictions on some HA installation types
- Repeated reads on every piston trigger or inside loops causing contention or latency

**Decision:** Do not assume globals.json file reading works cleanly. Test immediately in sandbox on first development session. If blocking is confirmed:
- Solution A: Wrap file read in `task.executor()` in the compiled PyScript template — runs the blocking I/O in a thread pool without blocking HA
- Solution B: Cache globals in `hass.data` on companion startup and read from there instead of disk at runtime
- Solution C: Expose globals via a PyScript module in `<ha_config>/pyscript/modules/pistoncore_globals.py` that PyScript auto-reloads when changed

Do not commit to the globals.json direct read approach until sandbox confirms it works without blocking. This affects the compiler template design — whichever solution works must be reflected in the compiled output.

---

## Grok Review — Priority 2: HA Capability API Completeness

The WebSocket commands `get_triggers_for_target`, `get_conditions_for_target`, `get_services_for_target` exist and are the correct approach but their output quality varies heavily by device type and integration.

**Known problem areas:**
- Zigbee devices (via ZHA or Zigbee2MQTT)
- Z-Wave devices
- MQTT devices
- Media players
- Custom/community integrations

These often do not expose complete native states, supported features, or parameter schemas through the capability API. The wizard's "always fetched live from HA, never hardcoded" philosophy will hit real gaps with these device types.

**Decision:** The unknown device fallback (one-time Define screen) covers the total failure case. But partial or inconsistent data also needs graceful handling:
- If capability data is returned but incomplete, the wizard shows what it has and adds an "Other / Manual" option at the bottom of each list
- The wizard never crashes or shows wrong options — it degrades gracefully to showing less rather than showing incorrect
- The "never hardcoded" philosophy is the goal but a small curated fallback layer for the most common device types that HA handles poorly may be necessary in practice — this is acceptable and does not violate the spirit of the design
- Track which device types need fallback data during sandbox testing and build the fallback layer incrementally based on real gaps found

---

## Grok Review — Priority 3: `!include_dir_merge_list` Real World Conflict

**Confirmed by Jeremy from personal experience** — this is not theoretical. Jeremy ran into this exact problem when switching his own HA to folder-based YAML automation organization. This is a known real problem with known real user impact.

**The conflict applies to YAML automations only.** PyScript automations are loaded by the PyScript integration independently and do not conflict with the HA GUI automation editor or existing YAML automations. There is no loader conflict on the PyScript side.

**What this means for each mode:**

**PyScript-only mode users:**
- No `!include_dir_merge_list` change needed at all
- No conflict with existing or future GUI automations
- Existing GUI automations are completely safe
- Future GUI automations do not conflict with PyScript pistons
- No ongoing GUI automation conflict warning needed
- Only reminder needed: PistonCore does not manage automations created in the HA GUI

**Full Mode users (YAML + PyScript):**
- `!include_dir_merge_list` change required
- May affect GUI automation editor behavior
- Users with complex existing YAML automation splits may hit reload failures or duplicate/ignored automations
- Ongoing conflict risk if user creates GUI automations after setup

**Companion setup must:**
- Detect existing HA automation configuration before making any changes
- Identify if user has existing YAML automation includes or GUI automations
- Warn specifically if complex existing configuration is detected
- Never assume a clean configuration — most users who want PistonCore already have existing automations

---

## Grok Review — Priority 4: PyScript Long-Term Independence

The "uninstall PistonCore and automations keep running forever" promise is solid for simple YAML pistons. For complex PyScript pistons it depends on PyScript continuing to be installed and working.

**What breaks if PyScript is removed after PistonCore:**
- All complex pistons stop running
- Trace, status reporting, and reload all stop working
- globals.json reads fail

**What does NOT break:**
- Simple YAML pistons keep running permanently — truly independent
- The YAML promise is the genuinely permanent one

**Decision:**
- This is an acceptable and known risk
- Be honest about it in the experimental warning and eventually in user documentation
- Clearly document in the UI that Simple pistons (YAML) are permanently independent and Complex pistons (PyScript) require PyScript to remain installed
- Do not overstate the independence guarantee for PyScript pistons

---

## Grok Review — Priority 5: Event Delivery Reliability for Run Status

HA events fired via `hass.bus.fire` (PyScript) or `event:` (YAML) are not guaranteed delivery. Under load, during WebSocket reconnection, or during HA restarts events can be lost.

**Impact:**
- Run log in PistonCore may show stale or missing status
- Trace overlay may miss events
- High-load scenarios with many pistons firing simultaneously are most at risk

**Decision:**
- Acceptable for v1 — do not over-engineer
- Companion needs robust WebSocket reconnection logic
- UI must handle missing status gracefully — show "Status unknown" rather than wrong information
- Run log entries should timestamp when they were received, not just when the piston ran
- Add to sandbox testing: fire multiple pistons simultaneously and verify status reporting holds up

---

## New Design Requirement — First Run Setup Flow

On first run the companion must scan existing HA configuration before making any changes. Present three options in plain English if existing configuration is detected:

**Option A — PyScript Only (Recommended for existing installations)**
"PistonCore will compile all pistons to PyScript. Your existing automations are completely untouched. No changes to your automation configuration are made. You keep everything you have. This is the safest choice for existing HA installations."
- No `!include_dir_merge_list` change needed
- No risk to existing automations — confirmed by Jeremy's personal experience
- Full PistonCore feature set available
- PyScript custom integration must be installed via HACS
- No ongoing GUI automation conflict risk

**Option B — Full Mode (Recommended for new/fresh HA installations only)**
"PistonCore will support both Simple (YAML) and Complex (PyScript) pistons. This requires a change to your configuration.yaml that may affect how your existing GUI automations behave. Recommended only for new HA installations or users who are prepared to manage their existing automations carefully."
- Requires `!include_dir_merge_list` configuration.yaml change
- May affect GUI automation editor behavior — confirmed real risk
- Full YAML + PyScript compile paths available
- Requires double confirmation (see below)

**Option C — Cancel**
"Make no changes. Exit setup. Your HA installation is unchanged."

The chosen mode is stored in PistonCore settings and displayed prominently in both the PistonCore UI and the HA companion card. User can return to this choice later. Changing from PyScript-only to Full Mode after initial setup requires going through the same warning and confirmation flow again.

---

## New Design Requirement — Double Confirmation for Full Mode

Users choosing Full Mode must confirm twice on separate screens before any changes are made:

**Screen 1:** Plain English explanation of exactly what `!include_dir_merge_list` does and what changes will be made to configuration.yaml. Lists all changes as already defined in Section 17.3 confirmation screen.

**Screen 2:** "Important — going forward, creating automations directly in the Home Assistant GUI may cause unexpected behavior with PistonCore's YAML pistons. We recommend managing all automations through PistonCore from this point. Do you understand and wish to continue?"

User must click confirm on both screens separately. Not one combined screen. Both confirmations are logged in PistonCore so support questions can reference whether the user confirmed.

---

## New Design Requirement — Ongoing GUI Automation Conflict Reminders

The risk does not end at setup. Users forget. Muscle memory from years of using the HA GUI automation editor is real.

**PyScript-only mode — single subtle reminder only:**
Unobtrusive notice on PistonCore main piston list page (footer or sidebar):
"PistonCore manages automations in its own subfolder. Automations created directly in Home Assistant are not visible or managed here."
No warning about conflicts — there are none in PyScript-only mode.

**Full Mode — persistent reminder in two places:**

PistonCore main page notice:
"PistonCore is running in Full Mode (YAML + PyScript). Creating automations directly in the Home Assistant GUI may cause unexpected behavior. Manage all automations through PistonCore."

HA companion integration card:
Persistent informational card visible in HA dashboard or integration page showing:
- Current PistonCore mode (PyScript Only / Full Mode)
- Full Mode warning if applicable: "Creating automations in the HA GUI may conflict with PistonCore YAML pistons."
- Link to PistonCore UI

**Why this matters:** Jeremy personally experienced the `!include_dir_merge_list` conflict. A single warning at setup is not enough for users who have years of GUI automation muscle memory.

---

## New Design Requirement — Development Priority Order

Based on user segmentation findings:

Most existing long-time HA users will choose PyScript-only mode. New users and fresh installs can use Full Mode. This means:

**PyScript compiler is the primary compile target — complete and stabilize this first.**
**YAML compiler is secondary — implement after PyScript is working.**

If development resources are limited at any point, a working PyScript-only PistonCore is more useful to more users than a half-working dual-mode system.

---

## Gemini Review — Four Additional Gaps (Must resolve before frontend coding)

**Gap 1 — UI transitions and stateful navigation:**
Define before frontend coding:
- What happens to unsaved editor changes if user navigates away — prompt to save, discard, or cancel navigation
- What the back button does from status page — returns to the folder the piston is in, not always root list
- What state is preserved on browser refresh — piston list position, open folder, last viewed status page
- What happens if WebSocket connection to HA drops while user is in editor — show reconnecting banner, disable deploy button, preserve unsaved work locally

**Gap 2 — Recursive component tree data structure:**
The design describes the visual appearance of the nested statement tree but not the data structure that drives it. Before frontend coding define the exact JSON structure that represents a nested piston in the editor's internal state:
- How an if block contains its true_children and false_children
- How a repeat block contains its body
- How nesting to any depth is represented
- How this structure maps to the piston JSON on save
A developer cannot build the editor without this defined. This is a dedicated next session agenda item.

**Gap 3 — Editor save pipeline:**
Define what happens between clicking Save and landing on the status page:
- What gets written where on save
- Whether save can fail and what happens if it does
- Whether save has a loading/spinner state
- What the user sees if save fails partway through

**Gap 4 — UI Capability Map for the wizard:**
The design describes the wizard concept and operator list but not the decision tree that drives wizard steps 3 and onward. Define before wizard coding:
- Given a device of type X with capability Y, what operators are valid
- What value types are valid for comparison
- What service parameters appear in the action wizard
- How this decision tree is stored — as a document, as a data file the wizard reads, or as code
This is a dedicated next session agenda item.

---

## Next Session Agenda — Priority Order

1. Read DESIGN.md from repo
2. Read all notes files
3. Produce DESIGN.md v0.7 incorporating all corrections
4. Confirm cousin's frontend framework
5. Deep dive — Recursive component tree data structure (Gap 2 above)
6. Deep dive — Compiler template system (what format, where they live, how user-replaceable works)
7. Deep dive — UI Capability Map for wizard decision tree (Gap 4 above)
8. Deep dive — Companion integration contract (WebSocket subscription details, event formats, error handling)
9. Define editor save pipeline (Gap 3 above)
10. Define UI navigation and stateful transitions (Gap 1 above)

Do not write production code until items 5 through 10 are defined.

---

## Standard Prompts for AI Design Review Sessions

Use these when reviewing the design with any AI:
- "What technical assumptions in this design are most likely to be wrong?"
- "What features described here cannot work the way they are described?"
- "What has been left undefined that will block a developer from writing code?"

---

*Notes generated Session 4 — April 2026*
*Sources: Grok technical review, Gemini UI review, session discussion*
