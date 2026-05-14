// pistoncore/frontend/js/wizard.js — Session 41 full rewrite
// All gaps from SESSION_41_WIZARD_AUDIT.md fixed in one pass.
//
// KEY DESIGN RULES:
// 1. Condition wizard is ONE screen — device + attribute + operator + value all visible at once
// 2. Device picker for CONDITIONS opens as a sub-panel INSIDE the modal, not a full replacement
// 3. Action device picker IS a full step (separate screen) because it's multi-select
// 4. Back button always works by tracking a step stack
// 5. Clicking an existing node opens the correct edit screen for that node type

const Wizard = (() => {

  // ── State ─────────────────────────────────────────────────
  let _context = null;
  let _editNode = null;
  let _extra = {};
  let _step = null;
  let _sel = {};
  let _stepStack = [];
  let _deviceData = null;

  // ── Operators ─────────────────────────────────────────────
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

  const NEEDS_DURATION = new Set([
    'changed','did not change',
    'was','was any of','was not','was not any of',
    'stays','stays equal to','stays any of',
    'stays away from','stays away from any of','stays unchanged',
    'is any and stays any of','is away and stays away from',
  ]);

  const NEEDS_TWO_VALUES = new Set(['is between','is not between']);

  const isTrigger = op => TRIGGERS.includes(op);
  const durationLabel = op => op && op.startsWith('stays') ? 'For the next...' : 'In the last...';

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

  // ── Allowed HA domains for device pickers ─────────────────
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

  function _getCapsForDomain(entityIdOrList) {
    const ids = Array.isArray(entityIdOrList)
      ? entityIdOrList
      : String(entityIdOrList||'').split(',').map(s=>s.trim()).filter(Boolean);
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

  // ── Built-in demo devices ─────────────────────────────────
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

  const STATEMENT_TYPES = {
    basic: [
      { type:'if_block',   label:'If Block',  icon:'⟨/⟩', desc:'Execute different actions depending on conditions',  btn:'Add an if block', cls:'btn-primary' },
      { type:'action',     label:'Action',    icon:'⟨/⟩', desc:'Control devices and execute tasks',                  btn:'Add an action',   cls:'btn-green'   },
      { type:'timer',      label:'Timer',     icon:'⟨/⟩', desc:'Trigger execution at set time intervals',            btn:'Add a timer',     cls:'btn-orange'  },
    ],
    advanced: [
      { type:'switch',     label:'Switch',    icon:'⟨/⟩', desc:'Compare an operand against a set of values',         btn:'Add a switch',    cls:'btn-primary' },
      { type:'do_block',   label:'Do Block',  icon:'⟨/⟩', desc:'Organize several statements into a single block',    btn:'Add a do block',  cls:'btn-green'   },
      { type:'on_event',   label:'On Event',  icon:'⟨/⟩', desc:'Execute statements only when certain events happen', btn:'Add an on event', cls:'btn-orange'  },
    ],
    loops: [
      { type:'for_loop',   label:'For Loop',      icon:'⟨/⟩', desc:'Execute statements for a set number of cycles',       btn:'Add a for loop',     cls:'btn-orange' },
      { type:'for_each',   label:'For Each Loop', icon:'⟨/⟩', desc:'Execute statements for each device in a list',         btn:'Add a for each loop', cls:'btn-orange' },
      { type:'while_loop', label:'While Loop',    icon:'⟨/⟩', desc:'Execute statements as long as a condition is met',     btn:'Add a while loop',   cls:'btn-orange' },
      { type:'repeat_loop',label:'Repeat Loop',   icon:'⟨/⟩', desc:'Execute the same statements until a condition is met', btn:'Add a repeat loop',  cls:'btn-orange' },
      { type:'break',      label:'Break',         icon:'⟨/⟩', desc:'Interrupt the inner most loop',                        btn:'Add a break',        cls:'btn-red'    },
      { type:'exit',       label:'Exit',          icon:'⟨/⟩', desc:'Interrupt piston execution and exit immediately',       btn:'Add an exit',        cls:'btn-red'    },
    ],
  };

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
    _sel      = editNode ? { ...editNode } : {};

    _injectComboCSS();
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('wizard-backdrop').style.display = 'block';
    _route();
  }

  function close() {
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('wizard-backdrop').style.display = 'none';
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

    // ── Edit existing nodes ──────────────────────────────────
    if (_editNode) {
      const t = _editNode.type;

      // Condition / trigger / restriction edit
      if (t === 'trigger' || t === 'condition' || t === 'restriction' || ctx === 'edit_condition') {
        _sel.statement_class = 'condition';
        if (_editNode.subject) {
          _sel.subject_type   = _editNode.subject.type || 'device';
          _sel.device_id      = _editNode.subject.entity_id || '';
          _sel.device_label   = _editNode.subject.role || _editNode.subject.entity_id || '';
          _sel.devices        = [_sel.device_id];
          _sel.attribute      = _editNode.subject.capability || '';
          _sel.attribute_type = _editNode.subject.attribute_type || '';
        }
        _sel.operator        = _editNode.operator || '';
        _sel.aggregation     = _editNode.aggregation || 'any';
        _sel.value           = _editNode.display_value || _editNode.value || '';
        _sel.value2          = _editNode.value_to || '';
        _sel.duration_amount = _editNode.duration || 1;
        _sel.duration_unit   = _editNode.duration_unit || 'minutes';
        _sel.interaction     = _editNode.interaction || 'any';
        _goConditionBuilder();
        return;
      }

      // Variable edit
      if (t === 'variable') { _goVariablePicker(); return; }

      // Location command edits
      if (t === 'set_variable') { _goLocationCmd('set_variable'); return; }
      if (t === 'wait')         { _goLocationCmd('wait');         return; }
      if (t === 'log_message')  { _goLocationCmd('log');          return; }  // GAP-S40-1 fixed
      if (t === 'call_piston')  { _goLocationCmd('execute_piston'); return; }

      // Action edit — go directly to command picker (task context from editor)
      if (t === 'action') {
        // Pre-populate sel from the action node
        _sel.devices      = _editNode.devices || [];
        _sel.device_id    = _sel.devices[0] || '';
        _sel.device_label = _sel.devices[0] || '';
        if ((_editNode.tasks || []).length) {
          const task = _editNode.tasks[0];
          _sel.command      = task.command || '';
          _sel.parameters   = task.parameters || {};
        }
        // Determine if it's a location action
        if (_sel.device_id === '__location__' || (_editNode.devices||[]).includes('Location')) {
          const task = (_editNode.tasks||[])[0];
          if (task) _sel.location_cmd = task.command || '';
          _goLocationCmdPicker();
        } else {
          _goCommandPicker();
        }
        return;
      }

      // If block edit — open condition/group picker to add a condition
      if (t === 'if') {
        _context = 'if_condition';
        _extra = { 'block-id': _editNode.id };
        _sel.statement_class = 'condition';
        _goConditionOrGroup();
        return;
      }

      // Every / timer edit
      if (t === 'every') {
        _sel.interval      = _editNode.interval || 5;
        _sel.interval_unit = _editNode.interval_unit || 'minutes';
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
        _sel.for_start    = _editNode.start ?? 1;
        _sel.for_end      = _editNode.end ?? 10;
        _sel.for_step     = _editNode.step ?? 1;
        _sel.for_counter  = _editNode.counter_variable || '';
        _goForPicker();
        return;
      }

      // Switch edit — show expression picker
      if (t === 'switch') {
        _sel.switch_expression = _editNode.expression || null;
        _goSwitchPicker();
        return;
      }

      // While edit — open condition builder to add/edit while condition
      if (t === 'while') {
        _sel.statement_class = 'condition';
        _context = 'if_condition';
        _extra = { 'block-id': _editNode.id };
        _goConditionBuilder();
        return;
      }

      // Exit edit — show value field
      if (t === 'exit') {
        _goExitPicker();
        return;
      }

      // Repeat, do, on_event, break — no config needed, close
      if (t === 'repeat' || t === 'do' || t === 'on_event' || t === 'break') {
        close();
        return;
      }
    }

    // ── New statement routing by context ─────────────────────
    if (ctx === 'trigger_or_condition' || ctx === 'condition' || ctx === 'restriction') {
      _goConditionOrGroup();
    } else if (ctx === 'if_condition') {
      _sel.statement_class = 'condition';
      _goConditionBuilder();
    } else if (ctx === 'variable') {
      _goVariablePicker();
    } else if (ctx === 'task') {
      // task context = adding a task to an existing action node
      // _extra has block-id of the action node
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

  // ── CONDITION OR GROUP ────────────────────────────────────
  function _goConditionOrGroup() {
    _step = 'cog';
    _pushStep(_goConditionOrGroup);
    _render(
      'Add a new condition',
      `<div class="wiz-desc">An IF block is the simplest decisional block available. It allows you to execute different actions depending on conditions you set.</div>
       <div class="wiz-two-cards">
         <div class="wiz-card-option" id="wiz-pick-cond">
           <div class="wiz-card-option-title" style="color:var(--teal)">Condition</div>
           <div class="wiz-card-option-desc">A condition is a single comparison between two or more operands, the basic building block of a decisional statement</div>
           <button class="btn btn-primary btn-sm wiz-card-btn">Add a condition</button>
         </div>
         <div class="wiz-card-option" id="wiz-pick-group">
           <div class="wiz-card-option-title" style="color:var(--orange)">Group</div>
           <div class="wiz-card-option-desc">A group is a collection of conditions, with a logical operator between them, allowing for complex decisional statements</div>
           <button class="btn btn-orange btn-sm wiz-card-btn">Add a group</button>
         </div>
       </div>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-cancel">Cancel</button>`
    );
    document.getElementById('wiz-cancel')?.addEventListener('click', close);
    document.getElementById('wiz-pick-cond')?.addEventListener('click', () => {
      _sel.statement_class = 'condition';
      _goConditionBuilder();
    });
    document.getElementById('wiz-pick-group')?.addEventListener('click', () => {
      _sel.statement_class = 'group';
      _goGroupBuilder();
    });
  }

  // ── CONDITION BUILDER ─────────────────────────────────────
  function _goConditionBuilder() {
    _step = 'cond';
    _pushStep(_goConditionBuilder);

    const op        = _sel.operator || '';
    const hasDevice = !!_sel.device_id;
    const hasOp     = !!op;
    const needsVal  = NEEDS_VALUE.has(op);
    const needsDur  = NEEDS_DURATION.has(op);
    const needsTwo  = NEEDS_TWO_VALUES.has(op);
    const agg       = _sel.aggregation || 'any';
    const attr      = _sel.attribute || '';
    const interaction = _sel.interaction || 'any';
    const subjType  = _sel.subject_type || 'device';

    const backFn = _sel.statement_class === 'condition' && _context !== 'if_condition'
      ? _goConditionOrGroup : null;

    // "Which interaction" only shows when subject is device AND device is selected
    const showInteraction = subjType === 'device' && hasDevice;

    _render(
      'Add a new condition',
      `
      <div class="wiz-desc">A condition allows for a single comparison to be made between two expressions.</div>

      <div class="wiz-agg-bar" ${!hasDevice?'style="display:none"':''} id="wiz-agg-bar">
        <select id="wiz-agg" class="wiz-agg-select">
          <option value="any"  ${agg==='any'  ?'selected':''}>Any of the selected devices</option>
          <option value="all"  ${agg==='all'  ?'selected':''}>All of the selected devices</option>
          <option value="none" ${agg==='none' ?'selected':''}>None of the selected devices</option>
        </select>
      </div>

      <div class="wiz-row-label">What to compare</div>
      <div class="wiz-compare-row">
        <select id="wiz-subj-type" class="wiz-select-blue">
          <option value="device"   ${subjType==='device'  ?'selected':''}>Physical device(s)</option>
          <option value="variable" ${subjType==='variable'?'selected':''}>Variable</option>
          <option value="time"     ${subjType==='time'    ?'selected':''}>Time</option>
          <option value="date"     ${subjType==='date'    ?'selected':''}>Date</option>
          <option value="mode"     ${subjType==='mode'    ?'selected':''}>Mode</option>
        </select>
        <button class="wiz-device-pick-btn ${hasDevice?'has-value':''}" id="wiz-open-devpicker"
          style="flex:1;min-width:120px;${subjType!=='device'?'display:none':''}">
          ${hasDevice ? `<span class="wiz-device-tag">device</span> ${_esc(_sel.device_label||_sel.device_id)}` : 'Nothing selected'}
        </button>
        <select id="wiz-attr-select" class="wiz-select-blue wiz-attr-select ${attr?'has-value':''}"
          ${(!hasDevice || subjType!=='device')?'disabled':''}
          style="${subjType!=='device'?'display:none':''}">
          <option value="">attribute...</option>
          ${(_sel._caps||[]).map(c=>`<option value="${_esc(c.name)}" data-type="${_esc(c.attribute_type||'')}" ${attr===c.name?'selected':''}>${_esc(c.name)}</option>`).join('')}
        </select>
      </div>

      ${subjType==='variable' ? `
      <div style="margin-top:6px">
        <select id="wiz-subj-var" class="wiz-select-blue wiz-select-full">
          <option value="">Select a variable...</option>
          ${(Editor.getPistonVariables ? Editor.getPistonVariables() : []).map(v=>
            `<option value="${_esc(v.name)}" ${_sel.device_id===v.name?'selected':''}>${_esc(v.name)}</option>`
          ).join('')}
        </select>
      </div>` : ''}

      ${subjType==='time' ? `
      <div style="margin-top:6px">
        <input type="time" id="wiz-subj-time" class="wiz-value-input" value="${_esc(_sel.time_value||'')}" style="width:140px" />
      </div>` : ''}

      ${subjType==='date' ? `
      <div style="margin-top:6px">
        <input type="date" id="wiz-subj-date" class="wiz-value-input" value="${_esc(_sel.date_value||'')}" style="width:160px" />
      </div>` : ''}

      ${subjType==='mode' ? `
      <div style="margin-top:6px">
        <input type="text" id="wiz-subj-mode" class="wiz-value-input" placeholder="Mode name..." value="${_esc(_sel.mode_value||'')}" style="width:200px" />
      </div>` : ''}

      <div id="wiz-dev-panel" style="display:none;margin-top:4px;border:1px solid var(--border-subtle);border-radius:4px;background:var(--bg-raised)">
        <div style="padding:6px 8px;border-bottom:1px solid var(--border-subtle)">
          <input type="text" id="wiz-dev-panel-search" placeholder="Search devices..." autocomplete="off"
            style="width:100%;background:transparent;border:none;color:var(--text-primary);font-size:13px;outline:none;padding:2px 0" />
        </div>
        <div id="wiz-dev-panel-list" style="max-height:260px;overflow-y:auto"></div>
      </div>

      <div class="wiz-interaction-row" id="wiz-int-row" style="${showInteraction?'':'display:none'}">
        <span class="wiz-row-label-inline">Which interaction</span>
        <select id="wiz-interaction" class="wiz-select-blue-sm">
          <option value="any"          ${interaction==='any'          ?'selected':''}>Any interaction</option>
          <option value="physical"     ${interaction==='physical'     ?'selected':''}>Physical</option>
          <option value="programmatic" ${interaction==='programmatic' ?'selected':''}>Programmatic</option>
        </select>
      </div>

      <div class="wiz-row-label">What kind of comparison?</div>
      <select id="wiz-operator" class="wiz-select-blue wiz-select-full ${op?'has-value':''} ${isTrigger(op)?'is-trigger':''}">
        <option value="">Select a comparison...</option>
        <optgroup label="⚡ Triggers — fire when this happens">
          ${TRIGGERS.map(t=>`<option value="${_esc(t)}" ${op===t?'selected':''}>⚡ ${_esc(t)}</option>`).join('')}
        </optgroup>
        <optgroup label="Conditions — check current state">
          ${CONDITIONS.map(c=>`<option value="${_esc(c)}" ${op===c?'selected':''}>${_esc(c)}</option>`).join('')}
        </optgroup>
      </select>

      <div id="wiz-value-row" class="${needsVal?'':'hidden'}">
        <div class="wiz-row-label">Value</div>
        <div class="wiz-value-inputs" id="wiz-val-inputs">
          <select id="wiz-val-type" class="wiz-select-blue-sm" style="align-self:flex-start">
            <option value="value">Value</option>
            <option value="variable">Variable</option>
            <option value="expression">Expression</option>
            <option value="argument">Argument</option>
          </select>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
            <span id="wiz-val-widget" style="display:block;width:100%"></span>
            ${needsTwo ? `<span class="wiz-between-and" id="wiz-between-and">and</span><span id="wiz-val-widget-2" style="display:block;width:100%"></span>` : ''}
          </div>
        </div>
      </div>

      <div id="wiz-dur-row" class="${needsDur?'':'hidden'}">
        <div class="wiz-row-label" id="wiz-dur-label">${durationLabel(op)}</div>
        <div class="wiz-duration-inputs">
          <input type="number" id="wiz-dur-amount" class="wiz-dur-number" value="${_sel.duration_amount||1}" min="1" />
          <select id="wiz-dur-unit" class="wiz-select-blue-sm">
            <option value="seconds" ${(_sel.duration_unit||'minutes')==='seconds'?'selected':''}>seconds</option>
            <option value="minutes" ${(_sel.duration_unit||'minutes')==='minutes'?'selected':''}>minutes</option>
            <option value="hours"   ${(_sel.duration_unit||'minutes')==='hours'  ?'selected':''}>hours</option>
            <option value="days"    ${(_sel.duration_unit||'minutes')==='days'   ?'selected':''}>days</option>
          </select>
        </div>
      </div>

      ${_context === 'if_condition' ? `
      <div class="wiz-row-label" style="margin-top:10px">Connect to previous condition with</div>
      <select id="wiz-group-op-selector" class="wiz-select-blue wiz-select-full">
        <option value="and" ${(_sel.group_operator||'and')==='and'?'selected':''}>AND — all conditions must be true</option>
        <option value="or"  ${(_sel.group_operator||'and')==='or' ?'selected':''}>OR — any condition must be true</option>
      </select>` : ''}
      `,
      `
      <button class="btn btn-ghost btn-sm" id="wiz-back-btn">${backFn ? '← Back' : 'Cancel'}</button>
      <div class="wiz-footer-right">
        <button class="btn btn-ghost btn-sm" id="wiz-cog">⚙</button>
        <button class="btn btn-primary btn-sm" id="wiz-add-more" ${hasDevice&&hasOp?'':'disabled'}>Add more</button>
        <button class="btn btn-primary btn-sm" id="wiz-add"      ${hasDevice&&hasOp?'':'disabled'}>${_editNode ? 'Save' : 'Add'}</button>
      </div>
      `
    );

    if (needsVal) _renderValueWidget();
    if (hasDevice && subjType === 'device') _loadCapsIntoSelect();

    document.getElementById('wiz-back-btn')?.addEventListener('click', backFn || close);

    document.getElementById('wiz-subj-type')?.addEventListener('change', e => {
      _sel.subject_type = e.target.value;
      _goConditionBuilder();
    });

    document.getElementById('wiz-subj-var')?.addEventListener('change', e => {
      _sel.device_id = e.target.value;
      _refreshConditionRows();
    });

    document.getElementById('wiz-subj-time')?.addEventListener('change', e => {
      _sel.time_value = e.target.value;
      _refreshConditionRows();
    });

    document.getElementById('wiz-subj-date')?.addEventListener('change', e => {
      _sel.date_value = e.target.value;
      _refreshConditionRows();
    });

    document.getElementById('wiz-subj-mode')?.addEventListener('input', e => {
      _sel.mode_value = e.target.value;
      _refreshConditionRows();
    });

    document.getElementById('wiz-open-devpicker')?.addEventListener('click', () => {
      const panel = document.getElementById('wiz-dev-panel');
      if (!panel) return;
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        const searchEl = document.getElementById('wiz-dev-panel-search');
        if (searchEl) { searchEl.value = ''; searchEl.focus(); }
        _renderDevPanelList('');
        if (!_deviceData) {
          API.getDevices().then(data => {
            _deviceData = data;
            _renderDevPanelList(document.getElementById('wiz-dev-panel-search')?.value || '');
          }).catch(() => {});
        }
        let ft = null;
        searchEl?.addEventListener('input', e => {
          clearTimeout(ft);
          ft = setTimeout(() => _renderDevPanelList(e.target.value.trim()), 150);
        });
      }
    });

    if (!_deviceData) {
      API.getDevices().then(data => { _deviceData = data; }).catch(() => {});
    }

    document.getElementById('wiz-attr-select')?.addEventListener('change', e => {
      const opt = e.target.selectedOptions[0];
      _sel.attribute      = e.target.value;
      _sel.attribute_type = opt?.dataset.type || '';
      _renderValueWidget();
    });

    document.getElementById('wiz-operator')?.addEventListener('change', e => {
      _sel.operator = e.target.value;
      _refreshConditionRows();
    });

    document.getElementById('wiz-val-type')?.addEventListener('change', () => _renderValueWidget());

    document.getElementById('wiz-add')?.addEventListener('click', _commitCondition);
    document.getElementById('wiz-add-more')?.addEventListener('click', _commitConditionAndMore);
  }

  // ── VALUE WIDGET ──────────────────────────────────────────
  function _renderValueWidget() {
    const widget = document.getElementById('wiz-val-widget');
    if (!widget) return;
    const valType = document.getElementById('wiz-val-type')?.value || 'value';
    const attrType = _sel.attribute_type || '';
    const cap = (_sel._caps||[]).find(c => c.name === _sel.attribute);

    if (valType !== 'value') {
      const ph = valType === 'expression' ? 'Expression...' : valType === 'argument' ? 'Argument...' : 'Variable...';
      widget.innerHTML = `<textarea id="wiz-val-1" class="wiz-value-input wiz-expr-inline" placeholder="${ph}" style="width:100%;min-height:140px;resize:vertical;box-sizing:border-box;display:block">${_esc(_sel.value||'')}</textarea>`;
      const w2 = document.getElementById('wiz-val-widget-2');
      if (w2) w2.innerHTML = `<textarea id="wiz-val-2" class="wiz-value-input wiz-expr-inline" placeholder="Value..." style="width:100%;min-height:64px;resize:vertical;box-sizing:border-box">${_esc(_sel.value2||'')}</textarea>`;
      return;
    }

    if (attrType === 'binary' && cap?.values?.length) {
      widget.innerHTML = `<select id="wiz-val-1" class="wiz-select-blue wiz-select-full">
        ${cap.values.map(v => `<option value="${_esc(v)}" ${_sel.value===v?'selected':''}>${_esc(v)}</option>`).join('')}
      </select>`;
    } else if (attrType === 'enum' && cap?.values?.length) {
      widget.innerHTML = `<select id="wiz-val-1" class="wiz-select-blue wiz-select-full">
        <option value="">Select...</option>
        ${cap.values.map(v => `<option value="${_esc(v)}" ${_sel.value===v?'selected':''}>${_esc(v)}</option>`).join('')}
      </select>`;
    } else if (attrType === 'numeric') {
      const unit = cap?.unit || '';
      widget.innerHTML = `<input type="number" id="wiz-val-1" class="wiz-value-input wiz-dur-number" value="${_esc(_sel.value||'')}" placeholder="0" />${unit ? `<span style="color:var(--text-muted);font-size:12px;padding-left:4px">${_esc(unit)}</span>` : ''}`;
      const w2 = document.getElementById('wiz-val-widget-2');
      if (w2) w2.innerHTML = `<input type="number" id="wiz-val-2" class="wiz-value-input wiz-dur-number" value="${_esc(_sel.value2||'')}" placeholder="0" />${unit ? `<span style="color:var(--text-muted);font-size:12px;padding-left:4px">${_esc(unit)}</span>` : ''}`;
      return;
    } else {
      widget.innerHTML = `<textarea id="wiz-val-1" class="wiz-value-input wiz-expr-inline" placeholder="Value..." style="width:100%;min-height:140px;resize:vertical;box-sizing:border-box;display:block">${_esc(_sel.value||'')}</textarea>`;
    }

    const w2 = document.getElementById('wiz-val-widget-2');
    if (w2) w2.innerHTML = `<input type="text" id="wiz-val-2" class="wiz-value-input" value="${_esc(_sel.value2||'')}" placeholder="Value..." />`;
  }

  function _refreshConditionRows() {
    const op = document.getElementById('wiz-operator')?.value || '';
    _sel.operator = op;
    const needsVal = NEEDS_VALUE.has(op);
    const needsDur = NEEDS_DURATION.has(op);
    const needsTwo = NEEDS_TWO_VALUES.has(op);

    // "Has subject" is true for device (has device_id) OR for any other subject type
    // that has a value entered (variable selected, time entered, date entered, mode entered)
    const subjType = _sel.subject_type || 'device';
    let hasSubject = false;
    if (subjType === 'device') {
      hasSubject = !!_sel.device_id;
    } else if (subjType === 'variable') {
      hasSubject = !!(document.getElementById('wiz-subj-var')?.value || _sel.device_id);
    } else if (subjType === 'time') {
      hasSubject = !!(document.getElementById('wiz-subj-time')?.value || _sel.time_value);
    } else if (subjType === 'date') {
      hasSubject = !!(document.getElementById('wiz-subj-date')?.value || _sel.date_value);
    } else if (subjType === 'mode') {
      hasSubject = !!(document.getElementById('wiz-subj-mode')?.value || _sel.mode_value);
    }

    document.getElementById('wiz-value-row')?.classList.toggle('hidden', !needsVal);
    document.getElementById('wiz-dur-row')?.classList.toggle('hidden', !needsDur);

    const lbl = document.getElementById('wiz-dur-label');
    if (lbl) lbl.textContent = durationLabel(op);

    const andSpan = document.getElementById('wiz-between-and');
    const w2 = document.getElementById('wiz-val-widget-2');
    if (andSpan) andSpan.style.display = needsTwo ? '' : 'none';
    if (w2) w2.style.display = needsTwo ? '' : 'none';

    document.getElementById('wiz-operator')?.classList.toggle('is-trigger', isTrigger(op));

    if (needsVal) _renderValueWidget();

    const ok = hasSubject && !!op;
    document.getElementById('wiz-add')?.toggleAttribute('disabled', !ok);
    document.getElementById('wiz-add-more')?.toggleAttribute('disabled', !ok);
  }

  // ── DEVICE PANEL (condition builder sub-panel) ────────────
  function _renderDevPanelList(query) {
    const el = document.getElementById('wiz-dev-panel-list');
    if (!el) return;
    const q = query.toLowerCase();

    const physical = _filterDevices(_deviceData).filter(d =>
      !q || d.friendly_name.toLowerCase().includes(q) || d.entity_id.toLowerCase().includes(q)
    );
    const allLocals = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
    const localDeviceVars = allLocals.filter(v =>
      v.var_type === 'device' && (!q || v.name.toLowerCase().includes(q))
    );
    const filteredDemos = DEMO_DEVICES.filter(d =>
      !q || d.friendly_name.toLowerCase().includes(q)
    );

    let html = '';
    if (physical.length) {
      html += `<div class="wiz-device-group-header">Physical devices</div>`;
      html += physical.slice(0,150).map(d =>
        `<div class="wiz-device-row ${_sel.device_id===d.entity_id?'selected':''}" data-id="${_esc(d.entity_id)}" data-label="${_esc(d.friendly_name)}">
          <span class="wiz-dev-label">${_esc(d.friendly_name)}</span>
          <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${_esc(d.entity_id)}</span>
        </div>`
      ).join('');
    }
    if (localDeviceVars.length) {
      html += `<div class="wiz-device-group-header">Piston variables</div>`;
      html += localDeviceVars.map(v =>
        `<div class="wiz-device-row ${_sel.device_id===v.name?'selected':''}" data-id="${_esc(v.name)}" data-label="${_esc(v.name)}">
          <span class="wiz-dev-prefix">device</span>
          <span class="wiz-dev-label">${_esc(v.name)}</span>
        </div>`
      ).join('');
    }
    // Demo devices always shown, filtered by query
    html += `<div class="wiz-device-group-header">Demo devices</div>`;
    if (filteredDemos.length) {
      html += filteredDemos.map(d =>
        `<div class="wiz-device-row ${_sel.device_id===d.entity_id?'selected':''} wiz-demo-row" data-id="${_esc(d.entity_id)}" data-label="${_esc(d.friendly_name)}">
          <span class="wiz-dev-label">${_esc(d.friendly_name)}</span>
          <span class="wiz-demo-badge">demo</span>
        </div>`
      ).join('');
    } else {
      html += `<div class="wiz-empty" style="padding:4px 10px;font-size:12px;color:var(--text-muted)">No demo devices match.</div>`;
    }
    el.innerHTML = html || `<div class="wiz-empty" style="padding:8px 12px">No devices found.</div>`;

    el.querySelectorAll('.wiz-device-row').forEach(row => {
      row.addEventListener('click', () => {
        _sel.device_id    = row.dataset.id;
        _sel.device_label = row.dataset.label;
        _sel.devices      = [row.dataset.id];
        _sel.attribute    = '';
        _sel.attribute_type = '';
        _sel._caps = [];

        document.getElementById('wiz-dev-panel').style.display = 'none';

        const btn = document.getElementById('wiz-open-devpicker');
        if (btn) {
          btn.innerHTML = `<span class="wiz-device-tag">device</span> ${_esc(_sel.device_label)}`;
          btn.classList.add('has-value');
        }

        const aggBar = document.getElementById('wiz-agg-bar');
        if (aggBar) aggBar.style.display = '';

        // Show "Which interaction" now that a device is selected
        const intRow = document.getElementById('wiz-int-row');
        if (intRow && (_sel.subject_type || 'device') === 'device') {
          intRow.style.display = '';
        }

        const attrSel = document.getElementById('wiz-attr-select');
        if (attrSel) {
          attrSel.disabled = false;
          attrSel.innerHTML = `<option value="">loading...</option>`;
        }
        _loadCapsIntoSelect();

        document.querySelectorAll('#wiz-dev-panel-list .wiz-device-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');

        _refreshConditionRows();
      });
    });
  }

  async function _loadCapsIntoSelect() {
    const sel = document.getElementById('wiz-attr-select');
    if (!sel) return;

    let caps = [];
    const demo = DEMO_DEVICES.find(d => d.entity_id === _sel.device_id);
    if (demo) {
      caps = demo.capabilities;
    } else {
      const allLocals = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
      const localVar = allLocals.find(v => v.var_type === 'device' && v.name === _sel.device_id);
      if (localVar) {
        const rawVal = String(localVar.initial_value || '');
        const entityIds = rawVal.split(',').map(s => s.trim()).filter(Boolean);
        const hasEntityIds = entityIds.some(id => id.includes('.'));
        if (hasEntityIds) {
          caps = _getCapsForDomain(entityIds);
        } else if (entityIds.length && _deviceData) {
          const resolved = entityIds.map(label => {
            const match = (_deviceData||[]).find(d =>
              d.friendly_name.toLowerCase() === label.toLowerCase());
            return match ? match.entity_id : null;
          }).filter(Boolean);
          caps = resolved.length ? _getCapsForDomain(resolved) : _getCapsForDomain('light.unknown');
        } else {
          caps = _getCapsForDomain('light.unknown');
        }
      } else {
        try {
          const data = await API.getCapabilities(_sel.device_id);
          caps = data.capabilities || [];
        } catch(e) { caps = []; }
      }
    }

    if (!caps.length && _sel.device_id && _sel.device_id.includes('.')) {
      caps = _getCapsForDomain(_sel.device_id);
    }
    _sel._caps = caps;
    sel.innerHTML = `<option value="">attribute...</option>` +
      caps.map(c => `<option value="${_esc(c.name)}" data-type="${_esc(c.attribute_type||'')}" ${_sel.attribute===c.name?'selected':''}>${_esc(c.name)}</option>`).join('');
    sel.disabled = caps.length === 0;
  }

  // ── GROUP BUILDER ─────────────────────────────────────────
  function _goGroupBuilder() {
    _step = 'group';
    _pushStep(_goGroupBuilder);
    _render(
      'Add a new condition group',
      `<div class="wiz-desc">A group is a collection of conditions joined by a logical operator.</div>
       <div class="wiz-row-label">Group operator</div>
       <select id="wiz-group-op" class="wiz-select-blue wiz-select-full">
         <option value="AND">AND — all conditions must be true</option>
         <option value="OR">OR — any condition must be true</option>
       </select>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-grp-back">← Back</button>
       <div class="wiz-footer-right">
         <button class="btn btn-primary btn-sm" id="wiz-grp-add">Add</button>
       </div>`
    );
    document.getElementById('wiz-grp-back')?.addEventListener('click', _goConditionOrGroup);
    document.getElementById('wiz-grp-add')?.addEventListener('click', () => {
      Editor.insertStatement(_context, {
        type:'group', id:_newId(),
        group_operator: document.getElementById('wiz-group-op')?.value || 'AND',
        conditions:[],
      });
      close();
    });
  }

  // ── COMMIT CONDITION ──────────────────────────────────────
  // FIX: Path A (create new if node) only runs when context is NOT if_condition.
  // Path B (append to existing if block) runs when context IS if_condition.
  function _commitCondition() {
    const node = _buildConditionNode();
    if (!node) return;

    if (_context === 'if_condition') {
      // Adding condition to EXISTING if block — pass blockId in meta
      const blockId = _extra?.['block-id'] || null;
      const meta = blockId ? { blockId } : {};
      close();
      Editor.insertStatement(_context, node, meta);
    } else {
      // New if block — wrap condition in an if node
      const ifBlockId = _extra?.['block-id'] || _newId();
      const ifNode = {
        type: 'if', id: ifBlockId, async: false,
        conditions: [node], condition_operator: 'and',
        then: [], else_ifs: [], else: [],
        description: null, disabled: false,
      };
      const ctx = _context;
      close();
      Editor.insertStatement(ctx, ifNode);
    }
  }

  function _commitConditionAndMore() {
    const node = _buildConditionNode();
    if (!node) return;

    if (_context === 'if_condition') {
      // Adding to existing if block
      const blockId = _extra?.['block-id'] || null;
      const meta = blockId ? { blockId } : {};
      Editor.insertStatement(_context, node, meta);
      _sel = { statement_class:'condition', group_operator: 'and' };
    } else {
      // First condition on a new if block
      const ifBlockId = _extra?.['block-id'] || _newId();
      const ifNode = {
        type: 'if', id: ifBlockId, async: false,
        conditions: [node], condition_operator: 'and',
        then: [], else_ifs: [], else: [],
        description: null, disabled: false,
      };
      Editor.insertStatement(_context, ifNode);
      // Switch context so next condition adds to the if block we just created
      _sel = { statement_class:'condition' };
      _context = 'if_condition';
      _extra = { 'block-id': ifBlockId };
    }
    _editNode = null;
    _stepStack = [];
    _goConditionBuilder();
  }

  function _buildConditionNode() {
    const op = document.getElementById('wiz-operator')?.value || _sel.operator || '';
    const subjType = _sel.subject_type || 'device';

    let role = '';
    let entity_id = '';

    if (subjType === 'device') {
      role = _sel.device_label || _sel.device_id || '';
      entity_id = _sel.device_id || '';
    } else if (subjType === 'variable') {
      role = document.getElementById('wiz-subj-var')?.value || _sel.device_id || '';
      entity_id = role;
    } else if (subjType === 'time') {
      role = 'time';
      entity_id = document.getElementById('wiz-subj-time')?.value || _sel.time_value || '';
    } else if (subjType === 'date') {
      role = 'date';
      entity_id = document.getElementById('wiz-subj-date')?.value || _sel.date_value || '';
    } else if (subjType === 'mode') {
      role = 'mode';
      entity_id = document.getElementById('wiz-subj-mode')?.value || _sel.mode_value || '';
    }

    if (!role || !op) return null;

    const attrSel = document.getElementById('wiz-attr-select');
    const attrVal  = attrSel ? attrSel.value : (_sel.attribute || '');
    const attrType = attrSel ? (attrSel.selectedOptions[0]?.dataset.type || '') : (_sel.attribute_type || '');

    const rawVal1 = document.getElementById('wiz-val-1')?.value || '';
    const rawVal2 = document.getElementById('wiz-val-2')?.value || '';
    const isBinary = attrType === 'binary';
    const BINARY_COMPILED = { open:'on', closed:'off', detected:'on', clear:'off',
      active:'on', inactive:'off', wet:'on', dry:'off', home:'on', away:'off',
      locked:'off', unlocked:'on', on:'on', off:'off' };
    const compiledVal1 = isBinary
      ? (BINARY_COMPILED[rawVal1.toLowerCase()] ?? rawVal1)
      : rawVal1;

    const needsDur = NEEDS_DURATION.has(op);
    const durAmount = needsDur ? (parseInt(document.getElementById('wiz-dur-amount')?.value || '1') || 1) : null;
    const durUnit   = needsDur ? (document.getElementById('wiz-dur-unit')?.value || 'minutes') : null;

    const groupOpEl = document.getElementById('wiz-group-op-selector');
    const groupOp = groupOpEl ? groupOpEl.value : 'and';

    const subject = {
      type: subjType,
      role: role,
      entity_id: entity_id,
      capability: attrVal,
      attribute_type: attrType,
      device_class: _sel.device_class || null,
    };

    return {
      id: _editNode?.id || _newId(),
      is_trigger: isTrigger(op),
      subject,
      aggregation: document.getElementById('wiz-agg')?.value || _sel.aggregation || 'any',
      operator: op,
      display_value: rawVal1,
      compiled_value: compiledVal1,
      value_to: rawVal2 || null,
      duration: durAmount,
      duration_unit: durUnit,
      interaction: document.getElementById('wiz-interaction')?.value || 'any',
      group_operator: groupOp,
    };
  }

  // ── STATEMENT TYPE PICKER ─────────────────────────────────
  function _goStatementTypePicker() {
    _step = 'stmt_type';
    _pushStep(_goStatementTypePicker);

    const cardSection = (title, types) => `
      <div class="wiz-section-label">${_esc(title)}</div>
      <div class="wiz-card-grid">
        ${types.map(t=>`
          <div class="wiz-stmt-card" data-stype="${_esc(t.type)}">
            <div class="wiz-stmt-icon">${t.icon}</div>
            <div class="wiz-stmt-name">${_esc(t.label)}</div>
            <div class="wiz-stmt-desc">${_esc(t.desc)}</div>
            <button class="btn ${t.cls} btn-sm wiz-stmt-btn">${_esc(t.btn)}</button>
          </div>`).join('')}
      </div>`;

    _render('',
      cardSection('Basic statements', STATEMENT_TYPES.basic) +
      cardSection('Advanced statements', STATEMENT_TYPES.advanced) +
      `<div class="wiz-card-grid">${STATEMENT_TYPES.loops.map(t=>`
        <div class="wiz-stmt-card" data-stype="${_esc(t.type)}">
          <div class="wiz-stmt-icon">${t.icon}</div>
          <div class="wiz-stmt-name">${_esc(t.label)}</div>
          <div class="wiz-stmt-desc">${_esc(t.desc)}</div>
          <button class="btn ${t.cls} btn-sm wiz-stmt-btn">${_esc(t.btn)}</button>
        </div>`).join('')}</div>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-stmt-cancel">Cancel</button>`
    );

    document.getElementById('wiz-stmt-cancel')?.addEventListener('click', close);
    document.querySelectorAll('[data-stype]').forEach(card => {
      card.addEventListener('click', () => _handleStatementType(card.dataset.stype));
    });
  }

  function _handleStatementType(type) {
    if (type === 'action')                           { _goActionDevicePicker(); return; }
    if (type === 'timer'  || type === 'every')       { _goTimerPicker();        return; }
    if (type === 'for_each')                         { _goForEachPicker();       return; }
    if (type === 'for_loop')                         { _goForPicker();           return; }
    if (type === 'switch')                           { _goSwitchPicker();        return; }
    if (type === 'exit')                             { _goExitPicker();          return; }

    // repeat — no config, insert directly (WebCoRE repeat has no count)
    if (type === 'repeat' || type === 'repeat_loop') {
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      close();
      Editor.insertStatement(_context, {
        type:'repeat', id:_newId(), async:false,
        statements:[], until_conditions:[], condition_operator:'and',
        description:null, disabled:false,
      }, meta);
      return;
    }

    // while — go to condition builder first (adds first while condition after insert)
    if (type === 'while' || type === 'while_loop') {
      const whileId = _newId();
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      // Insert the while node first, then open condition builder targeting it
      Editor.insertStatement(_context, {
        type:'while', id:whileId, async:false,
        conditions:[], condition_operator:'and',
        statements:[],
        description:null, disabled:false,
      }, meta);
      // Now open wizard to add a condition to the while block
      _context = 'if_condition';
      _extra = { 'block-id': whileId };
      _editNode = null;
      _sel = { statement_class:'condition' };
      _stepStack = [];
      _goConditionBuilder();
      return;
    }

    // if block — go to condition/group picker
    if (type === 'if' || type === 'if_block') {
      _extra = { 'block-id': _newId() };
      _sel.statement_class = 'condition';
      _goConditionOrGroup();
      return;
    }

    // Skeletons for types with no config
    const skeletons_alias = { do_block:'do', on_event:'on_event' };
    const resolvedKey = skeletons_alias[type] || type;

    const skeletonMap = {
      do: {
        type:'do', id:_newId(), async:false,
        statements:[],
        description:null, disabled:false,
      },
      on_event: {
        type:'on_event', id:_newId(), async:false,
        conditions:[], condition_operator:'and',
        statements:[],
        description:null, disabled:false,
      },
      break: {
        type:'break', id:_newId(),
        description:null, disabled:false,
      },
    };

    if (skeletonMap[resolvedKey]) {
      const node = skeletonMap[resolvedKey];
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      close();
      Editor.insertStatement(_context, node, meta);
    }
  }

  // ── FOR LOOP PICKER ───────────────────────────────────────
  function _goForPicker() {
    _step = 'for';
    _pushStep(_goForPicker);
    const pistonVars = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
      .filter(v => ['integer','decimal','dynamic'].includes(v.var_type));

    _render('Add a for loop',
      `<div class="wiz-desc">A FOR loop repeats statements for a preset number of iterations. You can use a counter variable that updates to reflect the current iteration index.</div>
       <div class="wiz-row-label">Start value</div>
       <input type="number" id="wiz-for-start" class="wiz-value-input wiz-dur-number" value="${_esc(String(_sel.for_start??1))}" />
       <div class="wiz-row-label" style="margin-top:8px">End value</div>
       <input type="number" id="wiz-for-end" class="wiz-value-input wiz-dur-number" value="${_esc(String(_sel.for_end??10))}" />
       <div class="wiz-row-label" style="margin-top:8px">Step</div>
       <input type="number" id="wiz-for-step" class="wiz-value-input wiz-dur-number" value="${_esc(String(_sel.for_step??1))}" min="1" />
       <div class="wiz-row-label" style="margin-top:8px">Counter variable (optional)</div>
       <select id="wiz-for-counter" class="wiz-select-blue wiz-select-full">
         <option value="">Nothing selected</option>
         ${pistonVars.map(v=>`<option value="${_esc(v.name)}" ${_sel.for_counter===v.name?'selected':''}>${_esc(v.name)} (${_esc(v.var_type)})</option>`).join('')}
       </select>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-for-back">← Back</button>
       <div class="wiz-footer-right">
         <button class="btn btn-primary btn-sm" id="wiz-for-save">${_editNode ? 'Save' : 'Add a statement'}</button>
       </div>`
    );
    document.getElementById('wiz-for-back')?.addEventListener('click', _editNode ? close : _goStatementTypePicker);
    document.getElementById('wiz-for-save')?.addEventListener('click', () => {
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      const node = {
        type:'for', id:_editNode?.id || _newId(), async:false,
        start:   parseInt(document.getElementById('wiz-for-start')?.value||'1') || 1,
        end:     parseInt(document.getElementById('wiz-for-end')?.value||'10') || 10,
        step:    parseInt(document.getElementById('wiz-for-step')?.value||'1') || 1,
        counter_variable: document.getElementById('wiz-for-counter')?.value || null,
        statements:[], description:null, disabled:false,
      };
      close();
      Editor.insertStatement(_context, node, meta);
    });
  }

  // ── SWITCH PICKER ─────────────────────────────────────────
  function _goSwitchPicker() {
    _step = 'switch';
    _pushStep(_goSwitchPicker);
    const existingExpr = _sel.switch_expression?.expression || _sel.switch_expression?.data || '';
    _render('Add a switch block',
      `<div class="wiz-desc">A SWITCH block compares an expression against a list of possible values and executes actions based on which value matches.</div>
       <div class="wiz-row-label">Expression to switch on</div>
       <textarea id="wiz-switch-expr" class="wiz-expr-area" placeholder="e.g. $myVariable or an expression...">${_esc(existingExpr)}</textarea>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-switch-back">← Back</button>
       <div class="wiz-footer-right">
         <button class="btn btn-primary btn-sm" id="wiz-switch-save">${_editNode ? 'Save' : 'Add a case'}</button>
       </div>`
    );
    document.getElementById('wiz-switch-back')?.addEventListener('click', _editNode ? close : _goStatementTypePicker);
    document.getElementById('wiz-switch-save')?.addEventListener('click', () => {
      const expr = document.getElementById('wiz-switch-expr')?.value.trim() || '';
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      const node = {
        type:'switch', id:_editNode?.id || _newId(), async:false,
        expression: expr ? { type:'expression', expression: expr } : null,
        case_traversal_policy:'safe',
        cases:[], default:[],
        description:null, disabled:false,
      };
      close();
      Editor.insertStatement(_context, node, meta);
    });
  }

  // ── EXIT PICKER ───────────────────────────────────────────
  function _goExitPicker() {
    _step = 'exit';
    _pushStep(_goExitPicker);
    const existingVal = _editNode?.value?.data !== undefined ? String(_editNode.value.data) :
                        _editNode?.value?.expression || '';
    _render('Add an exit',
      `<div class="wiz-desc">Exit causes the piston to end execution immediately. You can optionally set a new piston state value.</div>
       <div class="wiz-row-label">New piston state (optional)</div>
       <input type="text" id="wiz-exit-val" class="wiz-value-input" placeholder="Leave blank for default..." value="${_esc(existingVal)}" />`,
      `<button class="btn btn-ghost btn-sm" id="wiz-exit-back">← Back</button>
       <div class="wiz-footer-right">
         <button class="btn btn-primary btn-sm" id="wiz-exit-save">${_editNode ? 'Save' : 'Add'}</button>
       </div>`
    );
    document.getElementById('wiz-exit-back')?.addEventListener('click', _editNode ? close : _goStatementTypePicker);
    document.getElementById('wiz-exit-save')?.addEventListener('click', () => {
      const val = document.getElementById('wiz-exit-val')?.value.trim() || '';
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      const node = {
        type:'exit', id:_editNode?.id || _newId(),
        value: val ? { type:'expression', expression: val } : null,
        description:null, disabled:false,
      };
      close();
      Editor.insertStatement(_context, node, meta);
    });
  }

  // ── ACTION DEVICE PICKER ──────────────────────────────────
  function _goActionDevicePicker() {
    _step = 'act_dev';
    _pushStep(_goActionDevicePicker);
    _render(
      'Add a new action',
      `<div class="wiz-desc">Actions represent a collection of tasks a device or group of devices have to perform. The <em>Location</em> virtual device provides non-device-specific tasks like notifications, variable setting, and more.</div>
       <div class="wiz-selected-bar" id="wiz-sel-bar" style="display:none"><span id="wiz-sel-label"></span></div>
       <div class="wiz-search-row" style="margin:8px 0 4px;border:1px solid var(--border-subtle);border-radius:4px;padding:4px 8px;background:var(--bg-raised)">
         <span style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Use the input box below to quickly search for devices</span>
         <input type="text" id="wiz-act-search" placeholder="" autocomplete="off" style="width:100%;background:transparent;border:none;color:var(--text-primary);font-size:13px;outline:none;padding:2px 0" />
       </div>
       <div style="display:flex;gap:8px;margin:4px 0">
         <button class="btn btn-ghost btn-xs" id="wiz-sel-all">Select All</button>
         <button class="btn btn-ghost btn-xs" id="wiz-desel-all">Deselect All</button>
       </div>
       <div class="wiz-device-list" id="wiz-act-devlist">
         <div class="wiz-loading"><div class="spinner"></div></div>
       </div>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-act-cancel">Cancel</button>
       <button class="btn btn-primary btn-sm" id="wiz-act-next" disabled>Next →</button>`
    );

    document.getElementById('wiz-act-cancel')?.addEventListener('click', close);
    document.getElementById('wiz-act-next')?.addEventListener('click', () => {
      if (!_sel.devices?.length) return;
      if (_sel.device_id === '__location__') _goLocationCmdPicker();
      else _goCommandPicker();
    });
    document.getElementById('wiz-sel-all')?.addEventListener('click', () => _actDevSelectAll(true));
    document.getElementById('wiz-desel-all')?.addEventListener('click', () => _actDevSelectAll(false));

    let _ft = null;
    document.getElementById('wiz-act-search')?.addEventListener('input', e => {
      clearTimeout(_ft);
      _ft = setTimeout(() => _renderActDevList(e.target.value.trim()), 200);
    });

    _loadActDevices();
  }

  async function _loadActDevices() {
    _renderActDevList('');
    try {
      if (!_deviceData) _deviceData = await API.getDevices();
      _renderActDevList(document.getElementById('wiz-act-search')?.value || '');
    } catch(e) {}
  }

  function _renderActDevList(query) {
    const el = document.getElementById('wiz-act-devlist');
    if (!el) return;
    const q = query.toLowerCase();

    const physical = _filterDevices(_deviceData).filter(d =>
      !q || d.friendly_name.toLowerCase().includes(q) || d.entity_id.toLowerCase().includes(q)
    );
    const allLocals = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
    const pistonDevVars = allLocals.filter(v =>
      v.var_type === 'device' && (!q || v.name.toLowerCase().includes(q))
    );
    // Filter virtual/system/demo by query but ALWAYS show the section headers
    const filteredVirtual = VIRTUAL_DEVICES.filter(v =>
      !q || v.friendly_name.toLowerCase().includes(q)
    );
    const filteredSystem = SYSTEM_VARS.filter(sv =>
      !q || sv.toLowerCase().includes(q)
    );
    const filteredDemo = DEMO_DEVICES.filter(d =>
      !q || d.friendly_name.toLowerCase().includes(q)
    );

    const sel = new Set(_sel.devices||[]);

    let html = '';

    // Virtual devices — always shown (filtered by query)
    html += `<div class="wiz-device-group-header">Virtual devices</div>`;
    if (filteredVirtual.length) {
      html += filteredVirtual.map(v => _actDevRow(v.entity_id, v.friendly_name, sel.has(v.entity_id))).join('');
    } else {
      html += `<div class="wiz-empty" style="padding:4px 10px;font-size:12px;color:var(--text-muted)">None match.</div>`;
    }

    if (physical.length) {
      html += `<div class="wiz-device-group-header">Physical devices</div>`;
      html += physical.slice(0,150).map(d => _actDevRow(d.entity_id, d.friendly_name, sel.has(d.entity_id))).join('');
    }

    if (pistonDevVars.length) {
      html += `<div class="wiz-device-group-header">Piston variables</div>`;
      html += pistonDevVars.map(v =>
        `<div class="wiz-device-row ${sel.has(v.name)?'selected':''}" data-id="${_esc(v.name)}" data-label="${_esc(v.name)}">
          <span class="wiz-dev-prefix">device</span>
          <span class="wiz-dev-label">${_esc(v.name)}</span>
        </div>`
      ).join('');
    }

    // System variables — always shown (filtered)
    html += `<div class="wiz-device-group-header">System variables</div>`;
    if (filteredSystem.length) {
      html += filteredSystem.map(sv => _actDevRow(sv, sv, sel.has(sv))).join('');
    } else {
      html += `<div class="wiz-empty" style="padding:4px 10px;font-size:12px;color:var(--text-muted)">None match.</div>`;
    }

    // Demo devices — always shown (filtered)
    html += `<div class="wiz-device-group-header">Demo devices</div>`;
    if (filteredDemo.length) {
      html += filteredDemo.map(d =>
        `<div class="wiz-device-row ${sel.has(d.entity_id)?'selected':''} wiz-demo-row" data-id="${_esc(d.entity_id)}" data-label="${_esc(d.friendly_name)}">
          <span class="wiz-dev-label">${_esc(d.friendly_name)}</span>
          <span class="wiz-demo-badge">demo</span>
        </div>`
      ).join('');
    } else {
      html += `<div class="wiz-empty" style="padding:4px 10px;font-size:12px;color:var(--text-muted)">None match.</div>`;
    }

    el.innerHTML = html;

    el.querySelectorAll('.wiz-device-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const isVirtual = id.startsWith('__');
        if (isVirtual) {
          el.querySelectorAll('.wiz-device-row').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
          _sel.devices = [id];
          _sel.device_id = id;
          _sel.device_label = row.dataset.label;
          _updateActSelBar([row.dataset.label]);
          document.getElementById('wiz-act-next')?.removeAttribute('disabled');
          setTimeout(() => {
            if (id === '__location__') _goLocationCmdPicker();
            else _goCommandPicker();
          }, 150);
        } else {
          row.classList.toggle('selected');
          const newSel = new Set(_sel.devices||[]);
          if (row.classList.contains('selected')) newSel.add(id); else newSel.delete(id);
          _sel.devices = [...newSel];
          _sel.device_id = _sel.devices[0] || '';
          _sel.device_label = _sel.devices.length === 1 ? row.dataset.label : `${_sel.devices.length} devices`;
          _updateActSelBar(_sel.devices.map(d => el.querySelector(`[data-id="${CSS.escape(d)}"]`)?.dataset.label || d));
          document.getElementById('wiz-act-next')?.toggleAttribute('disabled', !_sel.devices.length);
        }
      });
    });

    sel.forEach(id => el.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('selected'));
  }

  function _actDevRow(id, label, selected) {
    return `<div class="wiz-device-row ${selected?'selected':''}" data-id="${_esc(id)}" data-label="${_esc(label)}">
      <span class="wiz-dev-label">${_esc(label)}</span>
    </div>`;
  }

  function _updateActSelBar(labels) {
    const bar = document.getElementById('wiz-sel-bar');
    const lbl = document.getElementById('wiz-sel-label');
    if (!bar||!lbl) return;
    bar.style.display = labels.length ? '' : 'none';
    lbl.textContent = labels.join(', ');
  }

  function _actDevSelectAll(on) {
    const rows = document.querySelectorAll('#wiz-act-devlist .wiz-device-row');
    const ids=[]; const labels=[];
    rows.forEach(r => {
      on ? r.classList.add('selected') : r.classList.remove('selected');
      if (on) { ids.push(r.dataset.id); labels.push(r.dataset.label); }
    });
    _sel.devices = on ? ids : [];
    _sel.device_id = ids[0]||'';
    _updateActSelBar(on ? labels : []);
    document.getElementById('wiz-act-next')?.toggleAttribute('disabled', !on || !ids.length);
  }

  // ── LOCATION COMMAND PICKER ───────────────────────────────
  function _goLocationCmdPicker() {
    _step = 'loc_cmd';
    _pushStep(_goLocationCmdPicker);
    const isNew = !_editNode;
    _render(
      'Add a new task',
      `<div class="wiz-with-row"><span class="wiz-with-label">With...</span><span class="wiz-with-device">Location</span></div>
       <div class="wiz-do-label">Do...</div>
       <select id="wiz-loc-cmd" class="wiz-select-blue wiz-select-full">
         <option value="">Please select a command</option>
         ${LOCATION_COMMANDS.map(c=>`<option value="${_esc(c.id)}" ${_sel.location_cmd===c.id?'selected':''}>${_esc(c.label)}</option>`).join('')}
       </select>
       <div id="wiz-loc-params" style="margin-top:10px"></div>`,
      `<div class="wiz-footer-left">
         <button class="btn btn-ghost btn-sm" id="wiz-loc-back">← Back</button>
         ${!isNew ? `<button class="btn btn-danger btn-sm" id="wiz-loc-del">Delete</button>` : ''}
       </div>
       <div class="wiz-footer-right">
         <button class="btn btn-ghost btn-sm" id="wiz-loc-cog">⚙</button>
         ${isNew ? `<button class="btn btn-primary btn-sm" id="wiz-loc-addmore" ${_sel.location_cmd?'':'disabled'}>Add more</button>` : ''}
         <button class="btn btn-primary btn-sm" id="wiz-loc-save" ${_sel.location_cmd?'':'disabled'}>${isNew ? 'Add' : 'Save'}</button>
       </div>`
    );

    document.getElementById('wiz-loc-back')?.addEventListener('click', _goActionDevicePicker);
    document.getElementById('wiz-loc-del')?.addEventListener('click', _deleteEditNode);
    document.getElementById('wiz-loc-save')?.addEventListener('click', () => _saveLocationCmd(false));
    document.getElementById('wiz-loc-addmore')?.addEventListener('click', () => _saveLocationCmd(true));

    document.getElementById('wiz-loc-cmd')?.addEventListener('change', e => {
      _sel.location_cmd = e.target.value;
      _renderLocParams(e.target.value);
      document.getElementById('wiz-loc-save')?.removeAttribute('disabled');
      document.getElementById('wiz-loc-addmore')?.removeAttribute('disabled');
    });
    if (_sel.location_cmd) _renderLocParams(_sel.location_cmd);
  }

  function _goLocationCmd(cmd) {
    _sel.location_cmd = cmd;
    _sel.device_id = '__location__';
    _sel.device_label = 'Location';
    _sel.devices = ['__location__'];
    // Pre-populate from editNode
    if (_editNode) {
      if (cmd === 'set_variable') {
        _sel.variable = _editNode.variable || '';
        _sel.value    = _editNode.value?.expression || _editNode.value?.data || '';
      } else if (cmd === 'wait') {
        _sel.duration_amount = _editNode.duration || 1;
        _sel.duration_unit   = _editNode.duration_unit || 'minutes';
      } else if (cmd === 'log') {
        _sel.message = _editNode.message?.data || _editNode.message || '';
      } else if (cmd === 'execute_piston') {
        _sel.target_piston_id = _editNode.target_piston_id || '';
      }
    }
    _goLocationCmdPicker();
  }

  function _renderLocParams(cmd) {
    const el = document.getElementById('wiz-loc-params');
    if (!el) return;
    if (cmd === 'set_variable') {
      el.innerHTML = `
        <div class="wiz-row-label">Variable</div>
        <div class="wiz-value-inputs">
          <select id="wiz-sv-scope" class="wiz-select-blue-sm"><option value="local">Variable</option><option value="global">Global</option></select>
          <input type="text" id="wiz-sv-name" class="wiz-value-input" placeholder="Variable name..." value="${_esc(_sel.variable||'')}" />
        </div>
        <div class="wiz-row-label" style="margin-top:10px">Value</div>
        <select id="wiz-sv-valtype" class="wiz-select-blue-sm">
          <option value="expression">Expression</option>
          <option value="value">Value</option>
          <option value="variable">Variable</option>
        </select>
        <textarea id="wiz-sv-expr" class="wiz-expr-area" placeholder="">${_esc(_sel.value||'')}</textarea>`;
    } else if (cmd === 'wait') {
      el.innerHTML = `
        <div class="wiz-row-label">Duration</div>
        <div class="wiz-duration-inputs">
          <input type="number" id="wiz-wait-n" class="wiz-dur-number" value="${_sel.duration_amount||1}" min="1" />
          <select id="wiz-wait-u" class="wiz-select-blue-sm">
            <option value="milliseconds">milliseconds</option>
            <option value="seconds">seconds</option>
            <option value="minutes" ${(_sel.duration_unit||'minutes')==='minutes'?'selected':''}>minutes</option>
            <option value="hours"   ${(_sel.duration_unit||'')==='hours'?'selected':''}>hours</option>
          </select>
        </div>`;
    } else if (cmd === 'log') {
      el.innerHTML = `
        <div class="wiz-row-label">Message</div>
        <textarea id="wiz-log-msg" class="wiz-expr-area">${_esc(_sel.message||'')}</textarea>
        <select id="wiz-log-lvl" class="wiz-select-blue-sm" style="margin-top:6px">
          <option value="info">info</option><option value="warn">warn</option><option value="error">error</option>
        </select>`;
    } else if (cmd === 'execute_piston') {
      el.innerHTML = `
        <div class="wiz-row-label">Piston to execute</div>
        <select id="wiz-ep-target" class="wiz-select-blue wiz-select-full">
          <option value="">Select piston...</option>
          ${(App.state.pistons||[]).map(p=>`<option value="${_esc(p.id)}" ${_sel.target_piston_id===p.id?'selected':''}>${_esc(p.name)}</option>`).join('')}
        </select>`;
    } else if (cmd === 'send_notification') {
      el.innerHTML = `
        <div class="wiz-row-label">Message</div>
        <textarea id="wiz-notif-msg" class="wiz-expr-area">${_esc(_sel.message||'')}</textarea>
        <div class="wiz-row-label" style="margin-top:8px">Title (optional)</div>
        <input type="text" id="wiz-notif-title" class="wiz-value-input" value="${_esc(_sel.title||'')}" />`;
    } else if (cmd === 'http_request') {
      el.innerHTML = `
        <div class="wiz-row-label">URL</div>
        <input type="text" id="wiz-http-url" class="wiz-value-input" placeholder="https://..." value="${_esc(_sel.http_url||'')}" />
        <div class="wiz-row-label" style="margin-top:8px">Method</div>
        <select id="wiz-http-method" class="wiz-select-blue-sm">
          <option value="GET" ${(_sel.http_method||'GET')==='GET'?'selected':''}>GET</option>
          <option value="POST" ${(_sel.http_method||'')==='POST'?'selected':''}>POST</option>
          <option value="PUT" ${(_sel.http_method||'')==='PUT'?'selected':''}>PUT</option>
          <option value="DELETE" ${(_sel.http_method||'')==='DELETE'?'selected':''}>DELETE</option>
        </select>
        <div class="wiz-row-label" style="margin-top:8px">Body (optional, JSON)</div>
        <textarea id="wiz-http-body" class="wiz-expr-area" placeholder="{}">${_esc(_sel.http_body||'')}</textarea>`;
    } else if (cmd === 'set_mode') {
      el.innerHTML = `
        <div class="wiz-row-label">Mode name</div>
        <input type="text" id="wiz-setmode-val" class="wiz-value-input" placeholder="Mode name..." value="${_esc(_sel.mode_value||'')}" />`;
    } else if (cmd === 'raise_event') {
      el.innerHTML = `
        <div class="wiz-row-label">Event name</div>
        <input type="text" id="wiz-event-name" class="wiz-value-input" placeholder="Event name..." value="${_esc(_sel.event_name||'')}" />
        <div class="wiz-row-label" style="margin-top:8px">Event data (optional, JSON)</div>
        <textarea id="wiz-event-data" class="wiz-expr-area" placeholder="{}">${_esc(_sel.event_data||'')}</textarea>`;
    }
  }

  function _saveLocationCmd(addMore) {
    const cmd = _sel.location_cmd;
    if (!cmd) return;
    let node;
    if (cmd === 'set_variable') {
      const svValType = document.getElementById('wiz-sv-valtype')?.value || 'expression';
      const svRaw     = document.getElementById('wiz-sv-expr')?.value || '';
      const svValue   = svValType === 'value'
        ? { type: 'literal',    data: svRaw }
        : svValType === 'variable'
        ? { type: 'variable',   name: svRaw }
        : { type: 'expression', expression: svRaw };
      node = { type:'set_variable', id:_editNode?.id||_newId(),
        variable: document.getElementById('wiz-sv-name')?.value||'',
        value:    svValue,
        description: null, disabled: false };
    } else if (cmd === 'wait') {
      node = { type:'wait', id:_editNode?.id||_newId(), wait_type:'duration',
        duration: parseInt(document.getElementById('wiz-wait-n')?.value||'1'),
        duration_unit: document.getElementById('wiz-wait-u')?.value||'minutes',
        description: null, disabled: false };
    } else if (cmd === 'log') {
      node = { type:'log_message', id:_editNode?.id||_newId(),
        message: { type:'literal', data: document.getElementById('wiz-log-msg')?.value||'' },
        level:   document.getElementById('wiz-log-lvl')?.value||'info',
        description: null, disabled: false };
    } else if (cmd === 'execute_piston') {
      node = { type:'call_piston', id:_editNode?.id||_newId(),
        target_piston_id: document.getElementById('wiz-ep-target')?.value||'',
        target_piston_name: document.getElementById('wiz-ep-target')?.value||'',
        description: null, disabled: false };
    } else if (cmd === 'send_notification') {
      node = { type:'action', id:_editNode?.id||_newId(),
        devices: ['Location'],
        tasks: [{ id: _taskId(), command:'persistent_notification.create', domain:'notify',
          ha_service:'persistent_notification.create',
          parameters:{ message: document.getElementById('wiz-notif-msg')?.value||'',
                       title:   document.getElementById('wiz-notif-title')?.value||'' },
          description: null }],
        description: null, disabled: false };
    } else if (cmd === 'http_request') {
      node = { type:'action', id:_editNode?.id||_newId(),
        devices: ['Location'],
        tasks: [{ id: _taskId(), command:'http_request', domain:'location', ha_service:'location.http_request',
          parameters:{
            url:    document.getElementById('wiz-http-url')?.value||'',
            method: document.getElementById('wiz-http-method')?.value||'GET',
            body:   document.getElementById('wiz-http-body')?.value||'',
          }, description: null }],
        description: null, disabled: false };
    } else if (cmd === 'set_mode') {
      node = { type:'action', id:_editNode?.id||_newId(),
        devices: ['Location'],
        tasks: [{ id: _taskId(), command:'set_mode', domain:'location', ha_service:'location.set_mode',
          parameters:{ mode: document.getElementById('wiz-setmode-val')?.value||'' },
          description: null }],
        description: null, disabled: false };
    } else if (cmd === 'raise_event') {
      node = { type:'action', id:_editNode?.id||_newId(),
        devices: ['Location'],
        tasks: [{ id: _taskId(), command:'raise_event', domain:'location', ha_service:'location.raise_event',
          parameters:{
            event_type: document.getElementById('wiz-event-name')?.value||'',
            event_data: document.getElementById('wiz-event-data')?.value||'',
          }, description: null }],
        description: null, disabled: false };
    } else {
      node = { type:'action', id:_editNode?.id||_newId(),
        devices: ['Location'],
        tasks: [{ id: _taskId(), command: cmd, domain:'location', ha_service:`location.${cmd}`, parameters:{}, description: null }],
        description: null, disabled: false };
    }

    Editor.insertStatement(_context, node);

    if (addMore) {
      // Reset for another location task
      _sel.location_cmd = '';
      _sel.variable = ''; _sel.value = ''; _sel.message = '';
      _editNode = null;
      _goLocationCmdPicker();
    } else {
      close();
    }
  }

  // ── PHYSICAL DEVICE COMMAND PICKER ────────────────────────
  async function _goCommandPicker() {
    _step = 'cmd';
    _pushStep(_goCommandPicker);
    const label = _sel.device_label || _sel.device_id || 'device';
    const isNew = !_editNode;
    _render(
      'Add a new task',
      `<div class="wiz-with-row"><span class="wiz-with-label">With...</span><span class="wiz-with-device">{${_esc(label)}}</span></div>
       <div class="wiz-do-label">Do...</div>
       <select id="wiz-cmd" class="wiz-select-blue wiz-select-full">
         <option value="">Please select a command</option>
       </select>
       <div id="wiz-cmd-params"></div>`,
      `<div class="wiz-footer-left">
         <button class="btn btn-ghost btn-sm" id="wiz-cmd-back">← Back</button>
         ${!isNew?`<button class="btn btn-danger btn-sm" id="wiz-cmd-del">Delete</button>`:''}
       </div>
       <div class="wiz-footer-right">
         <button class="btn btn-ghost btn-sm" id="wiz-cmd-cog">⚙</button>
         ${isNew ? `<button class="btn btn-primary btn-sm" id="wiz-cmd-addmore" disabled>Add more</button>` : ''}
         <button class="btn btn-primary btn-sm" id="wiz-cmd-save" disabled>${isNew ? 'Add' : 'Save'}</button>
       </div>`
    );

    document.getElementById('wiz-cmd-back')?.addEventListener('click', _goActionDevicePicker);
    document.getElementById('wiz-cmd-del')?.addEventListener('click', _deleteEditNode);
    document.getElementById('wiz-cmd-save')?.addEventListener('click', () => _saveDeviceCmd(false));
    document.getElementById('wiz-cmd-addmore')?.addEventListener('click', () => _saveDeviceCmd(true));

    const demo = DEMO_DEVICES.find(d => d.entity_id === _sel.device_id);
    if (demo) {
      const sel = document.getElementById('wiz-cmd');
      if (sel) {
        sel.innerHTML = `<option value="">Please select a command</option>` +
          demo.services.map(s => `<option value="${_esc(s)}" ${_sel.command===s?'selected':''}>${_esc(s.replace(/_/g,' '))}</option>`).join('');
        if (_sel.command) {
          document.getElementById('wiz-cmd-save')?.removeAttribute('disabled');
          document.getElementById('wiz-cmd-addmore')?.removeAttribute('disabled');
        }
        sel.addEventListener('change', e => {
          _sel.command = e.target.value;
          const ok = !!e.target.value;
          document.getElementById('wiz-cmd-save')?.toggleAttribute('disabled', !ok);
          document.getElementById('wiz-cmd-addmore')?.toggleAttribute('disabled', !ok);
        });
      }
      return;
    }

    try {
      const data = await API.getServices(_sel.device_id);
      const services = data.services || [];
      const sel = document.getElementById('wiz-cmd');
      if (sel) {
        if (services.length) {
          sel.innerHTML = `<option value="">Please select a command</option>` +
            services.map(s=>`<option value="${_esc(s.service)}" ${_sel.command===s.service?'selected':''}>${_esc(s.label||s.service)}</option>`).join('');
        } else {
          sel.innerHTML = `<option value="">Please select a command</option>` +
            ['turn_on','turn_off','toggle'].map(c=>`<option value="${_esc(c)}" ${_sel.command===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('');
        }
        if (_sel.command) {
          _renderCmdParams(_sel.command, services);
          document.getElementById('wiz-cmd-save')?.removeAttribute('disabled');
          document.getElementById('wiz-cmd-addmore')?.removeAttribute('disabled');
        }
        sel.addEventListener('change', e => {
          _sel.command = e.target.value;
          _renderCmdParams(e.target.value, services);
          const ok = !!e.target.value;
          document.getElementById('wiz-cmd-save')?.toggleAttribute('disabled', !ok);
          document.getElementById('wiz-cmd-addmore')?.toggleAttribute('disabled', !ok);
        });
      }
    } catch(e) {
      const el = document.getElementById('wiz-cmd-params');
      if (el) el.innerHTML = `<div class="wiz-error">Could not load device commands.<br><small>${_esc(e.message)}</small></div>`;
    }
  }

  function _renderCmdParams(service, services) {
    const el = document.getElementById('wiz-cmd-params');
    if (!el) return;
    const svc = services.find(s=>s.service===service);
    if (!svc?.fields || !Object.keys(svc.fields).length) { el.innerHTML=''; return; }
    el.innerHTML = Object.entries(svc.fields).map(([key,field])=>`
      <div class="wiz-param-section">
        <div class="wiz-row-label">${_esc(field.name||key)}</div>
        ${field.selector?.number
          ? `<input type="number" class="wiz-value-input" data-param="${_esc(key)}" min="${field.selector.number.min??''}" max="${field.selector.number.max??''}" value="${_sel.parameters?.[key]??field.selector.number.min??0}" />`
          : field.selector?.select
          ? `<select class="wiz-select-blue-sm" data-param="${_esc(key)}">${field.selector.select.options.map(o=>`<option value="${_esc(o.value)}" ${_sel.parameters?.[key]===o.value?'selected':''}>${_esc(o.label)}</option>`).join('')}</select>`
          : `<input type="text" class="wiz-value-input" data-param="${_esc(key)}" value="${_esc(String(_sel.parameters?.[key]??''))}" placeholder="${_esc(field.description||'')}" />`
        }
      </div>`).join('');
  }

  function _saveDeviceCmd(addMore) {
    const command = document.getElementById('wiz-cmd')?.value || _sel.command;
    if (!command) return;
    const params = {};
    document.querySelectorAll('[data-param]').forEach(el => { params[el.dataset.param] = el.value; });

    const firstDeviceId = (_sel.devices || [])[0] || _sel.device_id || '';
    const domain = firstDeviceId.includes('.') ? firstDeviceId.split('.')[0] : (firstDeviceId || 'homeassistant');

    let deviceLabels;
    if ((_sel.devices || []).length <= 1) {
      deviceLabels = [_sel.device_label || _sel.device_id || ''];
    } else {
      const labelMap = {};
      document.querySelectorAll('#wiz-act-devlist .wiz-device-row').forEach(row => {
        if (row.dataset.id && row.dataset.label) labelMap[row.dataset.id] = row.dataset.label;
      });
      deviceLabels = (_sel.devices || []).map(id => labelMap[id] || id);
    }

    // Build the task
    const newTask = {
      id: _taskId(),
      command: command,
      domain: domain,
      ha_service: domain + '.' + command,
      parameters: params,
      description: null,
    };

    if (_editNode && _editNode.type === 'action') {
      // Editing existing action — replace/update task in it
      const updatedNode = { ..._editNode };
      updatedNode.tasks = [newTask]; // single task edit for now
      Editor.insertStatement(_context, updatedNode,
        _extra['block-id'] ? { blockId: _extra['block-id'], branch: _extra['branch'] || 'then' } : undefined);
    } else {
      // New action node
      Editor.insertStatement(_context, {
        type: 'action', id: _editNode?.id || _newId(), async: false,
        devices: deviceLabels,
        tasks: [newTask],
        description: null, disabled: false,
      }, _extra['block-id'] ? { blockId: _extra['block-id'], branch: _extra['branch'] || 'then' } : undefined);
    }

    if (addMore) {
      // Keep same devices, reset command selection for another task
      _sel.command = '';
      _sel.parameters = {};
      _editNode = null;
      _goCommandPicker();
    } else {
      close();
    }
  }

  // ── VARIABLE PICKER ───────────────────────────────────────
  function _goVariablePicker() {
    _step = 'var';
    _pushStep(_goVariablePicker);
    const BASIC = ['Dynamic','String (text)','Boolean (true/false)','Number (integer)','Number (decimal)','Large number (long)','Date and Time','Date (date only)','Time (time only)','Device'];
    const ADV   = ['Dynamic list','String list (text)','Boolean list (true/false)','Number list (integer)','Number list (decimal)','Large number list (long)','Date and Time list','Date list (date only)','Time list (time only)'];
    const initType = _sel.initial_value_type || 'nothing';

    const warnIcon = initType !== 'nothing' ? '<span class="wiz-initval-warn">&#9650;</span>' : '';
    _render(
      'Add a new variable',
      `<div class="wiz-compare-row">
         <select id="wiz-vt" class="wiz-select-blue">
           <optgroup label="Basic">${BASIC.map(t=>`<option value="${_esc(t)}" ${_sel.var_type===t?'selected':''}>${_esc(t)}</option>`).join('')}</optgroup>
           <optgroup label="Advanced lists">${ADV.map(t=>`<option value="${_esc(t)}" ${_sel.var_type===t?'selected':''}>${_esc(t)}</option>`).join('')}</optgroup>
         </select>
         <input type="text" id="wiz-vname" class="wiz-value-input" placeholder="Variable name..." value="${_esc(_sel.name||'')}" />
       </div>

       <div class="wiz-row-label" style="margin-top:14px">Initial value (optional) ${warnIcon}</div>

       <div class="wiz-initval-combined-row">
         <select id="wiz-vinit-type" class="wiz-select-blue wiz-initval-type-sel">
           <option value="nothing"    ${initType==='nothing'   ?'selected':''}>Nothing selected</option>
           <option value="device"     ${initType==='device'    ?'selected':''}>Physical device(s)</option>
           <option value="value"      ${initType==='value'     ?'selected':''}>Value</option>
           <option value="variable"   ${initType==='variable'  ?'selected':''}>Variable</option>
           <option value="expression" ${initType==='expression'?'selected':''}>Expression</option>
           <option value="argument"   ${initType==='argument'  ?'selected':''}>Argument</option>
         </select>
         <div class="wiz-initval-right" id="wiz-vinit-sub">${_varInitSubHtml(initType)}</div>
       </div>

       <div class="wiz-var-initval-note">NOTE: By assigning an initial value to the variable, you are instructing the piston to initialize the variable on every run to that initial value. If you plan on storing data in this variable that needs to persist between piston runs, leave the value as <em>Nothing Selected</em>.</div>`,

      `<button class="btn btn-ghost btn-sm" id="wiz-var-cancel">Cancel</button>
       <div class="wiz-footer-right">
         <button class="btn btn-ghost btn-sm" id="wiz-var-cog">⚙</button>
         <button class="btn btn-primary btn-sm" id="wiz-var-add">Add more</button>
         <button class="btn btn-primary btn-sm" id="wiz-var-done">${_editNode ? 'Save' : 'Add'}</button>
       </div>`
    );

    document.getElementById('wiz-var-cancel')?.addEventListener('click', close);

    document.getElementById('wiz-vinit-type')?.addEventListener('change', e => {
      _sel.initial_value_type = e.target.value;
      _sel.initial_value = '';
      _sel.var_type = document.getElementById('wiz-vt')?.value || _sel.var_type;
      _sel.name     = document.getElementById('wiz-vname')?.value || _sel.name;
      const sub = document.getElementById('wiz-vinit-sub');
      if (sub) sub.innerHTML = _varInitSubHtml(e.target.value);
      _wireVarInitSub(e.target.value);
    });
    _wireVarInitSub(initType);

    const VAR_TYPE_MAP = {
      'Dynamic':'dynamic','String (text)':'string','Boolean (true/false)':'boolean',
      'Number (integer)':'integer','Number (decimal)':'decimal','Large number (long)':'long',
      'Date and Time':'datetime','Date (date only)':'date','Time (time only)':'time','Device':'device',
      'Dynamic list':'dynamic_list','String list (text)':'string_list','Boolean list (true/false)':'boolean_list',
      'Number list (integer)':'integer_list','Number list (decimal)':'decimal_list',
      'Large number list (long)':'long_list','Date and Time list':'datetime_list',
      'Date list (date only)':'date_list','Time list (time only)':'time_list',
    };
    const save = () => {
      const name = document.getElementById('wiz-vname')?.value.trim();
      if (!name) { document.getElementById('wiz-vname')?.focus(); return null; }
      const ivType = document.getElementById('wiz-vinit-type')?.value || 'nothing';
      let initial_value;
      if (ivType === 'nothing') {
        initial_value = undefined;
      } else if (ivType === 'device') {
        initial_value = _sel.initial_device_label || _sel.initial_device_id || '';
      } else if (ivType === 'variable') {
        initial_value = _sel.initial_variable || '';
      } else {
        initial_value = document.getElementById('wiz-vinit-val')?.value || '';
      }
      const rawType = document.getElementById('wiz-vt')?.value || 'Dynamic';
      return { type:'variable', id:_editNode?.id||_newId(), name,
        var_type: VAR_TYPE_MAP[rawType] || rawType.toLowerCase(),
        initial_value_type: ivType === 'nothing' ? undefined : ivType,
        initial_value };
    };

    document.getElementById('wiz-var-done')?.addEventListener('click', () => {
      const n = save(); if (!n) return;
      close();
      Editor.insertStatement('variable', n);
    });
    document.getElementById('wiz-var-add')?.addEventListener('click', () => {
      const n = save(); if (!n) return;
      Editor.insertStatement('variable', n);
      _sel = {}; _editNode = null;
      _goVariablePicker();
    });
  }

  function _varInitSubHtml(type) {
    if (type === 'nothing') return `<span class="wiz-initval-placeholder">(no value set)</span>`;
    if (type === 'device') {
      return `<button class="wiz-device-pick-btn ${_sel.initial_device_id?'has-value':''}" id="wiz-vinit-devbtn">
        ${_sel.initial_device_id
          ? `<span class="wiz-device-tag">device</span> ${_esc(_sel.initial_device_label||_sel.initial_device_id)}`
          : 'Select device...'}
      </button>`;
    }
    if (type === 'variable') {
      const vars = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
      return `<select id="wiz-vinit-varsel" class="wiz-select-blue" style="flex:1">
        <option value="">Select variable...</option>
        ${vars.map(v=>`<option value="${_esc(v.name)}" ${_sel.initial_variable===v.name?'selected':''}>${_esc(v.name)}</option>`).join('')}
      </select>`;
    }
    const ph = type === 'expression' ? 'Expression...' : type === 'argument' ? 'Argument...' : 'Value...';
    return `<input type="text" id="wiz-vinit-val" class="wiz-value-input" style="flex:1" placeholder="${ph}" value="${_esc(_sel.initial_value||'')}" />`;
  }

  function _wireVarInitSub(type) {
    if (type === 'device') {
      document.getElementById('wiz-vinit-devbtn')?.addEventListener('click', () => {
        _goVarInitDevicePicker();
      });
    }
    if (type === 'variable') {
      document.getElementById('wiz-vinit-varsel')?.addEventListener('change', e => {
        _sel.initial_variable = e.target.value;
      });
    }
  }

  // ── VAR INIT DEVICE PICKER ────────────────────────────────
  function _goVarInitDevicePicker() {
    _step = 'varinit_dev';
    _pushStep(_goVarInitDevicePicker);

    const pistonDevVars = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
      .filter(v => v.var_type === 'device');

    _render('Select a device',
      `<div class="wiz-search-row" style="margin:8px 0 4px;border:1px solid var(--border-subtle);border-radius:4px;padding:4px 8px;background:var(--bg-raised)">
         <input type="text" id="wiz-varinit-search" placeholder="Search devices..." autocomplete="off" style="width:100%;background:transparent;border:none;color:var(--text-primary);font-size:13px;outline:none;padding:2px 0" />
       </div>
       <div class="wiz-device-list" id="wiz-varinit-devlist" style="max-height:320px;overflow-y:auto"></div>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-varinit-back">← Back</button>`
    );

    document.getElementById('wiz-varinit-back')?.addEventListener('click', () => {
      _sel.var_type = document.getElementById('wiz-vt')?.value || _sel.var_type;
      _sel.name     = document.getElementById('wiz-vname')?.value || _sel.name;
      _goVariablePicker();
    });

    const render = (q) => {
      const el = document.getElementById('wiz-varinit-devlist');
      if (!el) return;
      const lq = (q||'').toLowerCase();
      const physical = _filterDevices(_deviceData).filter(d =>
        !lq || d.friendly_name.toLowerCase().includes(lq) || d.entity_id.toLowerCase().includes(lq)
      );
      let html = '';
      if (pistonDevVars.length) {
        html += `<div class="wiz-device-group-header">Piston variables</div>`;
        html += pistonDevVars.filter(v => !lq || v.name.toLowerCase().includes(lq)).map(v =>
          `<div class="wiz-device-row wiz-varinit-row ${_sel.initial_device_id===v.name?'selected':''}"
            data-id="${_esc(v.name)}" data-label="${_esc(v.name)}">
            <span class="wiz-dev-prefix">device</span>
            <span class="wiz-dev-label">${_esc(v.name)}</span>
          </div>`
        ).join('');
      }
      if (physical.length) {
        html += `<div class="wiz-device-group-header">Physical devices</div>`;
        html += physical.slice(0, 150).map(d =>
          `<div class="wiz-device-row wiz-varinit-row ${_sel.initial_device_id===d.entity_id?'selected':''}"
            data-id="${_esc(d.entity_id)}" data-label="${_esc(d.friendly_name)}">
            <span class="wiz-dev-label">${_esc(d.friendly_name)}</span>
            <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${_esc(d.entity_id)}</span>
          </div>`
        ).join('');
      }
      el.innerHTML = html || `<div class="wiz-empty">No devices found.</div>`;
      el.querySelectorAll('.wiz-varinit-row').forEach(row => {
        row.addEventListener('click', () => {
          _sel.initial_device_id    = row.dataset.id;
          _sel.initial_device_label = row.dataset.label;
          _sel.initial_value_type   = 'device';
          _sel.var_type = document.getElementById('wiz-vt')?.value || _sel.var_type;
          _sel.name     = document.getElementById('wiz-vname')?.value || _sel.name;
          _goVariablePicker();
        });
      });
    };

    if (!_deviceData) {
      API.getDevices().then(data => { _deviceData = data; render(''); }).catch(() => render(''));
    } else {
      render('');
    }

    let ft = null;
    document.getElementById('wiz-varinit-search')?.addEventListener('input', e => {
      clearTimeout(ft);
      ft = setTimeout(() => render(e.target.value.trim()), 150);
    });
  }

  // ── TIMER PICKER ──────────────────────────────────────────
  function _goTimerPicker() {
    _step = 'timer';
    _pushStep(_goTimerPicker);
    const isNew = !_editNode;
    _render('Add a timer',
      `<div class="wiz-desc">A timer will trigger execution of the piston at set time intervals.</div>
       <div class="wiz-row-label">Every...</div>
       <div class="wiz-duration-inputs">
         <input type="number" id="wiz-timer-n" class="wiz-dur-number" value="${_sel.interval||5}" min="1" />
         <select id="wiz-timer-u" class="wiz-select-blue-sm">
           <option value="milliseconds" ${(_sel.interval_unit||'')==='milliseconds'?'selected':''}>milliseconds</option>
           <option value="seconds"      ${(_sel.interval_unit||'')==='seconds'     ?'selected':''}>seconds</option>
           <option value="minutes"      ${(_sel.interval_unit||'minutes')==='minutes'?'selected':''}>minutes</option>
           <option value="hours"        ${(_sel.interval_unit||'')==='hours'       ?'selected':''}>hours</option>
           <option value="days"         ${(_sel.interval_unit||'')==='days'        ?'selected':''}>days</option>
           <option value="weeks"        ${(_sel.interval_unit||'')==='weeks'       ?'selected':''}>weeks</option>
           <option value="months"       ${(_sel.interval_unit||'')==='months'      ?'selected':''}>months</option>
           <option value="years"        ${(_sel.interval_unit||'')==='years'       ?'selected':''}>years</option>
         </select>
       </div>`,
      `<button class="btn btn-ghost btn-sm" id="wiz-timer-back">← Back</button>
       <div class="wiz-footer-right"><button class="btn btn-primary btn-sm" id="wiz-timer-save">${isNew ? 'Add a statement' : 'Save'}</button></div>`
    );
    document.getElementById('wiz-timer-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);
    document.getElementById('wiz-timer-save')?.addEventListener('click', () => {
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      const node = {
        type:'every', id:_editNode?.id || _newId(), async:false,
        interval: parseInt(document.getElementById('wiz-timer-n')?.value||'5'),
        interval_unit: document.getElementById('wiz-timer-u')?.value||'minutes',
        at_minute:null, at_time:null,
        only_on_days:[], only_on_dom:[], only_on_months:[],
        statements:[],
        description:null, disabled:false,
      };
      close();
      Editor.insertStatement(_context, node, meta);
    });
  }

  // ── REPEAT PICKER — removed (WebCoRE repeat has no config) ─
  // repeat inserts directly from _handleStatementType now

  function _goForEachPicker() {
    _step = 'for_each';
    _pushStep(_goForEachPicker);
    const pistonDevVars = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
      .filter(v => v.var_type === 'device');
    const varOptions = pistonDevVars.map(v =>
      `<option value="${_esc(v.name)}" ${(_sel.variable||'$device')===v.name?'selected':''}>${_esc(v.name)}</option>`
    ).join('');
    const isNew = !_editNode;

    _render('Add a for each loop',
      `<div class="wiz-desc">Executes the same statements for each device in a device list.</div>
       <div class="wiz-row-label">Store current device in variable</div>
       <div class="wiz-value-inputs">
         <select id="wiz-fe-var" class="wiz-select-blue" style="flex:1">
           <option value="$device" ${(_sel.variable||'$device')==='$device'?'selected':''}>$device (system default)</option>
           ${varOptions}
           <option value="__custom__">Type a name...</option>
         </select>
         <input type="text" id="wiz-fe-var-custom" class="wiz-value-input" placeholder="Variable name..." style="display:none;flex:1" value="${_esc(_sel.variable||'')}" />
       </div>
       <div class="wiz-row-label" style="margin-top:10px">For each device in (role name)</div>
       <input type="text" id="wiz-fe-list" class="wiz-value-input" placeholder="Device list role or variable name..." value="${_esc(_sel.list_role||'')}" />`,
      `<button class="btn btn-ghost btn-sm" id="wiz-fe-back">← Back</button>
       <div class="wiz-footer-right"><button class="btn btn-primary btn-sm" id="wiz-fe-save">${isNew ? 'Add a statement' : 'Save'}</button></div>`
    );
    document.getElementById('wiz-fe-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);
    document.getElementById('wiz-fe-var')?.addEventListener('change', e => {
      const custom = document.getElementById('wiz-fe-var-custom');
      if (custom) custom.style.display = e.target.value === '__custom__' ? '' : 'none';
    });
    document.getElementById('wiz-fe-save')?.addEventListener('click', () => {
      const varSel = document.getElementById('wiz-fe-var')?.value || '$device';
      const varCustom = document.getElementById('wiz-fe-var-custom')?.value || '';
      const variable = varSel === '__custom__' ? varCustom : varSel;
      const blockId = _extra?.['block-id'];
      const branch  = _extra?.['branch'] || 'then';
      const meta = blockId ? { blockId, branch } : undefined;
      const node = {
        type:'for_each', id:_editNode?.id || _newId(), async:false,
        variable: variable || '$device',
        list_role: document.getElementById('wiz-fe-list')?.value||'',
        statements:[],
        description:null, disabled:false,
      };
      close();
      Editor.insertStatement(_context, node, meta);
    });
  }

  // ── DELETE ────────────────────────────────────────────────
  function _deleteEditNode() {
    if (!_editNode?.id) return;
    App.confirm({ title:'Delete statement', message:'Delete this statement? This cannot be undone.',
      confirmLabel:'Delete', danger:true,
      onConfirm: () => { Editor.deleteStatement(_editNode.id); close(); }
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

  function _esc(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { open, close };

})();
