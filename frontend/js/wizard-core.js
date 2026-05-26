// pistoncore/frontend/js/wizard-core.js
// Wizard infrastructure: shared state, constants, device data, open/close/route, modal shell, helpers.
//
// Load order in HTML:
//   wizard-core.js       ← this file (must be first)
//   wizard-statement.js
//   wizard-condition.js
//   wizard-loops.js
//   wizard-action.js
//   wizard-variable.js
//
// All wizard files share state through the WizardState object defined here.
// All helper functions (_esc, _newId, _render, _pushStep, _back, close, etc.)
// are defined here and called directly by the other files — no imports needed
// since all files load into the same global scope (vanilla JS, no modules).
//
// Public API (unchanged from monolithic wizard.js):
//   Wizard.open(context, editNode, extra)
//   Wizard.close()

const Wizard = (() => {

  // ── Shared state (read/write from all wizard-*.js files) ──
  // These are declared as plain vars here and referenced directly by name
  // in all other wizard files. They are intentionally NOT on WizardState —
  // the other files just use the same closure-level names via the global scope.
  // IMPORTANT: all wizard-*.js files must be wrapped in the same IIFE pattern
  // OR left as plain function declarations at module level so they can access
  // these vars. See architecture note at bottom of this file.
  //
  // Architecture chosen: all wizard-*.js files declare their functions at the
  // top level (no wrapping IIFE). This file defines the state vars as globals
  // prefixed with _wiz_ to avoid collisions. The Wizard object is returned
  // from this file's IIFE and exposed as window.Wizard.

  // ── State ─────────────────────────────────────────────────
  let _context   = null;
  let _editNode  = null;
  let _extra     = {};
  let _step      = null;
  let _sel       = {};
  let _stepStack = [];
  let _deviceData = null;

  // ── WebCoRE operator lists ────────────────────────────────
  const CONDITIONS = [
    'is','is any of','is not','is not any of',
    'is between','is not between','is even','is odd',
    'was','was any of','was not','was not any of',
    'changed','did not change',
    'is equal to','is not equal to',
    'is less than','is less than or equal to',
    'is greater than','is greater than or equal to',
  ];

  const TRIGGERS = [
    'changes','changes to','changes to any of',
    'changes away from','changes away from any of',
    'drops','drops below','drops to or below',
    'rises','rises above','rises to or above',
    'stays','stays equal to','stays any of',
    'stays away from','stays away from any of','stays unchanged',
    'gets','gets any','receives',
    'happens daily at','event occurs',
    'is any and stays any of','is away and stays away from',
  ];

  const NEEDS_VALUE = new Set([
    'is','is any of','is not','is not any of','is between','is not between',
    'was','was any of','was not','was not any of',
    'is equal to','is not equal to','is less than','is less than or equal to',
    'is greater than','is greater than or equal to',
    'changes to','changes to any of','changes away from','changes away from any of',
    'drops below','drops to or below','rises above','rises to or above',
    'stays','stays equal to','stays any of','stays away from','stays away from any of',
    'gets','receives','happens daily at',
    'is any and stays any of','is away and stays away from',
  ]);

  const NEEDS_DURATION_INTHELAST = new Set([
    'changed','did not change',
    'was','was any of','was not','was not any of',
  ]);

  const NEEDS_DURATION_FOR = new Set([
    'stays','stays equal to','stays any of',
    'stays away from','stays away from any of','stays unchanged',
    'is any and stays any of','is away and stays away from',
  ]);

  const NEEDS_TWO_VALUES = new Set(['is between','is not between']);

  const isTrigger = op => TRIGGERS.includes(op);

  function _durationLabel(op) {
    if (NEEDS_DURATION_INTHELAST.has(op)) return 'In the last...';
    if (NEEDS_DURATION_FOR.has(op))      return 'For...';
    return '';
  }

  function _needsDuration(op) {
    return NEEDS_DURATION_INTHELAST.has(op) || NEEDS_DURATION_FOR.has(op);
  }

  // ── Static capability map by HA domain ────────────────────
  const DOMAIN_CAPS = {
    light:         [
      { name:'switch',      attribute_type:'binary',  values:['on','off'] },
      { name:'brightness',  attribute_type:'numeric', min:0, max:255, unit:'%' },
      { name:'color_temp',  attribute_type:'numeric', min:153, max:500, unit:'mireds' },
      { name:'color_mode',  attribute_type:'enum',    values:['color_temp','rgb','brightness'] },
      { name:'effect',      attribute_type:'enum',    values:[] },
    ],
    switch:        [
      { name:'switch', attribute_type:'binary', values:['on','off'] },
      { name:'power',  attribute_type:'numeric', unit:'W' },
    ],
    binary_sensor: [
      { name:'state',    attribute_type:'binary',  values:['on','off'] },
      { name:'motion',   attribute_type:'binary',  values:['active','inactive'] },
      { name:'contact',  attribute_type:'binary',  values:['open','closed'] },
      { name:'presence', attribute_type:'binary',  values:['home','away'] },
      { name:'smoke',    attribute_type:'binary',  values:['detected','clear'] },
      { name:'moisture', attribute_type:'binary',  values:['wet','dry'] },
      { name:'battery',  attribute_type:'numeric', unit:'%' },
    ],
    sensor:        [
      { name:'state',               attribute_type:'numeric', unit:'' },
      { name:'battery',             attribute_type:'numeric', unit:'%' },
      { name:'temperature',         attribute_type:'numeric', unit:'\u00b0F' },
      { name:'humidity',            attribute_type:'numeric', unit:'%' },
      { name:'illuminance',         attribute_type:'numeric', unit:'lx' },
      { name:'unit_of_measurement', attribute_type:'enum',   values:[] },
    ],
    media_player:  [
      { name:'state',           attribute_type:'enum',    values:['playing','paused','idle','off','standby'] },
      { name:'volume_level',    attribute_type:'numeric', min:0, max:1 },
      { name:'source',          attribute_type:'enum',    values:[] },
      { name:'media_title',     attribute_type:'enum',    values:[] },
      { name:'is_volume_muted', attribute_type:'binary',  values:['true','false'] },
    ],
    cover:         [
      { name:'state',         attribute_type:'enum',    values:['open','closed','opening','closing'] },
      { name:'position',      attribute_type:'numeric', min:0, max:100, unit:'%' },
      { name:'tilt_position', attribute_type:'numeric', min:0, max:100, unit:'%' },
    ],
    climate:       [
      { name:'hvac_mode',           attribute_type:'enum',    values:['off','heat','cool','auto','fan_only','dry'] },
      { name:'temperature',         attribute_type:'numeric', unit:'\u00b0F' },
      { name:'current_temperature', attribute_type:'numeric', unit:'\u00b0F' },
      { name:'humidity',            attribute_type:'numeric', unit:'%' },
      { name:'preset_mode',         attribute_type:'enum',    values:[] },
    ],
    fan:           [
      { name:'switch',      attribute_type:'binary',  values:['on','off'] },
      { name:'percentage',  attribute_type:'numeric', min:0, max:100, unit:'%' },
      { name:'preset_mode', attribute_type:'enum',    values:[] },
    ],
    lock:          [
      { name:'state', attribute_type:'enum', values:['locked','unlocked','locking','unlocking'] },
    ],
    input_boolean: [
      { name:'state', attribute_type:'binary', values:['on','off'] },
    ],
    input_number:  [
      { name:'state', attribute_type:'numeric', unit:'' },
    ],
    input_select:  [
      { name:'state', attribute_type:'enum', values:[] },
    ],
    automation:    [
      { name:'state', attribute_type:'enum', values:['on','off'] },
    ],
    person:        [
      { name:'state',     attribute_type:'enum',    values:['home','not_home'] },
      { name:'latitude',  attribute_type:'numeric', unit:'\u00b0' },
      { name:'longitude', attribute_type:'numeric', unit:'\u00b0' },
    ],
    device_tracker:[
      { name:'state', attribute_type:'enum', values:['home','not_home'] },
    ],
    alarm_control_panel:[
      { name:'state', attribute_type:'enum', values:['disarmed','armed_home','armed_away','armed_night','triggered'] },
    ],
  };

  const ALLOWED_DOMAINS = new Set([
    'light','switch','binary_sensor','sensor','media_player','cover','climate',
    'fan','lock','input_boolean','input_number','input_select','automation',
    'person','device_tracker','alarm_control_panel',
  ]);

  function _filterDevices(raw) {
    const seen = new Set();
    return (raw || []).filter(d => {
      const domain = (d.entity_id || '').split('.')[0];
      if (!ALLOWED_DOMAINS.has(domain)) return false;
      if (seen.has(d.entity_id)) return false;
      seen.add(d.entity_id);
      return true;
    });
  }

  // _groupDevices: what the device picker UI uses.
  // Groups by HA device_id (physical device registry ID) — the correct key.
  // Entities sharing a device_id are the same physical device (e.g. light.cave_light
  // and sensor.cave_light_power both belong to device_id "abc123").
  // Falls back to entity_id as group key when device_id is absent.
  // Display label: shortest friendly_name in the group (usually the main entity).
  // primary_entity_id: chosen by domain priority.
  const _DOMAIN_PRIORITY = [
    'light','switch','cover','fan','climate','lock','media_player',
    'input_boolean','input_number','input_select','automation',
    'binary_sensor','sensor','person','device_tracker','alarm_control_panel',
  ];
  function _groupDevices(raw) {
    const allowed = _filterDevices(raw);
    // Group by device_id, fall back to entity_id
    const byDevice = new Map();
    for (const d of allowed) {
      const key = d.device_id || d.entity_id;
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key).push(d);
    }
    const result = [];
    for (const [, entities] of byDevice) {
      // Display label: shortest friendly_name in the group
      const label = entities.reduce((shortest, d) =>
        d.friendly_name.length < shortest.length ? d.friendly_name : shortest,
        entities[0].friendly_name
      );
      // Pick primary_entity_id by domain priority
      let primary = entities[0].entity_id;
      for (const domain of _DOMAIN_PRIORITY) {
        const match = entities.find(d => d.entity_id.startsWith(domain + '.'));
        if (match) { primary = match.entity_id; break; }
      }
      result.push({
        friendly_name: label,
        entity_ids: entities.map(d => d.entity_id),
        primary_entity_id: primary,
      });
    }
    result.sort((a, b) => a.friendly_name.toLowerCase().localeCompare(b.friendly_name.toLowerCase()));
    return result;
  }

  // Filter grouped devices by query — match against display label or primary entity_id only.
  // Do NOT match against all entity_ids — that leaks power sensors and other sub-entities
  // into results when user searches "light" and a device has sensor.xxx_light_power.
  function _filterGrouped(grouped, query) {
    if (!query) return grouped;
    const lq = query.toLowerCase();
    return grouped.filter(d =>
      d.friendly_name.toLowerCase().includes(lq) ||
      d.primary_entity_id.toLowerCase().includes(lq)
    );
  }

  function _getCapsForDomain(entityIdOrList) {
    const ids = Array.isArray(entityIdOrList)
      ? entityIdOrList
      : String(entityIdOrList||'').split(',').map(s=>s.trim()).filter(Boolean);
    // For a single entity, return the full domain caps array directly.
    // For multiple entities, return caps whose names appear in all domains.
    if (ids.length === 1) {
      const domain = ids[0].split('.')[0];
      return DOMAIN_CAPS[domain] || [];
    }
    const seen = new Map();
    for (const id of ids) {
      const domain = id.split('.')[0];
      const caps = DOMAIN_CAPS[domain] || [];
      for (const cap of caps) {
        if (!seen.has(cap.name)) seen.set(cap.name, cap);
      }
    }
    return [...seen.values()];
  }

  // ── _getFlatEntityIds ─────────────────────────────────────
  // Takes sel.tokens — the array of what the user actually selected in the picker.
  // Each entry is one of:
  //   - a real HA entity_id (contains a '.')          → use as-is
  //   - a piston variable name (no '.', no '@')       → look up initial_value in Editor.getPistonVariables()
  //   - a global variable token ('@name')             → look up value in WizardCore.globalsData
  // Returns a flat, deduplicated array of real HA entity_ids.
  // This is the Extraction Layer from the Architecture Guardrail.
  // Used by both wizard-action.js and wizard-condition.js before any capability/service lookup.
  function _getFlatEntityIds(tokens) {
    const result = [];
    const seen = new Set();
    const add = id => { if (id && !seen.has(id)) { seen.add(id); result.push(id); } };

    for (const token of (tokens || [])) {
      if (!token) continue;

      if (token.startsWith('@')) {
        // Global variable token — resolve from globalsData
        const gname = token.slice(1);
        const g = (_deviceData_globals || []).find(g => g.name === gname);
        const val = g?.value || g?.initial_value;
        const ids = Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(',').map(s=>s.trim()).filter(Boolean) : []);
        ids.forEach(add);

      } else if (!token.includes('.')) {
        // Piston variable name — resolve from Editor.getPistonVariables()
        const vars = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
        const v = vars.find(v => v.var_type === 'device' && v.name === token);
        const val = v?.initial_value;
        const ids = Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(',').map(s=>s.trim()).filter(Boolean) : []);
        ids.forEach(add);

      } else {
        // Real HA entity_id — use directly (skip virtual __xxx__ ids)
        if (!token.startsWith('__')) add(token);
      }
    }
    return result;
  }

  // Internal reference to globals — kept in sync via WizardCore.globalsData setter
  let _deviceData_globals = null;

  // ── Demo devices (fallback when no HA connection) ─────────
  const DEMO_DEVICES = [
    {
      entity_id: '__demo_light__',
      friendly_name: 'Demo Light',
      capabilities: [
        { name: 'switch',      attribute_type: 'binary',  values: ['on','off'] },
        { name: 'brightness',  attribute_type: 'numeric', min: 0, max: 100 },
        { name: 'color_temp',  attribute_type: 'numeric', min: 153, max: 500 },
      ],
      services: ['turn_on','turn_off','toggle','set_brightness','set_color_temp'],
    },
    {
      entity_id: '__demo_switch__',
      friendly_name: 'Demo Switch',
      capabilities: [
        { name: 'switch', attribute_type: 'binary', values: ['on','off'] },
      ],
      services: ['turn_on','turn_off','toggle'],
    },
    {
      entity_id: '__demo_contact__',
      friendly_name: 'Demo Contact Sensor',
      capabilities: [
        { name: 'contact', attribute_type: 'binary', device_class: 'door', values: ['open','closed'] },
      ],
      services: [],
    },
    {
      entity_id: '__demo_speaker__',
      friendly_name: 'Demo Speaker',
      capabilities: [
        { name: 'media_player', attribute_type: 'enum',    values: ['playing','paused','idle','off'] },
        { name: 'volume',       attribute_type: 'numeric', min: 0, max: 100 },
        { name: 'source',       attribute_type: 'enum',    values: [] },
      ],
      services: ['media_play','media_pause','media_stop','volume_set','volume_up','volume_down','play_media'],
    },
    {
      entity_id: '__demo_presence__',
      friendly_name: 'Demo Presence Sensor',
      capabilities: [
        { name: 'presence', attribute_type: 'binary', device_class: 'presence', values: ['home','away'] },
      ],
      services: [],
    },
    {
      entity_id: '__demo_lux__',
      friendly_name: 'Demo Lux Sensor',
      capabilities: [
        { name: 'illuminance', attribute_type: 'numeric', min: 0, max: 100000, unit: 'lx' },
      ],
      services: [],
    },
    {
      entity_id: '__demo_motion__',
      friendly_name: 'Demo Motion Sensor',
      capabilities: [
        { name: 'motion', attribute_type: 'binary', device_class: 'motion', values: ['active','inactive'] },
      ],
      services: [],
    },
  ];

  // ── Virtual / system devices (for action device picker) ───
  const VIRTUAL_DEVICES = [
    { entity_id:'__location__', friendly_name:'Location'     },
    { entity_id:'__time__',     friendly_name:'Time'         },
    { entity_id:'__date__',     friendly_name:'Date'         },
    { entity_id:'__mode__',     friendly_name:'Mode'         },
    { entity_id:'__system__',   friendly_name:'System Start' },
  ];

  const SYSTEM_VARS = [
    '$currentEventDevice','$previousEventDevice','$device','$devices','$location',
  ];

  // ── Location (virtual) commands — matches WebCoRE exactly ─
  const LOCATION_COMMANDS = [
    { id:'set_variable',      label:'Set variable...'           },
    { id:'execute_piston',    label:'Execute piston...'         },
    { id:'wait',              label:'Wait...'                   },
    { id:'send_notification', label:'Send push notification...' },
    { id:'log',               label:'Log to console...'         },
    { id:'http_request',      label:'Make an HTTP request...'   },
    { id:'set_mode',          label:'Set HA mode...'            },
    { id:'raise_event',       label:'Raise an event...'         },
  ];

  // ── Statement type cards — matches WebCoRE designer.items ─
  const STATEMENT_TYPES = {
    basic: [
      { type:'if_block',   label:'If Block',  desc:'Execute different actions depending on conditions you set',  btn:'Add an if block', cls:'btn-primary' },
      { type:'action',     label:'Action',    desc:'Actions represent a collection of tasks devices have to perform', btn:'Add a task',   cls:'btn-green'   },
      { type:'timer',      label:'Timer',     desc:'Timers trigger piston runs at regular intervals',            btn:'Add a timer',     cls:'btn-orange'  },
    ],
    advanced: [
      { type:'switch',      label:'Switch',      desc:'A SWITCH block compares an expression against a list of possible values',  btn:'Add a switch',     cls:'btn-primary' },
      { type:'do_block',    label:'Do Block',    desc:'Organize several statements into a single block',                          btn:'Add a do block',   cls:'btn-green'   },
      { type:'on_event',    label:'On Event',    desc:'Execute statements only when certain events happen',                       btn:'Add an on event',  cls:'btn-orange'  },
      { type:'for_loop',    label:'For Loop',    desc:'A FOR loop repeats statements for a preset number of iterations',          btn:'Add a for loop',   cls:'btn-orange'  },
      { type:'for_each',    label:'For Each Loop',desc:'A FOR EACH loop repeats statements for each device in a device list',    btn:'Add a for each loop',cls:'btn-orange' },
      { type:'while_loop',  label:'While Loop',  desc:'A WHILE loop executes statements while a condition is true',               btn:'Add a while loop', cls:'btn-orange'  },
      { type:'repeat_loop', label:'Repeat Loop', desc:'A REPEAT loop executes statements until a condition is met',               btn:'Add a repeat loop',cls:'btn-orange'  },
      { type:'break',       label:'Break',       desc:'Interrupt the inner most loop',                                            btn:'Add a break',      cls:'btn-red'     },
      { type:'exit',        label:'Exit',        desc:'Return causes the piston to end the evaluation stage',                     btn:'Add an exit',      cls:'btn-red'     },
    ],
  };

  // ── Weekday helpers ────────────────────────────────────────
  const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Inject combo CSS once ─────────────────────────────────
  function _injectComboCSS() {
    if (document.getElementById('wiz-combo-css')) return;
    const s = document.createElement('style');
    s.id = 'wiz-combo-css';
    s.textContent = `
      .wiz-device-combo { position:static; flex:1; min-width:0; }
      .wiz-device-search { width:100%; box-sizing:border-box; cursor:pointer !important; }
      .wiz-device-dropdown {
        position:fixed; z-index:99999;
        background:var(--bg-raised,#1e2430);
        border:1px solid var(--border-subtle,#333);
        border-radius:4px; box-shadow:0 4px 24px rgba(0,0,0,.6);
        min-width:260px; max-width:420px;
      }
      #wiz-device-list { max-height:400px; overflow-y:auto; }
      .wiz-combo-row { display:flex; align-items:center; gap:6px; padding:7px 10px;
        cursor:pointer; font-size:13px; color:var(--text-primary); }
      .wiz-combo-row:hover, .wiz-combo-row.selected { background:var(--teal,#1abc9c); color:#fff; }
      .wiz-combo-row .wiz-dev-prefix { font-size:10px; opacity:.7; }
      .wiz-combo-row:hover .wiz-dev-prefix { opacity:.9; }
    `;
    document.head.appendChild(s);
  }

  // ── Open / Close ──────────────────────────────────────────
  function open(context, editNode, extra) {
    _context  = context;
    _editNode = editNode || null;
    _extra    = extra || {};
    _step     = null;
    _stepStack = [];
    // Deep clone to avoid mutating the piston tree during wizard editing.
    // Shallow spread loses nested arrays (entity_ids, tasks, parameters, conditions).
    _sel = editNode ? JSON.parse(JSON.stringify(editNode)) : {};

    _injectComboCSS();
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.style.display = 'flex';
    const bd = document.getElementById('wizard-backdrop');
    if (bd) bd.style.display = 'block';
    _route();
  }

  function close() {
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.style.display = 'none';
    const bd = document.getElementById('wizard-backdrop');
    if (bd) bd.style.display = 'none';
    _context = null; _editNode = null; _sel = {}; _stepStack = [];
  }

  function _pushStep(fn) {
    const last = _stepStack[_stepStack.length - 1];
    if (last !== fn) _stepStack.push(fn);
  }

  function _back() {
    _stepStack.pop();
    const prev = _stepStack[_stepStack.length - 1];
    if (prev) { _stepStack.pop(); prev(); }
    else close();
  }

  // ── Routing ───────────────────────────────────────────────
  function _route() {
    const ctx = _context;

    if (_editNode) {
      const t = _editNode.type;

      // Condition / trigger / restriction edit
      // Also catches condition nodes built by _buildConditionNode which have no .type field,
      // and conditions inside if blocks opened via if_condition context.
      if (t === 'trigger' || t === 'condition' || t === 'restriction' || ctx === 'edit_condition' || ctx === 'if_condition') {
        // Group condition — route to group builder, not condition builder (GAP-S44-1)
        if (_editNode.is_group || _editNode.type === 'group') {
          _sel.group_condition_operator = _editNode.group_operator || _editNode.operator || 'and';
          _goGroupBuilder();
          return;
        }
        _sel.statement_class = 'condition';
        if (_editNode.subject) {
          _sel.subject_type   = _editNode.subject.type || 'device';
          _sel.device_id      = _editNode.subject.entity_id || '';
          _sel.device_label   = _editNode.subject.role || _editNode.subject.entity_id || '';
          _sel.tokens         = [_sel.device_id].filter(Boolean);
          _sel.attribute      = _editNode.subject.capability || '';
          _sel.attribute_type = _editNode.subject.attribute_type || '';
        } else if (_editNode.role || _editNode.attribute) {
          const role = _editNode.role || '';
          if (role === 'time') {
            _sel.subject_type = 'time';
            _sel.time_value   = _editNode.value_from || _editNode.value || '';
          } else if (role === 'date') {
            _sel.subject_type = 'date';
            _sel.date_value   = _editNode.value || '';
          } else if (role === 'mode') {
            _sel.subject_type = 'mode';
            _sel.mode_value   = _editNode.value || '';
          } else {
            _sel.subject_type   = 'device';
            _sel.device_label   = role;
            // tokens: what the user originally selected (variable names, globals, entity_ids).
            // Stored on the node as role_tokens if saved that way; fall back to entity_ids.
            // role_tokens: what user picked (variable names, @globals, entity_ids).
            // Fix 6: if role_tokens absent (node saved before this session), fall back
            // to entity_ids as tokens — _getFlatEntityIds passes plain entity_ids through.
            // Fix 5: sel.tokens is authoritative. sel.devices not set here.
            const nodeTokens = (_editNode.role_tokens || []).filter(Boolean);
            const nodeIds    = (_editNode.entity_ids  || []).filter(id => id && !id.startsWith('__'));
            if (nodeTokens.length) {
              // New format: role_tokens present
              _sel.tokens    = nodeTokens;
              _sel.device_id = nodeTokens[0];
            } else if (nodeIds.length) {
              // No role_tokens — use entity_ids as tokens (nodes saved mid-session)
              _sel.tokens    = nodeIds;
              _sel.device_id = nodeIds[0];
            } else if (role && !['time','date','mode'].includes(role)) {
              // Old imported format: no entity_ids, no role_tokens.
              // role is a variable name (e.g. "Motion_sensor") — use it as token.
              // _getFlatEntityIds will resolve it through piston variables at cap-load time.
              _sel.tokens    = [role];
              _sel.device_id = role;
            } else {
              // Nothing — clear selection
              _sel.tokens    = [];
              _sel.device_id = '';
            }
            _sel.attribute      = _editNode.attribute || _editNode.capability || '';
            _sel.attribute_type = _editNode.attribute_type || '';
          }
        }
        _sel.operator        = _editNode.operator || '';
        _sel.aggregation     = _editNode.aggregation || 'any';
        // display_value is what the user typed/selected (e.g. "Active").
        // compiled_value is the HA state string (e.g. "on").
        // Always show display_value in the wizard — compiled_value is for the compiler only.
        _sel.value           = _editNode.display_value || _editNode.value || _editNode.compiled_value || '';
        _sel.value2          = _editNode.value_to || '';
        _sel.duration_amount = _editNode.duration || 1;
        _sel.duration_unit   = _editNode.duration_unit || 'minutes';
        _sel.interaction     = _editNode.interaction || 'any';
        _sel.time_only_on_days   = _editNode.only_on_days   || [];
        _sel.time_only_on_dom    = _editNode.only_on_dom    || [];
        _sel.time_only_on_months = _editNode.only_on_months || [];
        _goConditionBuilder();
        return;
      }

      // Variable edit
      if (t === 'variable') { _goVariablePicker(); return; }

      // Location command edits
      if (t === 'set_variable') { _goLocationCmd('set_variable'); return; }
      if (t === 'wait')         { _goLocationCmd('wait');         return; }
      if (t === 'log_message')  { _goLocationCmd('log');          return; }
      if (t === 'call_piston')  { _goLocationCmd('execute_piston'); return; }

      // Action edit
      if (t === 'action') {
        // role_tokens: what the user picked (variable names, globals, entity_ids).
        // entity_ids: the resolved flat list at last save time.
        // On edit, restore tokens so the picker highlights the right rows.
        // role_tokens: what user picked. Absent on old nodes — fall back to entity_ids.
        // Fix 5: sel.tokens authoritative. Fix 6: entity_ids as token fallback.
        const nodeTokens = (_editNode.role_tokens || []).filter(Boolean);
        const nodeIds    = (_editNode.entity_ids  || []).filter(id => id && !id.startsWith('__'));
        // Old imported format: no role_tokens, no entity_ids — devices array holds role names.
        // Treat them as tokens so _getFlatEntityIds resolves through piston variables.
        const oldDevices = (_editNode.devices || []).filter(d => d && d !== 'Location');
        if (nodeTokens.length) {
          _sel.tokens = nodeTokens;
        } else if (nodeIds.length) {
          _sel.tokens = nodeIds;
        } else if (oldDevices.length) {
          _sel.tokens = oldDevices;
        } else {
          _sel.tokens = [];
        }
        _sel.device_id    = _sel.tokens[0] || '';
        _sel.device_label = _editNode.role || _sel.device_id || '';
        if ((_editNode.tasks || []).length) {
          const task = _editNode.tasks[0];
          _sel.command    = task.command || '';
          _sel.parameters = task.parameters ? { ...task.parameters } : {};
        }
        const isLocation = _sel.device_id === '__location__' ||
          (_editNode.entity_ids || []).includes('__location__') ||
          (_editNode.devices || []).includes('Location');
        if (isLocation) {
          const task = (_editNode.tasks||[])[0];
          if (task) _sel.location_cmd = task.command || '';
          _goLocationCmdPicker();
        } else {
          _goCommandPicker();
        }
        return;
      }

      // If block edit
      if (t === 'if') {
        _context = 'if_condition';
        _extra = { 'block-id': _editNode.id };
        _sel.statement_class = 'condition';
        _goConditionOrGroup();
        return;
      }

      // Every / timer edit
      if (t === 'every') {
        _sel.interval           = _editNode.interval || 5;
        _sel.interval_unit      = _editNode.interval_unit || 'minutes';
        _sel.at_minute          = _editNode.at_minute ?? null;
        _sel.at_time            = _editNode.at_time ?? null;
        _sel.only_on_days       = _editNode.only_on_days   || [];
        _sel.only_on_dom        = _editNode.only_on_dom    || [];
        _sel.only_on_months     = _editNode.only_on_months || [];
        _goTimerPicker();
        return;
      }

      // For each edit
      if (t === 'for_each') {
        _sel.variable  = _editNode.variable || '$device';
        _sel.list_role = _editNode.list_role || '';
        _goForEachPicker();
        return;
      }

      // For loop edit
      if (t === 'for') {
        _sel.for_start   = _editNode.start ?? 1;
        _sel.for_end     = _editNode.end ?? 10;
        _sel.for_step    = _editNode.step ?? 1;
        _sel.for_counter = _editNode.counter_variable || '';
        _goForPicker();
        return;
      }

      // Switch edit
      if (t === 'switch') {
        _sel.switch_expression = _editNode.expression || null;
        _sel.switch_ctp        = _editNode.case_traversal_policy || 'safe';
        _goSwitchPicker();
        return;
      }

      // While edit
      if (t === 'while') {
        _sel.statement_class = 'condition';
        _context = 'if_condition';
        _extra = { 'block-id': _editNode.id };
        _goConditionBuilder();
        return;
      }

      // Exit edit
      if (t === 'exit') {
        _goExitPicker();
        return;
      }

      // Repeat, do, on_event, break — no configurable fields, show simple edit screen with delete
      if (t === 'repeat' || t === 'do' || t === 'on_event' || t === 'break') {
        const labels = { repeat:'Repeat Loop', do:'Do Block', on_event:'On Event', break:'Break' };
        const descs  = {
          repeat: 'A REPEAT loop executes its statements until a condition is met.',
          do:     'A DO block groups several statements into a single block.',
          on_event: 'An ON EVENT block executes its statements only when certain events happen.',
          break:  'A BREAK interrupts the innermost switch, for, each, while, or repeat loop.',
        };
        _render(`Edit: ${labels[t] || t}`,
          `<div class="wiz-desc">${descs[t] || ''}</div>
           <div class="wiz-desc" style="margin-top:10px;color:var(--text-muted)">This statement has no configurable settings. Use Delete to remove it.</div>`,
          `<button class="btn btn-ghost btn-sm" id="wiz-simple-cancel">Cancel</button>
           <div class="wiz-footer-right">
             <button class="btn btn-danger btn-sm" id="wiz-simple-delete">Delete</button>
           </div>`
        );
        document.getElementById('wiz-simple-cancel')?.addEventListener('click', close);
        document.getElementById('wiz-simple-delete')?.addEventListener('click', _deleteEditNode);
        return;
      }
    }

    // ── New statement routing by context ─────────────────────
    if (ctx === 'condition_operator') {
      _goConditionOperatorEditor();
    } else if (ctx === 'trigger_or_condition' || ctx === 'condition' || ctx === 'restriction') {
      _goConditionOrGroup();
    } else if (ctx === 'if_condition') {
      _sel.statement_class = 'condition';
      _goConditionBuilder();
    } else if (ctx === 'variable') {
      _goVariablePicker();
    } else if (ctx === 'task') {
      _goActionDevicePicker();
    } else {
      _goStatementTypePicker();
    }
  }

  // ── Modal shell ───────────────────────────────────────────
  function _render(title, bodyHtml, footerHtml) {
    const modal = document.getElementById('wizard-modal');
    if (!modal) return;
    modal.innerHTML = `
      <div class="wiz-header">
        <div class="wiz-title">${title ? _esc(title) : ''}</div>
        <button class="wiz-x" id="wiz-x">✕</button>
      </div>
      <div class="wiz-body" id="wiz-body">${bodyHtml}</div>
      <div class="wiz-footer" id="wiz-footer">${footerHtml}</div>
    `;
    document.getElementById('wiz-x')?.addEventListener('click', close);
    document.getElementById('wizard-backdrop').onclick = e => {
      if (e.target === document.getElementById('wizard-backdrop')) close();
    };
  }

  // ── DELETE ────────────────────────────────────────────────
  // Close the wizard FIRST so the confirm dialog isn't behind the wizard backdrop.
  // Capture the id before closing since close() clears _editNode.
  function _deleteEditNode() {
    if (!_editNode?.id) return;
    const id = _editNode.id;
    close();
    App.confirm({
      title: 'Delete statement',
      message: 'Delete this statement? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { Editor.deleteStatement(id); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function _newId() {
    return 'stmt_' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function _taskId() {
    return 'task_' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function _condId() {
    return 'cond_' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function _esc(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Architecture note ─────────────────────────────────────
  // The functions called from _route() above (_goConditionBuilder, _goVariablePicker,
  // _goStatementTypePicker, etc.) are defined in the other wizard-*.js files as
  // plain `function` declarations at the top level of those files (NOT inside any IIFE).
  // This means they are hoisted into the global (window) scope and accessible here.
  //
  // The state vars (_context, _editNode, _extra, _step, _sel, _stepStack, _deviceData)
  // and helpers (_esc, _newId, _render, _pushStep, _back, close, _deleteEditNode, etc.)
  // are defined in THIS file's IIFE closure, but they are NOT accessible to the
  // top-level functions in the other files by default.
  //
  // SOLUTION: expose them on a WizardCore namespace object so the other files
  // can access shared state and helpers without being inside this closure.

  // Public interface used by ALL other wizard-*.js files:
  const WizardCore = {
    // State accessors
    get context()    { return _context; },
    set context(v)   { _context = v; },
    get editNode()   { return _editNode; },
    set editNode(v)  { _editNode = v; },
    get extra()      { return _extra; },
    set extra(v)     { _extra = v; },
    get step()       { return _step; },
    set step(v)      { _step = v; },
    get sel()        { return _sel; },
    set sel(v)       { _sel = v; },
    get stepStack()  { return _stepStack; },
    set stepStack(v) { _stepStack = v; },
    get deviceData() { return _deviceData; },
    set deviceData(v){ _deviceData = v; },
    // globalsData setter also keeps _deviceData_globals in sync so _getFlatEntityIds can use it
    get globalsData()  { return _deviceData_globals; },
    set globalsData(v) { _deviceData_globals = v; },

    // Constants (read-only references)
    CONDITIONS, TRIGGERS, NEEDS_VALUE, NEEDS_DURATION_INTHELAST, NEEDS_DURATION_FOR,
    NEEDS_TWO_VALUES, DOMAIN_CAPS, ALLOWED_DOMAINS, DEMO_DEVICES, VIRTUAL_DEVICES,
    SYSTEM_VARS, LOCATION_COMMANDS, STATEMENT_TYPES, WEEKDAYS, MONTHS,

    // Helper functions
    isTrigger, _durationLabel, _needsDuration,
    _filterDevices, _groupDevices, _filterGrouped, _getCapsForDomain, _getFlatEntityIds,
    _esc, _newId, _taskId, _condId,
    _render, _pushStep, _back, close,
    _deleteEditNode,
    _injectComboCSS,
  };

  window.WizardCore = WizardCore;

  return { open, close };

})();
