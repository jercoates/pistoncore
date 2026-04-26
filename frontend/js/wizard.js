// pistoncore/frontend/js/wizard.js
//
// The Wizard Modal — WebCoRE-style statement builder.
// Centered modal ~580px wide. NOT full-screen. NOT card grids (except statement type picker).
// Opens when user clicks any ghost text insertion point or edits an existing statement.
//
// FLOWS:
//   Condition/Trigger: Condition-vs-Group → What-to-compare (all on one screen) → done
//   Action: Statement type picker (cards) → Device picker → Command picker → done
//   Variable: Type + name on one screen → done

const Wizard = (() => {

  // ── State ─────────────────────────────────────────────────
  let _context = null;   // 'trigger_or_condition' | 'condition' | 'action' | 'variable' | 'global' | etc.
  let _editNode = null;  // existing node being edited, or null for new
  let _extra = {};       // extra data from ghost text (block-id, branch, etc.)
  let _step = null;      // current step name
  let _sel = {};         // user selections built up through wizard steps
  let _deviceCache = null;
  let _globalsCache = null;

  // ── Operators ─────────────────────────────────────────────
  const CONDITIONS = [
    'is', 'is any of', 'is not', 'is not any of',
    'is between', 'is not between',
    'is even', 'is odd',
    'was', 'was any of', 'was not', 'was not any of',
    'changed', 'did not change',
    'is equal to', 'is not equal to',
    'is less than', 'is less than or equal to',
    'is greater than', 'is greater than or equal to',
  ];

  const TRIGGERS = [
    'changes', 'changes to', 'changes to any of',
    'changes away from', 'changes away from any of',
    'drops', 'drops below', 'drops to or below',
    'rises', 'rises above', 'rises to or above',
    'stays', 'stays equal to', 'stays any of',
    'stays away from', 'stays away from any of', 'stays unchanged',
    'gets', 'gets any', 'receives',
    'happens daily at',
    'event occurs',
    'is any and stays any of', 'is away and stays away from',
  ];

  // Operators that need a value input
  const NEEDS_VALUE = new Set([
    'is','is any of','is not','is not any of',
    'is between','is not between',
    'was','was any of','was not','was not any of',
    'is equal to','is not equal to',
    'is less than','is less than or equal to',
    'is greater than','is greater than or equal to',
    'changes to','changes to any of',
    'changes away from','changes away from any of',
    'drops below','drops to or below','rises above','rises to or above',
    'stays','stays equal to','stays any of',
    'stays away from','stays away from any of',
    'gets','receives',
    'happens daily at',
    'is any and stays any of','is away and stays away from',
  ]);

  // Operators that need a duration input (in the last / for the next)
  const NEEDS_DURATION = new Set([
    'changed','did not change',
    'was','was any of','was not','was not any of',
    'stays','stays equal to','stays any of',
    'stays away from','stays away from any of','stays unchanged',
    'is any and stays any of','is away and stays away from',
  ]);

  // Operators that need TWO values (between)
  const NEEDS_TWO_VALUES = new Set(['is between','is not between']);

  // Duration label: stays = "for the next", was/changed = "in the last"
  const durationLabel = (op) =>
    op && op.startsWith('stays') ? 'For the next...' : 'In the last...';

  // Is this operator a trigger?
  const isTrigger = (op) => TRIGGERS.includes(op);

  // ── Binary device class labels ────────────────────────────
  const BINARY_LABELS = {
    door:           { on:'Open',      off:'Closed'       },
    window:         { on:'Open',      off:'Closed'       },
    garage_door:    { on:'Open',      off:'Closed'       },
    motion:         { on:'Active',    off:'Inactive'     },
    occupancy:      { on:'Occupied',  off:'Clear'        },
    presence:       { on:'Present',   off:'Not Present'  },
    smoke:          { on:'Detected',  off:'Clear'        },
    moisture:       { on:'Wet',       off:'Dry'          },
    lock:           { on:'Unlocked',  off:'Locked'       },
    contact:        { on:'Open',      off:'Closed'       },
    battery:        { on:'Low',       off:'Normal'       },
    connectivity:   { on:'Connected', off:'Disconnected' },
    plug:           { on:'On',        off:'Off'          },
    light:          { on:'Light',     off:'Dark'         },
    problem:        { on:'Problem',   off:'OK'           },
    tamper:         { on:'Tampered',  off:'Clear'        },
    moving:         { on:'Moving',    off:'Stopped'      },
    running:        { on:'Running',   off:'Not Running'  },
  };

  // Virtual devices always shown at top of device picker
  const VIRTUAL_DEVICES = [
    { entity_id: '__location__', friendly_name: 'Location', group: 'Virtual devices' },
    { entity_id: '__time__',     friendly_name: 'Time',     group: 'Virtual devices' },
    { entity_id: '__date__',     friendly_name: 'Date',     group: 'Virtual devices' },
    { entity_id: '__mode__',     friendly_name: 'Mode',     group: 'Virtual devices' },
    { entity_id: '__system__',   friendly_name: 'System Start', group: 'Virtual devices' },
  ];

  // System variables shown at bottom of device picker
  const SYSTEM_VARS = [
    { name: '$currentEventDevice', label: '$currentEventDevice' },
    { name: '$previousEventDevice', label: '$previousEventDevice' },
    { name: '$device',  label: '$device' },
    { name: '$devices', label: '$devices' },
    { name: '$location',label: '$location' },
  ];

  // Location commands
  const LOCATION_COMMANDS = [
    { id: 'set_variable',      label: 'Set variable...' },
    { id: 'execute_piston',    label: 'Execute piston...' },
    { id: 'wait',              label: 'Wait...' },
    { id: 'send_notification', label: 'Send push notification...' },
    { id: 'log',               label: 'Log to console...' },
    { id: 'http_request',      label: 'Make an HTTP request...' },
    { id: 'set_mode',          label: 'Set HA mode...' },
    { id: 'raise_event',       label: 'Raise an event...' },
    { id: 'send_email',        label: 'Send email...' },
  ];

  // Statement type cards for action picker
  const STATEMENT_TYPES = {
    basic: [
      { type: 'if_block',    label: 'If Block',    icon: '⟨/⟩', desc: 'Execute different actions depending on conditions',    btn: 'Add an if',         btnClass: 'btn-primary' },
      { type: 'action',      label: 'Action',      icon: '⟨/⟩', desc: 'Control devices and execute tasks',                    btn: 'Add an action',     btnClass: 'btn-green' },
      { type: 'timer',       label: 'Timer',       icon: '⟨/⟩', desc: 'Trigger execution at set time intervals',              btn: 'Add a timer',       btnClass: 'btn-orange' },
    ],
    advanced: [
      { type: 'switch',      label: 'Switch',      icon: '⟨/⟩', desc: 'Compare an operand against a set of values',           btn: 'Add a switch',      btnClass: 'btn-primary' },
      { type: 'do_block',    label: 'Do Block',    icon: '⟨/⟩', desc: 'Organize several statements into a single block',      btn: 'Add a do block',    btnClass: 'btn-green' },
      { type: 'on_event',    label: 'On Event',    icon: '⟨/⟩', desc: 'Execute statements only when certain events happen',   btn: 'Add an on event',   btnClass: 'btn-orange' },
    ],
    loops: [
      { type: 'for_loop',    label: 'For Loop',    icon: '⟨/⟩', desc: 'Execute the same statements for a set number of cycles', btn: 'Add a for loop',    btnClass: 'btn-orange' },
      { type: 'for_each',    label: 'For Each Loop',icon:'⟨/⟩', desc: 'Execute the same statements for each device in a list', btn: 'Add a for each loop',btnClass:'btn-orange' },
      { type: 'while_loop',  label: 'While Loop',  icon: '⟨/⟩', desc: 'Execute statements as long as a condition is met',     btn: 'Add a while loop',  btnClass: 'btn-orange' },
      { type: 'repeat_loop', label: 'Repeat Loop', icon: '⟨/⟩', desc: 'Execute the same statements until a condition is met', btn: 'Add a repeat loop', btnClass: 'btn-orange' },
      { type: 'break',       label: 'Break',       icon: '⟨/⟩', desc: 'Interrupt the inner most loop',                        btn: 'Add a break',       btnClass: 'btn-red' },
      { type: 'exit',        label: 'Exit',        icon: '⟨/⟩', desc: 'Interrupt piston execution and exit immediately',      btn: 'Add an exit',       btnClass: 'btn-red' },
    ],
  };

  // ── Open ──────────────────────────────────────────────────
  function open(context, editNode, extra) {
    _context = context;
    _editNode = editNode || null;
    _extra = extra || {};
    _step = null;
    _sel = {};

    // Pre-populate from editNode if editing
    if (_editNode) {
      _sel = { ..._editNode };
    }

    _showBackdrop();
    _routeToFirstStep();
  }

  function close() {
    const bd = document.getElementById('wizard-backdrop');
    if (bd) bd.style.display = 'none';
    _context = null;
    _editNode = null;
    _sel = {};
  }

  // ── Routing ───────────────────────────────────────────────
  function _routeToFirstStep() {
    const ctx = _context;

    if (ctx === 'trigger_or_condition' || ctx === 'condition' || ctx === 'restriction') {
      _stepConditionOrGroup();
    } else if (ctx === 'action' || ctx === 'if_condition') {
      _stepStatementTypePicker();
    } else if (ctx === 'variable') {
      _stepVariablePicker();
    } else if (ctx === 'global') {
      _stepGlobalPicker();
    } else if (ctx === 'task') {
      // Adding a task inside a with block — go straight to device picker
      _stepDevicePicker('task');
    } else {
      _stepStatementTypePicker();
    }
  }

  // ── Backdrop / Modal shell ────────────────────────────────
  function _showBackdrop() {
    const bd = document.getElementById('wizard-backdrop');
    if (bd) bd.style.display = 'flex';
  }

  function _renderModal(title, bodyHtml, footerHtml) {
    const modal = document.getElementById('wizard-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="wiz-header">
        <div class="wiz-title">${_esc(title)}</div>
        <button class="wiz-x" id="wiz-close">✕</button>
      </div>
      <div class="wiz-body" id="wiz-body">
        ${bodyHtml}
      </div>
      <div class="wiz-footer" id="wiz-footer">
        ${footerHtml}
      </div>
    `;

    document.getElementById('wiz-close')?.addEventListener('click', close);

    // Backdrop click closes
    const bd = document.getElementById('wizard-backdrop');
    if (bd) {
      bd.onclick = (e) => { if (e.target === bd) close(); };
    }
  }

  // ── Standard footer builders ─────────────────────────────
  function _conditionFooter(backFn, addMoreFn, addFn, addEnabled = true) {
    return `
      <button class="btn btn-ghost btn-sm" id="wiz-back">${backFn ? '← Back' : 'Cancel'}</button>
      <div class="wiz-footer-right">
        <button class="btn btn-ghost btn-sm" id="wiz-cog" title="Advanced options">⚙</button>
        <button class="btn btn-primary btn-sm" id="wiz-add-more" ${addEnabled ? '' : 'disabled'}>Add more</button>
        <button class="btn btn-primary btn-sm" id="wiz-add" ${addEnabled ? '' : 'disabled'}>Add</button>
      </div>
    `;
  }

  function _taskFooter(showDelete = false) {
    return `
      <div class="wiz-footer-left">
        <button class="btn btn-ghost btn-sm" id="wiz-cancel-task">Cancel</button>
        ${showDelete ? `<button class="btn btn-danger btn-sm" id="wiz-delete">Delete</button>` : ''}
      </div>
      <div class="wiz-footer-right">
        <button class="btn btn-ghost btn-sm" id="wiz-cog" title="Advanced options">⚙</button>
        <button class="btn btn-primary btn-sm" id="wiz-save" disabled id="wiz-save">Save</button>
      </div>
    `;
  }

  function _wireConditionFooter(backFn, addMoreFn, addFn) {
    document.getElementById('wiz-back')?.addEventListener('click', backFn || close);
    document.getElementById('wiz-add-more')?.addEventListener('click', () => {
      if (addMoreFn) addMoreFn();
    });
    document.getElementById('wiz-add')?.addEventListener('click', () => {
      if (addFn) addFn();
    });
  }

  function _wireTaskFooter(cancelFn, saveFn, deleteFn) {
    document.getElementById('wiz-cancel-task')?.addEventListener('click', cancelFn || close);
    document.getElementById('wiz-save')?.addEventListener('click', () => { if (saveFn) saveFn(); });
    document.getElementById('wiz-delete')?.addEventListener('click', () => { if (deleteFn) deleteFn(); });
  }

  // ── STEP: Condition vs Group ──────────────────────────────
  function _stepConditionOrGroup() {
    _step = 'condition_or_group';
    _renderModal(
      'Add a new condition',
      `
        <div class="wiz-desc">An IF block is the simplest decisional block available. It allows you to execute different actions depending on conditions you set.</div>
        <div class="wiz-two-cards">
          <div class="wiz-card-option" id="wiz-pick-condition">
            <div class="wiz-card-option-title" style="color:var(--teal)">Condition</div>
            <div class="wiz-card-option-desc">A condition is a single comparison between two or more operands, the basic building block of a decisional statement</div>
            <button class="btn btn-primary btn-sm wiz-card-btn">Add a condition</button>
          </div>
          <div class="wiz-card-option" id="wiz-pick-group">
            <div class="wiz-card-option-title" style="color:var(--orange)">Group</div>
            <div class="wiz-card-option-desc">A group is a collection of conditions, with a logical operator between them, allowing for complex decisional statements</div>
            <button class="btn btn-orange btn-sm wiz-card-btn">Add a group</button>
          </div>
        </div>
      `,
      `<button class="btn btn-ghost btn-sm" id="wiz-cancel-cg">Cancel</button>`
    );

    document.getElementById('wiz-cancel-cg')?.addEventListener('click', close);
    document.getElementById('wiz-pick-condition')?.addEventListener('click', () => {
      _sel.statement_class = 'condition';
      _stepConditionBuilder();
    });
    document.getElementById('wiz-pick-group')?.addEventListener('click', () => {
      _sel.statement_class = 'group';
      _stepGroupBuilder();
    });
  }

  // ── STEP: Condition Builder (the main condition screen) ───
  // All on ONE screen: aggregation + device + attribute + operator + value + duration
  function _stepConditionBuilder() {
    _step = 'condition_builder';

    const aggValue = _sel.aggregation || 'any';
    const deviceLabel = _sel.device_label || '';
    const deviceId = _sel.device_id || '';
    const attribute = _sel.attribute || '';
    const operator = _sel.operator || '';
    const hasDevice = !!deviceId;
    const hasOperator = !!operator;
    const needsVal = hasOperator && NEEDS_VALUE.has(operator);
    const needsDur = hasOperator && NEEDS_DURATION.has(operator);
    const needsTwo = hasOperator && NEEDS_TWO_VALUES.has(operator);
    const isMultiDevice = (_sel.devices || []).length > 1;

    _renderModal(
      'Add a new condition',
      `
        <div class="wiz-desc">A condition allows for a single comparison to be made between two expressions.</div>

        <!-- Aggregation bar — only shown when multiple devices selected -->
        <div class="wiz-agg-bar ${isMultiDevice ? '' : 'hidden'}" id="wiz-agg-bar">
          <select id="wiz-agg" class="wiz-agg-select">
            <option value="any" ${aggValue==='any'?'selected':''}>Any of the selected devices</option>
            <option value="all" ${aggValue==='all'?'selected':''}>All of the selected devices</option>
            <option value="none" ${aggValue==='none'?'selected':''}>None of the selected devices</option>
          </select>
        </div>

        <!-- What to compare row -->
        <div class="wiz-row-label">What to compare <span class="wiz-required" id="wiz-compare-warn">⚠</span></div>
        <div class="wiz-compare-row">
          <div class="wiz-subject-type-wrap">
            <select id="wiz-subject-type" class="wiz-select-blue">
              <option value="device" ${(_sel.subject_type||'device')==='device'?'selected':''}>Physical device(s)</option>
              <option value="variable" ${_sel.subject_type==='variable'?'selected':''}>Variable</option>
              <option value="time" ${_sel.subject_type==='time'?'selected':''}>Time</option>
              <option value="date" ${_sel.subject_type==='date'?'selected':''}>Date</option>
              <option value="mode" ${_sel.subject_type==='mode'?'selected':''}>Mode</option>
            </select>
          </div>
          <button class="wiz-device-pick-btn ${deviceLabel ? 'has-value' : ''}" id="wiz-pick-device">
            ${deviceLabel ? `<span class="wiz-device-tag">device</span> ${_esc(deviceLabel)}` : 'Nothing selected'}
          </button>
          <button class="wiz-attr-pick-btn ${attribute ? 'has-value' : ''}" id="wiz-pick-attr">
            ${attribute ? _esc(attribute) : 'Nothing selected'}
          </button>
        </div>

        <!-- Which interaction row — shown for device subjects -->
        <div class="wiz-interaction-row ${hasDevice ? '' : 'hidden'}" id="wiz-interaction-row">
          <div class="wiz-row-label-inline">Which interaction</div>
          <select id="wiz-interaction" class="wiz-select-blue-sm">
            <option value="any">Any interaction</option>
            <option value="physical">Physical</option>
            <option value="programmatic">Programmatic</option>
          </select>
        </div>

        <!-- Operator row -->
        <div class="wiz-row-label">What kind of comparison?</div>
        <div class="wiz-operator-wrap">
          <select id="wiz-operator" class="wiz-select-blue wiz-select-full ${hasOperator ? 'has-value' : ''}">
            <option value="">Select a comparison...</option>
            <optgroup label="Conditions">
              ${CONDITIONS.map(op => `<option value="${_esc(op)}" ${operator===op?'selected':''}>${_esc(op)}</option>`).join('')}
            </optgroup>
            <optgroup label="Triggers">
              ${TRIGGERS.map(op => `<option value="${_esc(op)}" ${operator===op?'selected':''}>${_esc(op)}</option>`).join('')}
            </optgroup>
          </select>
        </div>

        <!-- Value row — shown when operator needs a value -->
        <div class="wiz-value-row ${needsVal ? '' : 'hidden'}" id="wiz-value-row">
          <div class="wiz-row-label">Value</div>
          <div class="wiz-value-inputs">
            <select id="wiz-value-type" class="wiz-select-blue-sm">
              <option value="value">Value</option>
              <option value="variable">Variable</option>
              <option value="expression">Expression</option>
            </select>
            <input type="text" id="wiz-value-1" class="wiz-value-input" placeholder="Value..." value="${_esc(_sel.value || '')}" />
            ${needsTwo ? `<span class="wiz-between-and">and</span><input type="text" id="wiz-value-2" class="wiz-value-input" placeholder="Value..." value="${_esc(_sel.value2 || '')}" />` : ''}
          </div>
        </div>

        <!-- Duration row — shown for stays/was/changed operators -->
        <div class="wiz-duration-row ${needsDur ? '' : 'hidden'}" id="wiz-duration-row">
          <div class="wiz-row-label" id="wiz-duration-label">${durationLabel(operator)}</div>
          <div class="wiz-duration-inputs">
            <select id="wiz-dur-type" class="wiz-select-blue-sm">
              <option value="value">Value</option>
              <option value="variable">Variable</option>
            </select>
            <input type="number" id="wiz-dur-amount" class="wiz-dur-number" value="${_esc(String(_sel.duration_amount || 1))}" min="1" />
            <select id="wiz-dur-unit" class="wiz-select-blue-sm">
              <option value="seconds" ${(_sel.duration_unit||'minutes')==='seconds'?'selected':''}>seconds</option>
              <option value="minutes" ${(_sel.duration_unit||'minutes')==='minutes'?'selected':''}>minutes</option>
              <option value="hours" ${(_sel.duration_unit||'minutes')==='hours'?'selected':''}>hours</option>
              <option value="days" ${(_sel.duration_unit||'minutes')==='days'?'selected':''}>days</option>
            </select>
          </div>
        </div>
      `,
      _conditionFooter(
        () => _stepConditionOrGroup(),
        () => _addConditionAndMore(),
        () => _addCondition(),
        hasDevice && hasOperator
      )
    );

    // Wire operator change → show/hide value/duration rows
    document.getElementById('wiz-operator')?.addEventListener('change', (e) => {
      _sel.operator = e.target.value;
      _updateConditionRows();
    });

    document.getElementById('wiz-pick-device')?.addEventListener('click', () => {
      _sel._returnStep = 'condition_builder';
      _stepDevicePicker('condition');
    });

    document.getElementById('wiz-pick-attr')?.addEventListener('click', () => {
      if (_sel.device_id) _stepAttributePicker();
    });

    document.getElementById('wiz-subject-type')?.addEventListener('change', (e) => {
      _sel.subject_type = e.target.value;
      _stepConditionBuilder(); // re-render
    });

    document.getElementById('wiz-agg')?.addEventListener('change', (e) => {
      _sel.aggregation = e.target.value;
    });

    _wireConditionFooter(
      () => _stepConditionOrGroup(),
      () => _addConditionAndMore(),
      () => _addCondition()
    );
  }

  function _updateConditionRows() {
    const op = _sel.operator || '';
    const needsVal = NEEDS_VALUE.has(op);
    const needsDur = NEEDS_DURATION.has(op);
    const needsTwo = NEEDS_TWO_VALUES.has(op);

    document.getElementById('wiz-value-row')?.classList.toggle('hidden', !needsVal);
    document.getElementById('wiz-duration-row')?.classList.toggle('hidden', !needsDur);
    if (needsDur) {
      const lbl = document.getElementById('wiz-duration-label');
      if (lbl) lbl.textContent = durationLabel(op);
    }

    // Show/hide second value for between
    const v2 = document.getElementById('wiz-value-2');
    const andSpan = document.querySelector('.wiz-between-and');
    if (v2) v2.style.display = needsTwo ? '' : 'none';
    if (andSpan) andSpan.style.display = needsTwo ? '' : 'none';

    // Enable/disable Add buttons
    const hasDevice = !!_sel.device_id;
    const hasOp = !!op;
    const enabled = hasDevice && hasOp;
    document.getElementById('wiz-add')?.toggleAttribute('disabled', !enabled);
    document.getElementById('wiz-add-more')?.toggleAttribute('disabled', !enabled);

    // Trigger indicator
    if (isTrigger(op)) {
      document.getElementById('wiz-operator')?.classList.add('is-trigger');
    } else {
      document.getElementById('wiz-operator')?.classList.remove('is-trigger');
    }
  }

  function _readConditionFromDOM() {
    return {
      statement_class: _sel.statement_class || 'condition',
      aggregation: document.getElementById('wiz-agg')?.value || _sel.aggregation || 'any',
      subject: {
        type: _sel.subject_type || 'device',
        entity_id: _sel.device_id || '',
        role: _sel.device_label || '',
        capability: _sel.attribute || '',
      },
      operator: document.getElementById('wiz-operator')?.value || '',
      value: document.getElementById('wiz-value-1')?.value || '',
      value2: document.getElementById('wiz-value-2')?.value || '',
      duration_amount: parseInt(document.getElementById('wiz-dur-amount')?.value || '1'),
      duration_unit: document.getElementById('wiz-dur-unit')?.value || 'minutes',
      interaction: document.getElementById('wiz-interaction')?.value || 'any',
      display_value: document.getElementById('wiz-value-1')?.value || '',
      is_trigger: isTrigger(document.getElementById('wiz-operator')?.value || ''),
    };
  }

  function _addCondition() {
    const node = _readConditionFromDOM();
    if (!node.subject.entity_id || !node.operator) return;
    node.type = node.is_trigger ? 'trigger' : 'condition';
    node.id = _editNode?.id || _newId();
    Editor.insertStatement(_context, node);
    close();
  }

  function _addConditionAndMore() {
    const node = _readConditionFromDOM();
    if (!node.subject.entity_id || !node.operator) return;
    node.type = node.is_trigger ? 'trigger' : 'condition';
    node.id = _editNode?.id || _newId();
    Editor.insertStatement(_context, node);
    // Reset for next condition — keep device selection
    const prevDevice = { device_id: _sel.device_id, device_label: _sel.device_label, subject_type: _sel.subject_type };
    _sel = { statement_class: 'condition', ...prevDevice };
    _editNode = null;
    _stepConditionBuilder();
  }

  // ── STEP: Group Builder ───────────────────────────────────
  function _stepGroupBuilder() {
    _step = 'group_builder';
    _renderModal(
      'Add a new condition group',
      `
        <div class="wiz-desc">A group is a collection of conditions joined by a logical operator.</div>
        <div class="wiz-row-label">Group operator</div>
        <select id="wiz-group-op" class="wiz-select-blue wiz-select-full">
          <option value="AND">AND — all conditions must be true</option>
          <option value="OR">OR — any condition must be true</option>
        </select>
      `,
      _conditionFooter(() => _stepConditionOrGroup(), null, () => {
        const node = {
          type: 'group',
          id: _newId(),
          group_operator: document.getElementById('wiz-group-op')?.value || 'AND',
          conditions: [],
        };
        Editor.insertStatement(_context, node);
        close();
      }, true)
    );
    _wireConditionFooter(
      () => _stepConditionOrGroup(),
      null,
      () => {
        const node = {
          type: 'group',
          id: _newId(),
          group_operator: document.getElementById('wiz-group-op')?.value || 'AND',
          conditions: [],
        };
        Editor.insertStatement(_context, node);
        close();
      }
    );
  }

  // ── STEP: Statement Type Picker (card grid) ───────────────
  function _stepStatementTypePicker() {
    _step = 'statement_type';

    const section = (title, types) => `
      <div class="wiz-section-label">${_esc(title)}</div>
      <div class="wiz-card-grid">
        ${types.map(t => `
          <div class="wiz-stmt-card" data-stmt-type="${_esc(t.type)}">
            <div class="wiz-stmt-icon">${t.icon}</div>
            <div class="wiz-stmt-name">${_esc(t.label)}</div>
            <div class="wiz-stmt-desc">${_esc(t.desc)}</div>
            <button class="btn ${t.btnClass} btn-sm wiz-stmt-btn">${_esc(t.btn)}</button>
          </div>
        `).join('')}
      </div>
    `;

    _renderModal(
      '',
      `
        ${section('Basic statements', STATEMENT_TYPES.basic)}
        ${section('Advanced statements', STATEMENT_TYPES.advanced)}
        <div class="wiz-card-grid">
          ${STATEMENT_TYPES.loops.map(t => `
            <div class="wiz-stmt-card" data-stmt-type="${_esc(t.type)}">
              <div class="wiz-stmt-icon">${t.icon}</div>
              <div class="wiz-stmt-name">${_esc(t.label)}</div>
              <div class="wiz-stmt-desc">${_esc(t.desc)}</div>
              <button class="btn ${t.btnClass} btn-sm wiz-stmt-btn">${_esc(t.btn)}</button>
            </div>
          `).join('')}
        </div>
      `,
      `<button class="btn btn-ghost btn-sm" id="wiz-cancel-stmt">Cancel</button>`
    );

    document.getElementById('wiz-cancel-stmt')?.addEventListener('click', close);

    document.querySelectorAll('[data-stmt-type]').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.stmtType;
        _sel.statement_type = type;
        _handleStatementType(type);
      });
    });
  }

  function _handleStatementType(type) {
    if (type === 'action') {
      _stepDevicePicker('action');
    } else if (type === 'if_block') {
      Editor.insertStatement(_context, { type: 'if_block', id: _newId(), conditions: [], then_actions: [], else_actions: [] });
      close();
    } else if (type === 'for_each') {
      _stepForEachPicker();
    } else if (type === 'while_loop') {
      Editor.insertStatement(_context, { type: 'while_loop', id: _newId(), conditions: [], actions: [] });
      close();
    } else if (type === 'repeat_loop') {
      _stepRepeatPicker();
    } else if (type === 'timer') {
      _stepTimerPicker();
    } else {
      // for break, exit, switch, do_block, on_event, for_loop — insert skeleton
      Editor.insertStatement(_context, { type, id: _newId() });
      close();
    }
  }

  // ── STEP: Device Picker ───────────────────────────────────
  function _stepDevicePicker(mode) {
    // mode: 'condition' | 'action' | 'task'
    _sel._devicePickerMode = mode;
    _step = 'device_picker';

    _renderModal(
      mode === 'action' ? 'Add a new action' : 'Select device(s)',
      `
        ${mode === 'action' ? `<div class="wiz-desc">Actions represent a collection of tasks a device or group of devices have to perform. The Location virtual device provides a way to execute some non-device-specific tasks.</div>` : ''}

        <!-- Selected devices bar -->
        <div class="wiz-selected-bar" id="wiz-selected-bar" style="display:none">
          <span id="wiz-selected-label">Nothing selected</span>
        </div>

        <!-- Search box -->
        <div class="wiz-device-search-wrap">
          <div class="wiz-desc" style="font-size:11px;margin-bottom:4px">Use the input box below to quickly search for devices</div>
          <div class="wiz-search-row">
            <input type="text" id="wiz-device-search" placeholder="" autocomplete="off" />
            <button id="wiz-search-clear" style="display:none">✕</button>
          </div>
        </div>
        <div class="wiz-sel-all-row">
          <button class="btn btn-ghost btn-xs" id="wiz-sel-all">Select All</button>
          <button class="btn btn-ghost btn-xs" id="wiz-desel-all">Deselect All</button>
        </div>

        <!-- Device list -->
        <div class="wiz-device-list" id="wiz-device-list">
          <div class="wiz-loading"><div class="spinner"></div></div>
        </div>
      `,
      mode === 'condition'
        ? _conditionFooter(() => _stepConditionBuilder(), null, null, false)
        : `<button class="btn btn-ghost btn-sm" id="wiz-dp-cancel">Cancel</button>`
    );

    document.getElementById('wiz-dp-cancel')?.addEventListener('click', close);

    // Search wiring
    let _ft = null;
    document.getElementById('wiz-device-search')?.addEventListener('input', (e) => {
      clearTimeout(_ft);
      const clr = document.getElementById('wiz-search-clear');
      if (clr) clr.style.display = e.target.value ? '' : 'none';
      _ft = setTimeout(() => _renderDeviceList(e.target.value.trim()), 200);
    });
    document.getElementById('wiz-search-clear')?.addEventListener('click', () => {
      const inp = document.getElementById('wiz-device-search');
      if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input')); }
    });
    document.getElementById('wiz-sel-all')?.addEventListener('click', () => _selectAllDevices(true));
    document.getElementById('wiz-desel-all')?.addEventListener('click', () => _selectAllDevices(false));

    _loadDevicesForPicker();
  }

  let _deviceData = null;

  async function _loadDevicesForPicker() {
    try {
      if (!_deviceData) {
        const raw = await API.getDevices();
        _deviceData = raw;
      }
      _renderDeviceList('');
    } catch(e) {
      const el = document.getElementById('wiz-device-list');
      if (el) el.innerHTML = `<div class="wiz-error">Could not load devices from HA.<br><small>${_esc(e.message)}</small></div>`;
    }
  }

  function _renderDeviceList(query) {
    const el = document.getElementById('wiz-device-list');
    if (!el) return;

    const q = (query || '').toLowerCase();
    const physical = (_deviceData || []).filter(d =>
      !q || d.friendly_name.toLowerCase().includes(q) || d.entity_id.toLowerCase().includes(q)
    );

    // Load globals for the list
    const globals = (_globalsCache || []).filter(g => g.type === 'device' || g.var_type === 'device')
      .filter(g => !q || g.name.toLowerCase().includes(q));

    const selected = new Set(_sel.devices || []);

    let html = '';

    // Virtual devices
    if (!q) {
      html += `<div class="wiz-device-group-header">Virtual devices</div>`;
      html += VIRTUAL_DEVICES.map(v => _deviceRow(v.entity_id, v.friendly_name, selected.has(v.entity_id), 'virtual')).join('');
    }

    // Physical devices
    if (physical.length) {
      html += `<div class="wiz-device-group-header">Physical devices</div>`;
      html += physical.slice(0, 100).map(d => _deviceRow(d.entity_id, d.friendly_name, selected.has(d.entity_id), 'physical')).join('');
    }

    // Global device variables
    if (globals.length) {
      globals.forEach(g => {
        const id = `@${g.name}`;
        html += _deviceRow(id, `@${g.name}`, selected.has(id), 'global');
      });
    }

    // System variables
    if (!q) {
      html += `<div class="wiz-device-group-header">System variables</div>`;
      html += SYSTEM_VARS.map(sv => _deviceRow(sv.name, sv.label, selected.has(sv.name), 'sysvar')).join('');
    }

    el.innerHTML = html || `<div class="wiz-empty">No devices found.</div>`;

    // Wire clicks
    el.querySelectorAll('.wiz-device-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const mode = _sel._devicePickerMode;

        if (mode === 'condition') {
          // Single select for conditions
          el.querySelectorAll('.wiz-device-row').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
          _sel.device_id = id;
          _sel.device_label = row.dataset.label;
          _sel.devices = [id];
          _updateSelectedBar([row.dataset.label]);
          // Auto-advance to attribute picker for physical devices
          if (!id.startsWith('__') && !id.startsWith('@') && !id.startsWith('$')) {
            setTimeout(() => _stepAttributePicker(), 150);
          } else {
            _stepConditionBuilder();
          }
        } else {
          // Multi-select for actions
          row.classList.toggle('selected');
          const newSelected = new Set(_sel.devices || []);
          if (row.classList.contains('selected')) {
            newSelected.add(id);
          } else {
            newSelected.delete(id);
          }
          _sel.devices = [...newSelected];
          _sel.device_id = _sel.devices[0] || '';
          _sel.device_label = _sel.devices.length === 1 ? row.dataset.label : `${_sel.devices.length} devices`;
          _updateSelectedBar(_sel.devices.map(d => {
            const r = el.querySelector(`[data-id="${CSS.escape(d)}"]`);
            return r?.dataset.label || d;
          }));
          // Show a "Done" button once at least one device is selected
          _updateDevicePickerFooter(_sel.devices.length > 0);
        }
      });
    });

    // Re-apply selected state
    selected.forEach(id => {
      el.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('selected');
    });
  }

  function _deviceRow(id, label, selected, type) {
    const prefix = type === 'global' ? `<span class="wiz-dev-prefix">device</span>` : '';
    return `<div class="wiz-device-row ${selected ? 'selected' : ''}" data-id="${_esc(id)}" data-label="${_esc(label)}" data-type="${type}">
      ${prefix}<span class="wiz-dev-label">${_esc(label)}</span>
    </div>`;
  }

  function _updateSelectedBar(labels) {
    const bar = document.getElementById('wiz-selected-bar');
    const lbl = document.getElementById('wiz-selected-label');
    if (!bar || !lbl) return;
    if (labels.length) {
      bar.style.display = '';
      lbl.textContent = labels.join(', ');
    } else {
      bar.style.display = 'none';
    }
  }

  function _updateDevicePickerFooter(hasSelection) {
    const footer = document.getElementById('wiz-footer');
    if (!footer) return;
    footer.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="wiz-dp-cancel">Cancel</button>
      <button class="btn btn-primary btn-sm" id="wiz-dp-next" ${hasSelection ? '' : 'disabled'}>Next →</button>
    `;
    document.getElementById('wiz-dp-cancel')?.addEventListener('click', close);
    document.getElementById('wiz-dp-next')?.addEventListener('click', () => {
      if (_sel.device_id === '__location__') {
        _stepLocationCommandPicker();
      } else {
        _stepCommandPicker();
      }
    });
  }

  function _selectAllDevices(selectAll) {
    const rows = document.querySelectorAll('.wiz-device-row');
    const ids = [];
    const labels = [];
    rows.forEach(r => {
      if (selectAll) {
        r.classList.add('selected');
        ids.push(r.dataset.id);
        labels.push(r.dataset.label);
      } else {
        r.classList.remove('selected');
      }
    });
    _sel.devices = selectAll ? ids : [];
    _sel.device_id = ids[0] || '';
    _updateSelectedBar(selectAll ? labels : []);
    _updateDevicePickerFooter(selectAll && ids.length > 0);
  }

  // ── STEP: Attribute Picker (condition flow) ───────────────
  async function _stepAttributePicker() {
    _step = 'attribute_picker';
    const entityId = _sel.device_id;

    // Show loading state in the compare row
    _stepConditionBuilder(); // re-render with loading attr button

    try {
      const data = await API.getCapabilities(entityId);
      _sel._capabilities = data.capabilities || [];
      if (_sel._capabilities.length === 1) {
        // Auto-select if only one capability
        _sel.attribute = _sel._capabilities[0].name;
        _sel.attribute_type = _sel._capabilities[0].attribute_type;
        _stepConditionBuilder();
      } else {
        _showAttributeDropdown(data.capabilities || []);
      }
    } catch(e) {
      _stepConditionBuilder();
    }
  }

  function _showAttributeDropdown(capabilities) {
    // Replace the attr button with a small dropdown inline
    const btn = document.getElementById('wiz-pick-attr');
    if (!btn) { _stepConditionBuilder(); return; }

    const sel = document.createElement('select');
    sel.className = 'wiz-attr-pick-btn has-value';
    sel.innerHTML = capabilities.map(c =>
      `<option value="${_esc(c.name)}" data-attr-type="${_esc(c.attribute_type||'')}" ${_sel.attribute===c.name?'selected':''}>${_esc(c.name)}</option>`
    ).join('');
    btn.replaceWith(sel);
    sel.value = _sel.attribute || capabilities[0]?.name || '';
    _sel.attribute = sel.value;

    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      _sel.attribute = opt.value;
      _sel.attribute_type = opt.dataset.attrType;
    });
  }

  // ── STEP: Location Command Picker ─────────────────────────
  function _stepLocationCommandPicker() {
    _step = 'location_command';
    _sel._withDevice = 'Location';

    _renderModal(
      'Add a new task',
      `
        <div class="wiz-with-row">
          <span class="wiz-with-label">With...</span>
          <span class="wiz-with-device">Location</span>
        </div>
        <div class="wiz-do-label">Do...</div>
        <select id="wiz-location-cmd" class="wiz-select-blue wiz-select-full">
          <option value="">Please select a command</option>
          ${LOCATION_COMMANDS.map(c => `<option value="${_esc(c.id)}" ${_sel.location_cmd===c.id?'selected':''}>${_esc(c.label)}</option>`).join('')}
        </select>
        <div id="wiz-location-params"></div>
      `,
      _taskFooter(!!_editNode)
    );

    document.getElementById('wiz-location-cmd')?.addEventListener('change', (e) => {
      _sel.location_cmd = e.target.value;
      _renderLocationParams(e.target.value);
      document.getElementById('wiz-save')?.removeAttribute('disabled');
    });

    if (_sel.location_cmd) {
      _renderLocationParams(_sel.location_cmd);
      document.getElementById('wiz-save')?.removeAttribute('disabled');
    }

    _wireTaskFooter(close, _saveLocationTask, _editNode ? _deleteNode : null);
  }

  function _renderLocationParams(cmd) {
    const el = document.getElementById('wiz-location-params');
    if (!el) return;

    if (cmd === 'set_variable') {
      el.innerHTML = `
        <div class="wiz-param-section">
          <div class="wiz-row-label">Variable</div>
          <div class="wiz-value-inputs">
            <select id="wiz-var-scope" class="wiz-select-blue-sm">
              <option value="local">Variable</option>
              <option value="global">Global</option>
            </select>
            <select id="wiz-var-name" class="wiz-select-gray">
              <option value="">Select variable...</option>
            </select>
          </div>
        </div>
        <div class="wiz-param-section">
          <div class="wiz-row-label">Value</div>
          <select id="wiz-val-type" class="wiz-select-blue-sm">
            <option value="expression">Expression</option>
            <option value="value">Value</option>
            <option value="variable">Variable</option>
          </select>
          <textarea id="wiz-val-expr" class="wiz-expr-area" placeholder="">${_esc(_sel.value || '')}</textarea>
        </div>
        <div class="wiz-param-section">
          <div class="wiz-row-label">Only during these modes</div>
          <select id="wiz-modes" class="wiz-select-orange wiz-select-full">
            <option value="">Nothing selected</option>
          </select>
        </div>
      `;
      _loadVariableOptions();

    } else if (cmd === 'wait') {
      el.innerHTML = `
        <div class="wiz-param-section">
          <div class="wiz-row-label">Duration</div>
          <div class="wiz-duration-inputs">
            <input type="number" id="wiz-wait-amount" value="${_esc(String(_sel.duration_amount||1))}" min="1" class="wiz-dur-number" />
            <select id="wiz-wait-unit" class="wiz-select-blue-sm">
              <option value="milliseconds">milliseconds</option>
              <option value="seconds">seconds</option>
              <option value="minutes" selected>minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </div>
      `;

    } else if (cmd === 'log') {
      el.innerHTML = `
        <div class="wiz-param-section">
          <div class="wiz-row-label">Message</div>
          <textarea id="wiz-log-msg" class="wiz-expr-area" placeholder="Log message...">${_esc(_sel.message||'')}</textarea>
          <select id="wiz-log-level" class="wiz-select-blue-sm" style="margin-top:6px">
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>
      `;

    } else if (cmd === 'execute_piston') {
      el.innerHTML = `
        <div class="wiz-param-section">
          <div class="wiz-row-label">Piston to execute</div>
          <select id="wiz-target-piston" class="wiz-select-blue wiz-select-full">
            <option value="">Select piston...</option>
            ${(App.state.pistons||[]).map(p => `<option value="${_esc(p.id)}">${_esc(p.name)}</option>`).join('')}
          </select>
        </div>
      `;

    } else if (cmd === 'send_notification') {
      el.innerHTML = `
        <div class="wiz-param-section">
          <div class="wiz-row-label">Message</div>
          <textarea id="wiz-notif-msg" class="wiz-expr-area" placeholder="Notification message...">${_esc(_sel.message||'')}</textarea>
        </div>
        <div class="wiz-param-section">
          <div class="wiz-row-label">Title (optional)</div>
          <input type="text" id="wiz-notif-title" class="wiz-value-input" value="${_esc(_sel.title||'')}" placeholder="Title..." />
        </div>
      `;

    } else {
      el.innerHTML = `<div class="wiz-desc" style="margin-top:8px">Parameters for <strong>${_esc(cmd)}</strong> coming soon.</div>`;
    }
  }

  async function _loadVariableOptions() {
    // Load piston variables into the variable name dropdown
    const sel = document.getElementById('wiz-var-name');
    if (!sel) return;
    try {
      const piston = await API.getPiston(App.state.currentPistonId);
      const vars = piston.variables || [];
      sel.innerHTML = `<option value="">Select variable...</option>` +
        vars.map(v => `<option value="${_esc(v.name)}" data-type="${_esc(v.var_type||'')}">
          ${_esc(v.var_type||'dynamic')} ${_esc(v.name)}
        </option>`).join('');
      if (_sel.variable) sel.value = _sel.variable;
    } catch(e) {
      sel.innerHTML = `<option value="">Could not load variables</option>`;
    }
  }

  function _saveLocationTask() {
    const cmd = _sel.location_cmd;
    if (!cmd) return;

    let node = { type: 'service_call', id: _editNode?.id || _newId(), service: `location.${cmd}` };

    if (cmd === 'set_variable') {
      node = {
        type: 'set_variable',
        id: node.id,
        variable: document.getElementById('wiz-var-name')?.value || '',
        value: document.getElementById('wiz-val-expr')?.value || '',
      };
    } else if (cmd === 'wait') {
      node = {
        type: 'wait',
        id: node.id,
        wait_type: 'duration',
        duration: document.getElementById('wiz-wait-amount')?.value || '1',
        unit: document.getElementById('wiz-wait-unit')?.value || 'minutes',
      };
    } else if (cmd === 'log') {
      node = {
        type: 'log',
        id: node.id,
        message: document.getElementById('wiz-log-msg')?.value || '',
        level: document.getElementById('wiz-log-level')?.value || 'info',
      };
    } else if (cmd === 'execute_piston') {
      node = {
        type: 'call_piston',
        id: node.id,
        target: document.getElementById('wiz-target-piston')?.value || '',
      };
    } else if (cmd === 'send_notification') {
      node.parameters = {
        message: document.getElementById('wiz-notif-msg')?.value || '',
        title: document.getElementById('wiz-notif-title')?.value || '',
      };
    }

    Editor.insertStatement(_context, node);
    close();
  }

  // ── STEP: Physical Device Command Picker ──────────────────
  async function _stepCommandPicker() {
    _step = 'command_picker';
    const deviceIds = _sel.devices || [_sel.device_id];
    const label = _sel.device_label || deviceIds[0] || 'device';

    _renderModal(
      'Add a new task',
      `
        <div class="wiz-with-row">
          <span class="wiz-with-label">With...</span>
          <span class="wiz-with-device">{${_esc(label)}}</span>
        </div>
        <div class="wiz-do-label">Do...</div>
        <div id="wiz-cmd-area">
          <select id="wiz-command" class="wiz-select-blue wiz-select-full">
            <option value="">Please select a command</option>
          </select>
          <div id="wiz-cmd-params"></div>
        </div>
      `,
      _taskFooter(!!_editNode)
    );

    _wireTaskFooter(close, _saveDeviceTask, _editNode ? _deleteNode : null);

    // Load services from HA for this device
    try {
      const entityId = deviceIds[0];
      const data = await API.getServices(entityId);
      const services = data.services || [];
      const sel = document.getElementById('wiz-command');
      if (sel && services.length) {
        sel.innerHTML = `<option value="">Please select a command</option>` +
          services.map(s => `<option value="${_esc(s.service)}">${_esc(s.label || s.service)}</option>`).join('');
        if (_sel.command) sel.value = _sel.command;
      }
      sel?.addEventListener('change', (e) => {
        _sel.command = e.target.value;
        _renderCommandParams(e.target.value, data.services || []);
        document.getElementById('wiz-save')?.removeAttribute('disabled');
      });
      if (_sel.command) {
        _renderCommandParams(_sel.command, services);
        document.getElementById('wiz-save')?.removeAttribute('disabled');
      }
    } catch(e) {
      document.getElementById('wiz-cmd-area').innerHTML =
        `<div class="wiz-error">Could not load device commands.<br><small>${_esc(e.message)}</small></div>`;
    }
  }

  function _renderCommandParams(service, services) {
    const el = document.getElementById('wiz-cmd-params');
    if (!el) return;

    const svc = services.find(s => s.service === service);
    if (!svc || !svc.fields || !Object.keys(svc.fields).length) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = Object.entries(svc.fields).map(([key, field]) => `
      <div class="wiz-param-section">
        <div class="wiz-row-label">${_esc(field.name || key)}</div>
        ${field.selector?.number
          ? `<input type="number" class="wiz-value-input" data-param="${_esc(key)}"
               min="${field.selector.number.min ?? ''}" max="${field.selector.number.max ?? ''}"
               value="${_esc(String(_sel.parameters?.[key] ?? (field.selector.number.min ?? 0)))}" />`
          : field.selector?.select
          ? `<select class="wiz-select-blue-sm" data-param="${_esc(key)}">
               ${field.selector.select.options.map(o =>
                 `<option value="${_esc(o.value)}" ${(_sel.parameters?.[key]===o.value)?'selected':''}>${_esc(o.label)}</option>`
               ).join('')}
             </select>`
          : `<input type="text" class="wiz-value-input" data-param="${_esc(key)}"
               value="${_esc(String(_sel.parameters?.[key] ?? ''))}" placeholder="${_esc(field.description||'')}" />`
        }
      </div>
    `).join('');
  }

  function _saveDeviceTask() {
    const command = document.getElementById('wiz-command')?.value;
    if (!command) return;

    const params = {};
    document.querySelectorAll('[data-param]').forEach(el => {
      params[el.dataset.param] = el.value;
    });

    const node = {
      type: 'service_call',
      id: _editNode?.id || _newId(),
      service: command,
      devices: _sel.devices || [_sel.device_id],
      device_label: _sel.device_label,
      parameters: params,
    };

    Editor.insertStatement(_context, node);
    close();
  }

  // ── STEP: Variable Picker ─────────────────────────────────
  function _stepVariablePicker() {
    _step = 'variable_picker';

    const VAR_TYPES_BASIC = [
      'Dynamic','String (text)','Boolean (true/false)',
      'Number (integer)','Number (decimal)','Large number (long)',
      'Date and Time','Date (date only)','Time (time only)','Device',
    ];
    const VAR_TYPES_ADV = [
      'Dynamic list','String list (text)','Boolean list (true/false)',
      'Number list (integer)','Number list (decimal)','Large number list (long)',
      'Date and Time list','Date list (date only)','Time list (time only)',
    ];

    _renderModal(
      'Add a new variable',
      `
        <div class="wiz-compare-row">
          <select id="wiz-var-type" class="wiz-select-blue">
            <optgroup label="Basic">
              ${VAR_TYPES_BASIC.map(t => `<option value="${_esc(t)}" ${(_sel.var_type===t)?'selected':''}>${_esc(t)}</option>`).join('')}
            </optgroup>
            <optgroup label="Advanced lists">
              ${VAR_TYPES_ADV.map(t => `<option value="${_esc(t)}" ${(_sel.var_type===t)?'selected':''}>${_esc(t)}</option>`).join('')}
            </optgroup>
          </select>
          <input type="text" id="wiz-var-name-input" class="wiz-value-input" placeholder="Variable name..." value="${_esc(_sel.name||'')}" />
        </div>
        <div class="wiz-param-section" style="margin-top:12px">
          <div class="wiz-row-label">Initial value (optional)</div>
          <input type="text" id="wiz-var-initial" class="wiz-value-input" value="${_esc(String(_sel.initial_value||''))}" placeholder="Leave blank for default" />
        </div>
      `,
      _conditionFooter(null, null, () => {
        const name = document.getElementById('wiz-var-name-input')?.value.trim();
        if (!name) return;
        const node = {
          type: 'variable',
          id: _editNode?.id || _newId(),
          name,
          var_type: document.getElementById('wiz-var-type')?.value || 'Dynamic',
          initial_value: document.getElementById('wiz-var-initial')?.value || undefined,
        };
        Editor.insertStatement('variable', node);
        close();
      }, true)
    );

    _wireConditionFooter(null, null, () => {
      const name = document.getElementById('wiz-var-name-input')?.value.trim();
      if (!name) return;
      const node = {
        type: 'variable',
        id: _editNode?.id || _newId(),
        name,
        var_type: document.getElementById('wiz-var-type')?.value || 'Dynamic',
        initial_value: document.getElementById('wiz-var-initial')?.value || undefined,
      };
      Editor.insertStatement('variable', node);
      close();
    });
  }

  // ── STEP: Timer ───────────────────────────────────────────
  function _stepTimerPicker() {
    _step = 'timer';
    _renderModal(
      'Add a timer',
      `
        <div class="wiz-desc">A timer will trigger execution of the piston at set time intervals.</div>
        <div class="wiz-row-label">Every...</div>
        <div class="wiz-duration-inputs">
          <input type="number" id="wiz-timer-amount" value="${_esc(String(_sel.interval||5))}" min="1" class="wiz-dur-number" />
          <select id="wiz-timer-unit" class="wiz-select-blue-sm">
            <option value="seconds">seconds</option>
            <option value="minutes" selected>minutes</option>
            <option value="hours">hours</option>
          </select>
        </div>
      `,
      _taskFooter(!!_editNode)
    );
    _wireTaskFooter(close, () => {
      Editor.insertStatement(_context, {
        type: 'timer',
        id: _editNode?.id || _newId(),
        interval: parseInt(document.getElementById('wiz-timer-amount')?.value||'5'),
        unit: document.getElementById('wiz-timer-unit')?.value || 'minutes',
      });
      close();
    });
  }

  // ── STEP: Repeat picker ───────────────────────────────────
  function _stepRepeatPicker() {
    _step = 'repeat';
    _renderModal(
      'Add a repeat loop',
      `
        <div class="wiz-desc">A repeat loop executes the same statements until a condition is met.</div>
        <div class="wiz-row-label">Repeat</div>
        <div class="wiz-duration-inputs">
          <input type="number" id="wiz-repeat-times" value="${_esc(String(_sel.times||1))}" min="1" class="wiz-dur-number" />
          <span style="padding:0 8px; color:var(--text-muted); font-size:13px">times</span>
        </div>
      `,
      _taskFooter(!!_editNode)
    );
    _wireTaskFooter(close, () => {
      Editor.insertStatement(_context, {
        type: 'repeat_loop',
        id: _editNode?.id || _newId(),
        times: parseInt(document.getElementById('wiz-repeat-times')?.value||'1'),
        actions: [],
      });
      close();
    });
  }

  // ── STEP: For Each ────────────────────────────────────────
  function _stepForEachPicker() {
    _step = 'for_each';
    _renderModal(
      'Add a for each loop',
      `
        <div class="wiz-desc">A for each loop executes the same statements for each device in a device list.</div>
        <div class="wiz-row-label">For each device in</div>
        <select id="wiz-foreach-list" class="wiz-select-blue wiz-select-full">
          <option value="">Select a device list variable...</option>
        </select>
        <div class="wiz-row-label" style="margin-top:12px">Store current device in variable</div>
        <input type="text" id="wiz-foreach-var" class="wiz-value-input" placeholder="$device" value="${_esc(_sel.device_var||'$device')}" />
      `,
      _taskFooter(!!_editNode)
    );
    _wireTaskFooter(close, () => {
      Editor.insertStatement(_context, {
        type: 'for_each',
        id: _editNode?.id || _newId(),
        device_list: document.getElementById('wiz-foreach-list')?.value || '',
        device_var: document.getElementById('wiz-foreach-var')?.value || '$device',
        actions: [],
      });
      close();
    });
  }

  // ── Delete node ───────────────────────────────────────────
  function _deleteNode() {
    if (!_editNode?.id) return;
    App.confirm({
      title: 'Delete statement',
      message: 'Delete this statement? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        Editor.deleteStatement(_editNode.id);
        close();
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function _newId() {
    return 'stmt_' + Math.random().toString(36).slice(2, 8);
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Public API — called by editor ghost text clicks
  // Context string maps: 'trigger_or_condition', 'condition', 'restriction',
  //   'action', 'variable', 'global', 'task', 'if_condition'
  return { open, close };

})();
