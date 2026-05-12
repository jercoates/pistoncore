# Session 41 — Full Wizard UI Audit
# DO NOT SKIP THIS FILE. READ BEFORE WRITING A SINGLE LINE OF CODE.

This is the complete screen-by-screen audit of every user-facing wizard path.
Written from reading wizard.js, webcore3.txt (WebCoRE HTML templates), and
WIZARD_REBUILD_SPEC.md. This is what was lost in the previous session.

---

## BACKEND BLOCKERS (fix first or nothing else works)

### GAP-S40-3 / GAP-S40-4 — Physical devices never appear in any picker
api.py calls `ha_client.get_devices()` etc. as module-level functions.
ha_client.py defines everything as methods on a singleton instance (`ha_client = HAClient()`).
Fix: change `import ha_client` to `from ha_client import ha_client, HAClientError` in api.py.
All existing call sites stay the same syntactically — they already say `ha_client.method()`.
Until this is fixed, every device picker shows only demo devices.

### GAP-S40-1 — log_message type check wrong in _route()
Line 383: `if (_editNode && _editNode.type === 'log')` — should be `'log_message'`.
_saveLocationCmd writes type:'log_message' but _route checks type:'log'. Clicking a
log_message node falls through to statement type picker instead of opening location cmd screen.

---

## SCREEN-BY-SCREEN USER FLOW AUDIT

---

### SCREEN 1 — Statement Type Picker (_goStatementTypePicker)
**What WebCoRE shows:** Grid of cards. Title: "Add a new statement". Footer: Cancel.
Each card: Name + description + one button labeled "Add [something]".

**What PistonCore shows:** Same grid structure. ✓ Structure matches.

**Broken / missing:**

1. **if_block button label wrong** — STATEMENT_TYPES has `btn:'Add an if'` — should be `'Add an if block'`

2. **switch → inserts skeleton immediately, no dialog**
   WebCoRE (webcore3.txt line 985): switch goes to page 1 which shows an Expression operand picker.
   "A SWITCH block compares an expression against a list of possible values."
   The user picks an expression BEFORE the switch is inserted.
   PistonCore: `_handleStatementType('switch')` hits the skeleton branch, inserts immediately.
   User gets a switch node with `expression:null` and no way to set it from the wizard.

3. **while → inserts skeleton immediately, no dialog**
   WebCoRE (line 993): while goes to page 1, shows info text, then footer button "Add a condition".
   After inserting, WebCoRE immediately opens the condition builder for the while condition.
   PistonCore: inserts blank skeleton with `conditions:[]`. User has no path to add a while condition from the wizard.

4. **for → inserts skeleton immediately with hardcoded 1/10/1 defaults, no dialog**
   WebCoRE (line 1000): for goes to page 1 showing: Start value (operand), End value (operand),
   Step (operand), Counter variable (optional dropdown).
   PistonCore: inserts `{start:1, end:10, step:1}` with no wizard screen to configure it.

5. **exit → inserts skeleton immediately, no dialog**
   WebCoRE (line 1040): exit goes to page 1 showing: "New piston state" operand picker.
   PistonCore: inserts `{type:'exit', value:null}` immediately.

6. **repeat → shows wrong screen**
   PistonCore _goRepeatPicker shows "Repeat N times" with a count input.
   WebCoRE repeat has NO count. WebCoRE (line 997): repeat just shows info text and footer "Add a statement".
   After inserting, the user adds statements inside it. There is no "repeat N times" in WebCoRE repeat.
   PistonCore is inventing functionality. Remove the count field entirely.

7. **do → inserts immediately ✓** WebCoRE: "There are no options for the do statement." Correct.

8. **on_event → inserts immediately ✓** WebCoRE: "There are no options for the on statement." Correct.

9. **break → inserts immediately ✓** WebCoRE: "Add" button with no options. Correct.

---

### SCREEN 2 — Condition or Group Picker (_goConditionOrGroup)
**What WebCoRE shows:**
- Title: "Add a new condition" (or "Add a new if")
- Info text: "An IF block is the simplest decisional block available..."
- Two cards side by side: Condition (blue/info) | Group (orange/warning)
- "Add a condition" and "Add a group" buttons
- Footer: Cancel

**What PistonCore shows:** Matches exactly. ✓

---

### SCREEN 3 — Condition Builder (_goConditionBuilder)
**What WebCoRE shows (from dialog-edit-condition + operand template):**
- Title: "Add a new condition" (new) or "Edit condition" (edit)
- "What to compare" row: [subject type dropdown] [device picker button] [attribute dropdown]
  - Subject types: Physical device(s), Variable, Time, Date, Mode (also: Location, Expression in WebCoRE)
- When Physical device(s) selected: device picker button opens inline panel with search
- When device selected: attribute dropdown populates
- When device with "interactive" flag: "Which interaction" selector appears (Any/Physical/Programmatic)
- "What kind of comparison?" operator dropdown (triggers group + conditions group)
- "Value" row — appears when operator needs a value
  - Value type selector: Value | Variable | Expression | Argument
  - Value widget: dropdown for binary/enum, number input for numeric, text for rest
- "In the last..." / "For the next..." duration row — appears for certain operators
- AND/OR selector — appears when adding to existing if block (if_condition context)
- Aggregation bar: "Any/All/None of the selected devices" — appears when device selected
- Footer (new): ← Back | ⚙ | Add more | Add
- Footer (edit): Cancel | Delete | ⚙ | Save

**What PistonCore has that's broken or missing:**

10. **"Which interaction" row always visible regardless of subject or device**
    It renders unconditionally. Should only show when:
    - subject_type === 'device' AND a device is selected
    Currently it shows even when Time or Variable is selected as subject.

11. **Subject type switching does nothing**
    Selecting Variable, Time, Date, or Mode in the subject type dropdown calls `_goConditionBuilder()`
    which re-renders the SAME screen without changing what's shown. None of those paths have
    their own widget. WebCoRE operand template switches entire content based on type:
    - Variable → variable picker dropdown
    - Time → time-of-day operand (minutes, hours, days-of-week filters)
    - Date → date operand
    - Mode → mode dropdown
    PistonCore shows the device picker button even when Variable/Time/Date/Mode is selected.
    The user has no way to specify what they're comparing when not using a physical device.

12. **_commitCondition logic bug**
    When context is 'if_condition' (adding condition to EXISTING if block), _extra has a block-id.
    The first check `if (ifBlockId)` is TRUE because block-id exists, so it runs Path A:
    creates a brand NEW if node using that id. It should run Path B: append to existing if.
    Fix: Path A should only run when `_context !== 'if_condition'`.
    Path B should run when `_context === 'if_condition'` regardless of whether block-id is present.

13. **_commitConditionAndMore has the same bug** — same fix needed.

---

### SCREEN 4 — Group Builder (_goGroupBuilder)
**What WebCoRE shows (dialog-edit-condition-group):**
- Title: "Add a new condition group"
- Group operator: AND | OR
- Also in WebCoRE (advanced): "Not negated" / "Negated" toggle
- Footer: Save (new) or Cancel/Delete/Save (edit)

**What PistonCore has:** AND/OR only. Missing negation. Acceptable for now — this is minor.
The group builder itself works and wires correctly. ✓ (minor gap, not blocking)

---

### SCREEN 5 — Action Device Picker (_goActionDevicePicker)
**What WebCoRE shows:**
- Title: "Add a new action"
- Info text about actions and Location virtual device
- "Devices" label
- Multi-select list: Virtual devices section (Location at top) | Physical devices section
- Live search box built into the select
- Footer: Back | ⚙ | Add a task (advances to task picker)

**What PistonCore has:** Custom device list with sections. Generally matches structure.

**Broken / missing:**

14. **Virtual devices disappear when searching**
    Line 1236: `if (!q) { html += Virtual devices section }` — when user types in search box,
    virtual devices section is hidden entirely.
    WebCoRE always shows all sections; search filters within each section.
    Fix: always render Virtual devices section; filter its contents by query same as physical.

15. **System variables also disappear when searching** — same issue, same fix.

16. **Demo devices disappear when searching** — same issue. Should always show, filtered.

---

### SCREEN 6A — Physical Device Command Picker (_goCommandPicker)
**What WebCoRE shows (dialog-edit-task):**
- Title: "Add a new task" (new) or no title change (edit)
- "With..." line showing selected device names (from action parent)
- If action already has tasks: shows existing tasks ABOVE the current task being edited
  (click to insert before that task) — insert position selector
- "Do..." label
- Command dropdown with 3 optgroups:
  - "Commands available to all devices" (common)
  - "Commands available to only some devices" (partial)
  - "Location commands (non-device)" (virtual)
- Parameter fields per command (operand template)
- "Only during these modes" multi-select (appears when command selected)
- Existing tasks BELOW insert position
- Footer (new): Cancel | ⚙ | Add more | Add
- Footer (edit): Cancel | Delete | ⚙ | Save

**What PistonCore has that's broken:**

17. **Footer button says "Save" instead of "Add" for new tasks**
    Line 1485: `btn-primary btn-sm" id="wiz-cmd-save" disabled>Save</button>`
    Should be "Add" when `!_editNode`, "Save" when `_editNode` (editing).

18. **"Add more" button missing entirely**
    WebCoRE "Add more" (line 2185) inserts the current task and immediately reopens the task
    dialog for another task on the SAME action node. Without it, every action node can only
    ever have one task.
    Fix: add "Add more" button that calls _saveDeviceCmd() then re-opens _goCommandPicker()
    with the same _sel.devices so the user adds another task to the same action.

19. **No insert-position awareness**
    WebCoRE shows existing tasks above and below the current edit position with click-to-reorder.
    PistonCore doesn't show existing tasks at all. Not blocking for smoke test but a real gap.

20. **Command dropdown has no optgroups**
    WebCoRE groups commands into common/partial/virtual. PistonCore lumps them flat.
    Not blocking but noticeable to WebCoRE users.

21. **"Only during these modes" field missing**
    WebCoRE shows mode filter when command is selected. PistonCore has no mode filter on tasks.

---

### SCREEN 6B — Location Command Picker (_goLocationCmdPicker)
**What WebCoRE shows:**
Effectively same as 6A but triggered by selecting the Location virtual device.
The command list is "Location commands" — the non-device tasks.

**What PistonCore has:** Separate screen ✓. Commands: set_variable, execute_piston, wait,
send_notification, log, http_request, set_mode, raise_event. Renders param fields for most.

**Broken / missing:**

22. **Footer says "Save" instead of "Add" for new tasks** — same issue as 6A.

23. **"Add more" missing** — same issue as 6A.

24. **http_request — no param fields**
    `_renderLocParams('http_request')` hits the else branch: "Parameters — coming soon."
    User selects it and saves a broken node. Fix: add param fields for URL, method, body, headers.
    Minimum: URL (text input) + method (GET/POST/PUT/DELETE dropdown).

25. **set_mode — no param fields** — same issue. Fix: dropdown of HA modes.

26. **raise_event — no param fields** — same issue. Fix: event name (text) + event data (textarea).

---

### SCREEN 7 — Variable Picker (_goVariablePicker)
**What WebCoRE shows (dialog-edit-variable):**
- Title: "Add a new variable"
- Type dropdown (Basic / Advanced lists groups) + Name input on same row
- "Initial value" section with type selector and sub-widget
- NOTE text about persistence
- Footer: Cancel | ⚙ | Add more | Add

**What PistonCore has:** Matches structure well. ✓

**Minor gaps:**

27. **Variable initial value "device" sub-path goes to a full sub-screen**
    _goVarInitDevicePicker replaces the modal content entirely. WebCoRE keeps it inline.
    Works but doesn't match WebCoRE feel. Not blocking.

28. **Missing "assignment type" (Dynamic/Constant)** — WebCoRE has this. Not blocking for smoke test.

---

### EDIT PATHS (clicking existing nodes)

29. **Clicking existing if/switch/do/while/repeat/every/for/for_each/on_event → opens wrong dialog**
    _route() has no handler for these types as edit contexts. Falls through to _goStatementTypePicker().
    The user clicks an existing if block and gets the "Add a new statement" picker.
    WebCoRE clicking any existing node opens its settings screen.

    For each type, what SHOULD happen:
    - if → open condition builder (to add/edit conditions) — same as _goConditionOrGroup
    - while → open condition builder for while condition
    - switch → open expression picker for switch expression
    - for → open for loop config screen (start/end/step/counter)
    - for_each → open _goForEachPicker() pre-populated
    - every/timer → open _goTimerPicker() pre-populated
    - repeat → open repeat info (no config — just show info and close)
    - do → no config needed, ignore click or show "nothing to configure"
    - on_event → open event picker

30. **Clicking existing action node with empty tasks array does nothing**
    _route() line 384: `if (_editNode.type === 'action' && (_editNode.tasks||[]).length)`
    — only routes to command picker if tasks.length > 0. Empty action node → falls through.

31. **Clicking existing action node with tasks opens command picker — only edits first task**
    If tasks.length > 1, only task[0] is pre-populated. No way to edit task[1], task[2], etc.

32. **Clicking existing break/exit opens wrong dialog** — falls through to statement type picker.
    exit should open expression picker for return value. break needs no config.

---

## COMPLETE PRIORITY ORDER FOR FIXING

### Priority 1 — Backend (nothing shows without this)
- GAP-S40-3/4: api.py import fix

### Priority 2 — Breaks the core wizard flow
- GAP-S40-1: log_message type check in _route
- #12/#13: _commitCondition/_commitConditionAndMore logic bug (adding condition to existing if creates new if)
- #17/#18/#22/#23: "Save"→"Add" labels + missing "Add more" on both command pickers
- #29: clicking existing nodes opens wrong dialog (biggest UX hole)

### Priority 3 — Dialogs that are wrong or missing
- #10: "Which interaction" always visible — hide unless device selected + subject=device
- #11: Subject type switching does nothing — need sub-widgets for Variable/Time/Date/Mode
- #2/#3/#4/#5: switch/while/for/exit need config screens before inserting
- #6: repeat picker shows wrong "N times" field — remove it, just insert
- #14/#15/#16: search hides virtual/system/demo sections in action device picker

### Priority 4 — Param fields for location commands
- #24/#25/#26: http_request/set_mode/raise_event need param fields

---

## NOTES FOR CODING SESSION

- wizard.js is the only file that needs changes for all UI gaps above
- api.py needs ONE import line change for the backend gap
- All complete file replacements — no partial patches
- Write api.py fix first (small), then wizard.js rewrite (large)
- Do not start coding until Jeremy approves this list

## FILES THAT NEED TO BE UPLOADED FOR CODING
- wizard.js (already uploaded this session ✓)  
- api.py (needed for backend fix)
- editor.js (needed to verify insertStatement call signatures)
- PISTON_FORMAT.md (node schemas reference)
- STATEMENT_TYPES.md (what each node type should produce)
