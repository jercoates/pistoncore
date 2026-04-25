// pistoncore/frontend/js/wizard.js
//
// The Wizard Modal — multi-step statement builder.
// Opens when the user clicks any ghost text insertion point or edits an existing statement.
// Same modal for triggers, conditions, and actions — steps change based on context.
//
// WIZARD_SPEC v0.3 is the authoritative reference for all behavior here.

const Wizard = (() => {

  // ── State ────────────────────────────────────────────────
  let _state = null;   // wizard internal state object
  let _callbacks = {}; // { onDone }

  // ── Capability map ───────────────────────────────────────
  // Per WIZARD_SPEC — lives in the frontend, not the backend.
  // Given attribute_type, defines valid trigger operators and condition operators.

  const CAPABILITY_MAP = {
    binary: {
      triggers: ['changes to', 'changes (any)'],
      conditions: ['is', 'was for at least'],
    },
    numeric: {
      triggers: ['changes to', 'drops below', 'rises above', 'changes (any)'],
      conditions: ['equals', 'is less than', 'is greater than', 'is between', 'was for at least'],
    },
    numeric_position: {
      triggers: ['changes to', 'drops below', 'rises above', 'changes (any)'],
      conditions: ['equals', 'is less than', 'is greater than', 'is between'],
    },
    enum: {
      triggers: ['changes to', 'changes (any)'],
      conditions: ['is', 'is not'],
    },
    ha_boolean: {
      triggers: ['changes to true', 'changes to false', 'changes (any)'],
      conditions: ['is true', 'is false'],
    },
    location: {
      triggers: ['enters zone', 'leaves zone', 'changes (any)'],
      conditions: ['is in zone', 'is not in zone', 'is home', 'is away'],
    },
    unknown: {
      triggers: ['changes (any)'],
      conditions: ['is', 'is not'],
    },
  };

  // Binary sensor friendly label pairs per WIZARD_SPEC device_class table
  const BINARY_LABELS = {
    door:             { on: 'Open',     off: 'Closed'    },
    window:           { on: 'Open',     off: 'Closed'    },
    garage_door:      { on: 'Open',     off: 'Closed'    },
    opening:          { on: 'Open',     off: 'Closed'    },
    lock:             { on: 'Unlocked', off: 'Locked'    },
    motion:           { on: 'Detected', off: 'Clear'     },
    occupancy:        { on: 'Occupied', off: 'Clear'     },
    presence:         { on: 'Home',     off: 'Away'      },
    smoke:            { on: 'Detected', off: 'Clear'     },
    carbon_monoxide:  { on: 'Detected', off: 'Clear'     },
    moisture:         { on: 'Wet',      off: 'Dry'       },
    gas:              { on: 'Detected', off: 'Clear'     },
    safety:           { on: 'Unsafe',   off: 'Safe'      },
    vibration:        { on: 'Detected', off: 'Clear'     },
    sound:            { on: 'Detected', off: 'Clear'     },
    light:            { on: 'Light',    off: 'Dark'      },
    problem:          { on: 'Problem',  off: 'OK'        },
    tamper:           { on: 'Tampered', off: 'Clear'     },
    connectivity:     { on: 'Connected',off: 'Disconnected'},
    plug:             { on: 'On',       off: 'Off'       },
    outlet:           { on: 'On',       off: 'Off'       },
    battery:          { on: 'Low',      off: 'Normal'    },
    cold:             { on: 'Cold',     off: 'Normal'    },
    heat:             { on: 'Hot',      off: 'Normal'    },
    moving:           { on: 'Moving',   off: 'Stopped'   },
    running:          { on: 'Running',  off: 'Not Running'},
    update:           { on: 'Update Available', off: 'Up to Date' },
  };

  // Action statement types available in the wizard
  // Simple mode hides entries with simple: false
  const ACTION_TYPES = [
    { type: 'service_call',   label: 'Control a Device',       icon: '💡', simple: true  },
    { type: 'wait',           label: 'Wait',                    icon: '⏱', simple: true  },
    { type: 'if_block',       label: 'If / Then / Else',        icon: '🔀', simple: true  },
    { type: 'with_block',     label: 'With / Do',               icon: '📦', simple: true  },
    { type: 'set_variable',   label: 'Set Variable',            icon: '📝', simple: false },
    { type: 'log',            label: 'Log Message',             icon: '📋', simple: true  },
    { type: 'stop',           label: 'Stop',                    icon: '🛑', simple: true  },
    { type: 'call_piston',    label: 'Call Another Piston',     icon: '🔗', simple: false },
    { type: 'fire_event',     label: 'Fire Event',              icon: '📡', simple: false },
    { type: 'repeat_block',   label: 'Repeat',                  icon: '🔄', simple: false },
    { type: 'for_each_block', label: 'For Each',                icon: '🔁', simple: false },
    { type: 'while_block',    label: 'While',                   icon: '↩', simple: false },
    { type: 'parallel',       label: 'Execute in Parallel',     icon: '⚡', simple: false },
  ];

  // ── Open / Close ─────────────────────────────────────────
  function open({ context, parentId, branch, index, editNode, onDone }) {
    _callbacks = { onDone };
    _state = {
      context: context || 'action',   // 'trigger' | 'condition' | 'action'
      step: 0,
      parentId,
      branch,
      index: index ?? 0,
      editNode: editNode || null,
      selections: {},
      sentence: '',
    };

    _showModal();

    if (context === 'action') {
      _renderActionTypeStep();
    } else if (context === 'condition' || context === 'trigger') {
      _renderConditionOrGroupStep();
    }
  }

  function close() {
    const backdrop = document.getElementById('wizard-backdrop');
    backdrop?.classList.remove('open');
    _state = null;
    _callbacks = {};
  }

  function _showModal() {
    const backdrop = document.getElementById('wizard-backdrop');
    const modal = document.getElementById('wizard-modal');
    if (!backdrop || !modal) return;

    const contextLabel = {
      trigger: 'Add Trigger',
      condition: 'Add Condition',
      action: 'Add Statement',
    }[_state.context] || 'Wizard';

    modal.innerHTML = `
      <div class="wizard-header">
        <span class="wizard-context-label">${_esc(contextLabel)}</span>
        <div class="wizard-sentence" id="wizard-sentence"></div>
      </div>
      <div class="wizard-body" id="wizard-body"></div>
      <div class="advanced-options" id="wizard-advanced">
        <div class="advanced-options-title">Advanced Options</div>
        <p class="advanced-options-note">TEP, TCP, and Execution Method options only apply to PyScript pistons.</p>
        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:12px">
          <div class="editor-field-group">
            <label class="editor-field-label">Task Execution Policy (TEP)</label>
            <select id="adv-tep">
              <option value="default">Default</option>
              <option value="no_wait">No wait</option>
              <option value="wait">Wait for completion</option>
            </select>
          </div>
          <div class="editor-field-group">
            <label class="editor-field-label">Task Cancellation Policy (TCP)</label>
            <select id="adv-tcp">
              <option value="default">Default</option>
              <option value="cancel">Cancel pending</option>
            </select>
          </div>
          <div class="editor-field-group">
            <label class="editor-field-label">Execution Method</label>
            <select id="adv-exec">
              <option value="sync">Synchronous</option>
              <option value="async">Asynchronous</option>
            </select>
          </div>
        </div>
      </div>
      <div class="wizard-footer">
        <button class="cog-btn" id="wizard-cog" title="Show/Hide advanced options">⚙</button>
        <div class="wizard-footer-actions">
          <button class="btn" id="wizard-back" style="display:none">← Back</button>
          <button class="btn" id="wizard-cancel">Cancel</button>
          <button class="btn btn-primary" id="wizard-done" style="display:none">Done</button>
        </div>
      </div>
    `;

    document.getElementById('wizard-cog')?.addEventListener('click', () => {
      const adv = document.getElementById('wizard-advanced');
      adv?.classList.toggle('visible');
    });

    document.getElementById('wizard-cancel')?.addEventListener('click', close);
    document.getElementById('wizard-back')?.addEventListener('click', _goBack);
    document.getElementById('wizard-done')?.addEventListener('click', _done);

    backdrop.classList.add('open');
  }

  // ── Step rendering helpers ───────────────────────────────
  function _setBody(html) {
    const el = document.getElementById('wizard-body');
    if (el) el.innerHTML = html;
  }

  function _setSentence(text) {
    _state.sentence = text;
    const el = document.getElementById('wizard-sentence');
    if (el) el.textContent = text || '';
  }

  function _showBack(show) {
    const el = document.getElementById('wizard-back');
    if (el) el.style.display = show ? '' : 'none';
  }

  function _showDone(show) {
    const el = document.getElementById('wizard-done');
    if (el) el.style.display = show ? '' : 'none';
  }

  function _loading() {
    _setBody(`<div class="wizard-loading"><div class="spinner"></div> Loading...</div>`);
  }

  function _error(msg) {
    _setBody(`
      <div class="wizard-error">
        <div>${_esc(msg)}</div>
        <button class="btn btn-sm" id="wizard-retry">Retry</button>
      </div>
    `);
  }

  // ── Step 0a — Action type picker ─────────────────────────
  function _renderActionTypeStep() {
    _state.step = 0;
    _showBack(false);
    _showDone(false);

    const isSimple = App.state.simpleMode;
    const types = ACTION_TYPES.filter(t => !isSimple || t.simple);

    _setBody(`
      <div class="wizard-step-title">What kind of statement?</div>
      <div class="wizard-card-grid" style="grid-template-columns: repeat(3, 1fr)">
        ${types.map(t => `
          <div class="wizard-card" data-action-type="${_esc(t.type)}">
            <div class="wizard-card-title">${t.icon} ${_esc(t.label)}</div>
          </div>
        `).join('')}
      </div>
    `);

    document.querySelectorAll('[data-action-type]').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.actionType;
        _state.selections.action_type = type;
        _handleActionTypeSelected(type);
      });
    });
  }

  function _handleActionTypeSelected(type) {
    switch (type) {
      case 'service_call':
        _renderDevicePickerStep('action');
        break;
      case 'wait':
        _renderWaitStep();
        break;
      case 'if_block':
        _finishWithNode({ type: 'if_block', conditions: [], then_actions: [], else_actions: [] });
        break;
      case 'with_block':
        _finishWithNode({ type: 'with_block', devices: [], actions: [] });
        break;
      case 'set_variable':
        _renderSetVariableStep();
        break;
      case 'log':
        _renderLogStep();
        break;
      case 'stop':
        _renderStopStep();
        break;
      case 'repeat_block':
        _finishWithNode({ type: 'repeat_block', actions: [], condition: null });
        break;
      case 'for_each_block':
        _renderForEachStep();
        break;
      case 'call_piston':
        _renderCallPistonStep();
        break;
      case 'fire_event':
        _renderFireEventStep();
        break;
      default:
        _finishWithNode({ type });
    }
  }

  // ── Step 0b — Condition or Group ─────────────────────────
  function _renderConditionOrGroupStep() {
    _state.step = 0;
    _showBack(false);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">What would you like to add?</div>
      <div class="wizard-card-grid">
        <div class="wizard-card" id="card-condition">
          <div class="wizard-card-title">Condition</div>
          <div class="wizard-card-desc">A single comparison between two or more operands — the basic building block of a decisional statement.</div>
          <div style="margin-top:12px"><button class="btn btn-sm btn-primary">Add a condition</button></div>
        </div>
        <div class="wizard-card" id="card-group">
          <div class="wizard-card-title">Group</div>
          <div class="wizard-card-desc">A collection of conditions with a logical operator between them, allowing for complex AND/OR logic.</div>
          <div style="margin-top:12px"><button class="btn btn-sm">Add a group</button></div>
        </div>
      </div>
    `);

    document.getElementById('card-condition')?.addEventListener('click', () => {
      _state.selections.statement_class = 'condition';
      _renderSubjectTypeStep();
    });

    document.getElementById('card-group')?.addEventListener('click', () => {
      _state.selections.statement_class = 'group';
      _finishWithNode({
        type: 'group',
        group_operator: 'AND',
        conditions: [],
      });
    });
  }

  // ── Step 1 — Subject type ────────────────────────────────
  function _renderSubjectTypeStep() {
    _state.step = 1;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">What do you want to evaluate?</div>
      <div class="wizard-card-grid" style="grid-template-columns: repeat(3, 1fr)">
        ${[
          { type: 'device',    label: 'Physical Device', icon: '💡' },
          { type: 'variable',  label: 'Variable',         icon: '📝' },
          { type: 'time',      label: 'Time',             icon: '🕐' },
          { type: 'date',      label: 'Date',             icon: '📅' },
          { type: 'sun',       label: 'Sunrise / Sunset', icon: '🌅' },
          { type: 'ha_system', label: 'HA System',        icon: '🏠' },
        ].map(s => `
          <div class="wizard-card" data-subject-type="${_esc(s.type)}">
            <div class="wizard-card-title">${s.icon} ${_esc(s.label)}</div>
          </div>
        `).join('')}
      </div>
    `);

    document.querySelectorAll('[data-subject-type]').forEach(card => {
      card.addEventListener('click', () => {
        _state.selections.subject_type = card.dataset.subjectType;
        if (_state.selections.subject_type === 'device') {
          _renderDevicePickerStep(_state.context);
        } else {
          _renderNonDeviceStep(_state.selections.subject_type);
        }
      });
    });
  }

  // ── Step 2 — Device picker ───────────────────────────────
  function _renderDevicePickerStep(context) {
    _state.step = 2;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">Pick the device</div>
      <div class="device-search">
        <input type="text" id="device-filter" placeholder="Search by name or area..." autocomplete="off" />
      </div>
      <div class="device-list" id="device-list">
        <div class="wizard-loading"><div class="spinner"></div> Fetching devices from HA...</div>
      </div>
    `);

    _loadDevices();

    // Debounced filter
    let _filterTimer = null;
    document.getElementById('device-filter')?.addEventListener('input', (e) => {
      clearTimeout(_filterTimer);
      _filterTimer = setTimeout(() => _filterDevices(e.target.value.trim()), 250);
    });
  }

  let _deviceCache = null;

  async function _loadDevices() {
    try {
      if (!_deviceCache) {
        _deviceCache = await API.getDevices();
      }
      _renderDeviceList(_deviceCache, '');
    } catch (e) {
      _error(`Could not load device capabilities. Check your Home Assistant connection.\n${e.message}`);
      document.getElementById('wizard-retry')?.addEventListener('click', async () => {
        _deviceCache = null;
        _loading();
        await _loadDevices();
      });
    }
  }

  function _filterDevices(query) {
    if (!_deviceCache) return;
    _renderDeviceList(_deviceCache, query);
  }

  function _renderDeviceList(devices, query) {
    const el = document.getElementById('device-list');
    if (!el) return;

    let filtered = devices;
    if (query) {
      const q = query.toLowerCase();
      filtered = devices.filter(d =>
        d.friendly_name.toLowerCase().includes(q) ||
        d.entity_id.toLowerCase().includes(q) ||
        (d.area || '').toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      el.innerHTML = `<div style="padding:12px; color:var(--text-muted); font-size:12px">No devices match your search.</div>`;
      return;
    }

    el.innerHTML = filtered.slice(0, 80).map(d => `
      <div class="device-list-item" data-entity-id="${_esc(d.entity_id)}" data-friendly-name="${_esc(d.friendly_name)}">
        <div class="device-friendly-name">${_esc(d.friendly_name)}</div>
        <div style="display:flex; gap:8px">
          <span class="device-entity-id">${_esc(d.entity_id)}</span>
          ${d.area ? `<span class="device-area">${_esc(d.area)}</span>` : ''}
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.device-list-item').forEach(item => {
      item.addEventListener('click', () => {
        el.querySelectorAll('.device-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        _state.selections.device_id = item.dataset.entityId;
        _state.selections.device_label = item.dataset.friendlyName;

        const context = _state.context;
        if (context === 'action') {
          _renderServicePickerStep(item.dataset.entityId);
        } else {
          _renderCapabilityStep(item.dataset.entityId);
        }
      });
    });
  }

  // ── Step 3a — Capability picker (condition/trigger) ──────
  async function _renderCapabilityStep(entityId) {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setSentence(`Evaluating ${_state.selections.device_label || entityId}...`);
    _loading();

    try {
      const data = await API.getCapabilities(entityId);
      _state.selections.capabilities_data = data;

      _setBody(`
        <div class="wizard-step-title">Pick the capability or attribute</div>
        <div style="display:flex; flex-direction:column; gap:4px">
          ${data.capabilities.map(cap => `
            <button class="operator-btn" data-cap-name="${_esc(cap.name)}" data-attr-type="${_esc(cap.attribute_type)}" data-device-class="${_esc(cap.device_class || '')}">
              ${_esc(_capLabel(cap))}
            </button>
          `).join('')}
        </div>
      `);

      document.querySelectorAll('[data-cap-name]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-cap-name]').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');

          _state.selections.capability = btn.dataset.capName;
          _state.selections.attribute_type = btn.dataset.attrType;
          _state.selections.device_class = btn.dataset.deviceClass;

          // Look up binary label pairs
          if (_state.selections.attribute_type === 'binary') {
            const dc = _state.selections.device_class;
            _state.selections.display_states = [
              BINARY_LABELS[dc]?.on || 'On',
              BINARY_LABELS[dc]?.off || 'Off',
            ];
            _state.selections.compiled_states = ['on', 'off'];
          }

          _renderOperatorStep();
        });
      });

    } catch (e) {
      _error(`Could not load device capabilities. Check your Home Assistant connection.`);
      document.getElementById('wizard-retry')?.addEventListener('click', () => {
        _renderCapabilityStep(entityId);
      });
    }
  }

  function _capLabel(cap) {
    if (cap.name === 'state') {
      const dc = cap.device_class;
      return dc ? `State (${dc})` : 'State';
    }
    return cap.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Step 4 — Operator picker ─────────────────────────────
  function _renderOperatorStep() {
    _state.step = 4;
    _showBack(true);
    _showDone(false);

    const attrType = _state.selections.attribute_type || 'unknown';
    const map = CAPABILITY_MAP[attrType] || CAPABILITY_MAP.unknown;
    const isTriggerContext = _state.context === 'trigger';

    const deviceLabel = _state.selections.device_label || '';
    const cap = _state.selections.capability || 'state';
    _setSentence(`${deviceLabel} ${cap}`);

    _setBody(`
      <div class="wizard-step-title">Pick the operator</div>

      <div class="operator-group">
        <div class="operator-group-label"><span class="trigger-icon">⚡</span> Triggers — fire when this happens</div>
        ${map.triggers.map(op => `
          <button class="operator-btn" data-op="${_esc(op)}" data-op-type="trigger">
            <span class="trigger-icon">⚡</span> ${_esc(op)}
          </button>
        `).join('')}
      </div>

      <div class="operator-group">
        <div class="operator-group-label">Conditions — check current state</div>
        ${map.conditions.map(op => `
          <button class="operator-btn" data-op="${_esc(op)}" data-op-type="condition">
            ${_esc(op)}
          </button>
        `).join('')}
      </div>
    `);

    // Pre-select the appropriate group based on context
    if (isTriggerContext) {
      document.querySelector('[data-op-type="trigger"]')?.classList.add('selected');
    }

    document.querySelectorAll('[data-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-op]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        _state.selections.operator = btn.dataset.op;
        _state.selections.operator_group = btn.dataset.opType;
        _state.type = btn.dataset.opType; // 'trigger' or 'condition'

        const opText = btn.dataset.op;
        const sentBase = `${_state.selections.device_label || ''} ${_esc(opText)}`;
        _setSentence(sentBase);

        // For operators needing a value, go to value step
        // For binary "changes (any)" — done immediately
        if (opText === 'changes (any)') {
          _state.selections.display_value = null;
          _state.selections.compiled_value = null;
          _buildConditionAndFinish();
        } else {
          _renderValueStep();
        }
      });
    });
  }

  // ── Step 5 — Value input ─────────────────────────────────
  function _renderValueStep() {
    _state.step = 5;
    _showBack(true);
    _showDone(false);

    const attrType = _state.selections.attribute_type || 'unknown';
    const op = _state.selections.operator || '';

    let html = `<div class="wizard-step-title">Choose the value</div>`;

    if (attrType === 'binary') {
      const labels = _state.selections.display_states || ['On', 'Off'];
      const compiled = _state.selections.compiled_states || ['on', 'off'];
      const isTrigger = _state.selections.operator_group === 'trigger';
      const baseText = op.includes('changes to') ? 'changes to' : 'is';

      html += `<div style="display:flex; flex-direction:column; gap:6px">`;
      labels.forEach((label, i) => {
        html += `
          <button class="operator-btn" data-display="${_esc(label)}" data-compiled="${_esc(compiled[i])}">
            ${_esc(isTrigger ? 'changes to ' + label : 'is ' + label)}
          </button>`;
      });
      html += `</div>`;

    } else if (attrType === 'enum') {
      // Enum — use reported HA states or known options
      const data = _state.selections.capabilities_data;
      const options = data?.capabilities?.find(c => c.name === _state.selections.capability)?.options;
      if (options?.length) {
        html += `<div style="display:flex; flex-direction:column; gap:6px">`;
        options.forEach(opt => {
          html += `<button class="operator-btn" data-display="${_esc(opt)}" data-compiled="${_esc(opt)}">${_esc(opt)}</button>`;
        });
        html += `</div>`;
      } else {
        html += `
          <div style="margin-bottom:8px; font-size:12px; color:var(--text-muted)">Enter the state value:</div>
          <input type="text" id="value-input" style="width:100%" placeholder="e.g. playing, paused, idle..." />
          <button class="btn btn-primary btn-sm mt-3" id="value-confirm">Confirm</button>
        `;
      }

    } else if (attrType === 'numeric' || attrType === 'numeric_position') {
      html += `
        <div style="margin-bottom:8px; font-size:12px; color:var(--text-muted)">Enter the value:</div>
        <input type="number" id="value-input" style="width:200px" placeholder="0" />
        <button class="btn btn-primary btn-sm mt-3" id="value-confirm">Confirm</button>
      `;

    } else if (attrType === 'ha_boolean') {
      html += `<div style="display:flex; flex-direction:column; gap:6px">
        <button class="operator-btn" data-display="True" data-compiled="true">True (on)</button>
        <button class="operator-btn" data-display="False" data-compiled="false">False (off)</button>
      </div>`;

    } else if (attrType === 'location') {
      // Location — would load zones from /api/zones (not yet implemented)
      html += `
        <div style="margin-bottom:8px; font-size:12px; color:var(--text-muted)">Enter zone name or "home":</div>
        <input type="text" id="value-input" style="width:100%" placeholder="home" />
        <button class="btn btn-primary btn-sm mt-3" id="value-confirm">Confirm</button>
      `;

    } else {
      // Fallback text input
      html += `
        <div style="margin-bottom:8px; font-size:12px; color:var(--text-muted)">Enter the value:</div>
        <input type="text" id="value-input" style="width:100%" />
        <button class="btn btn-primary btn-sm mt-3" id="value-confirm">Confirm</button>
      `;
    }

    _setBody(html);

    // Option button selection
    document.querySelectorAll('[data-display]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-display]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        _state.selections.display_value = btn.dataset.display;
        _state.selections.compiled_value = btn.dataset.compiled;
        _setSentence(`${_state.sentence} ${btn.dataset.display}`);
        _buildConditionAndFinish();
      });
    });

    // Free text confirm
    document.getElementById('value-confirm')?.addEventListener('click', () => {
      const val = document.getElementById('value-input')?.value.trim();
      if (!val) return;
      _state.selections.display_value = val;
      _state.selections.compiled_value = val;
      _setSentence(`${_state.sentence} ${val}`);
      _buildConditionAndFinish();
    });

    // Enter key on text input
    document.getElementById('value-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('value-confirm')?.click();
    });
  }

  // ── Step 3b — Service picker (action) ───────────────────
  async function _renderServicePickerStep(entityId) {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setSentence(`${_state.selections.device_label || entityId}...`);
    _loading();

    try {
      const services = await API.getServices(entityId);

      _setBody(`
        <div class="wizard-step-title">What do you want to do?</div>
        <div style="display:flex; flex-direction:column; gap:4px">
          ${services.length
            ? services.map(svc => `
                <button class="operator-btn" data-service="${_esc(svc.service)}" data-label="${_esc(svc.label)}">
                  ${_esc(svc.label)}
                </button>
              `).join('')
            : '<div style="color:var(--text-muted); font-size:13px">No services available for this device.</div>'
          }
        </div>
      `);

      document.querySelectorAll('[data-service]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-service]').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          _state.selections.service = btn.dataset.service;
          _state.selections.service_label = btn.dataset.label;
          _setSentence(`${_state.selections.device_label} → ${btn.dataset.label}`);
          // For now, go directly to done — parameter editor is a v2 feature
          _finishWithNode({
            type: 'service_call',
            entity_id: _state.selections.device_id,
            service: `${entityId.split('.')[0]}.${_state.selections.service}`,
            description: `${_state.selections.service_label} ${_state.selections.device_label}`,
            service_data: {},
          });
        });
      });

    } catch (e) {
      _error(`Could not load services. Check your Home Assistant connection.`);
      document.getElementById('wizard-retry')?.addEventListener('click', () => {
        _renderServicePickerStep(entityId);
      });
    }
  }

  // ── Simple action steps ──────────────────────────────────
  function _renderWaitStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);
    _setSentence('Wait...');

    _setBody(`
      <div class="wizard-step-title">How long to wait?</div>
      <div class="wizard-card-grid">
        <div class="wizard-card" id="wait-duration">
          <div class="wizard-card-title">⏱ Fixed Duration</div>
          <div class="wizard-card-desc">Wait for a specific amount of time (e.g. 5 minutes).</div>
        </div>
        <div class="wizard-card" id="wait-time">
          <div class="wizard-card-title">🕐 Until a Time</div>
          <div class="wizard-card-desc">Wait until a specific time of day (e.g. 11:00 PM).</div>
        </div>
      </div>
      <div id="wait-input-area" style="margin-top:16px"></div>
    `);

    document.getElementById('wait-duration')?.addEventListener('click', () => {
      document.getElementById('wait-duration')?.classList.add('selected');
      document.getElementById('wait-time')?.classList.remove('selected');
      document.getElementById('wait-input-area').innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <input type="number" id="wait-amount" value="5" min="1" style="width:80px" />
          <select id="wait-unit">
            <option value="seconds">seconds</option>
            <option value="minutes" selected>minutes</option>
            <option value="hours">hours</option>
          </select>
          <button class="btn btn-primary btn-sm" id="wait-confirm">Confirm</button>
        </div>
      `;
      _state.selections.wait_type = 'duration';
      _setupWaitConfirm('duration');
    });

    document.getElementById('wait-time')?.addEventListener('click', () => {
      document.getElementById('wait-time')?.classList.add('selected');
      document.getElementById('wait-duration')?.classList.remove('selected');
      document.getElementById('wait-input-area').innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <input type="time" id="wait-time-input" value="23:00" />
          <button class="btn btn-primary btn-sm" id="wait-confirm">Confirm</button>
        </div>
        <div class="banner banner-warn mt-3" style="font-size:12px">
          ⓘ If this piston runs after the target time has already passed today, it will wait until tomorrow.
        </div>
      `;
      _state.selections.wait_type = 'time';
      _setupWaitConfirm('time');
    });
  }

  function _setupWaitConfirm(waitType) {
    document.getElementById('wait-confirm')?.addEventListener('click', () => {
      if (waitType === 'duration') {
        const amount = document.getElementById('wait-amount')?.value || '5';
        const unit = document.getElementById('wait-unit')?.value || 'minutes';
        _finishWithNode({
          type: 'wait',
          wait_type: 'duration',
          duration: `${amount} ${unit}`,
          description: `wait ${amount} ${unit}`,
        });
      } else {
        const time = document.getElementById('wait-time-input')?.value || '00:00';
        _finishWithNode({
          type: 'wait',
          wait_type: 'time',
          time,
          description: `wait until ${time}`,
        });
      }
    });
  }

  function _renderSetVariableStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">Set a variable</div>
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="editor-field-group">
          <label class="editor-field-label">Variable name (without $)</label>
          <input type="text" id="var-name" placeholder="my_variable" style="width:100%" />
        </div>
        <div class="editor-field-group">
          <label class="editor-field-label">Value</label>
          <input type="text" id="var-value" placeholder="value or expression" style="width:100%" />
        </div>
        <button class="btn btn-primary btn-sm" id="var-confirm">Confirm</button>
      </div>
    `);

    document.getElementById('var-confirm')?.addEventListener('click', () => {
      const name = document.getElementById('var-name')?.value.trim();
      const value = document.getElementById('var-value')?.value.trim();
      if (!name) return;
      _finishWithNode({
        type: 'set_variable',
        variable: `$${name}`,
        value,
        description: `Set $${name} = ${value}`,
      });
    });
  }

  function _renderLogStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">Log a message</div>
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="editor-field-group">
          <label class="editor-field-label">Message</label>
          <input type="text" id="log-message" placeholder="Piston started..." style="width:100%" />
        </div>
        <button class="btn btn-primary btn-sm" id="log-confirm">Confirm</button>
      </div>
    `);

    document.getElementById('log-confirm')?.addEventListener('click', () => {
      const msg = document.getElementById('log-message')?.value.trim() || '';
      _finishWithNode({ type: 'log', message: msg, description: `Log: ${msg}` });
    });
  }

  function _renderStopStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">Stop the piston</div>
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="editor-field-group">
          <label class="editor-field-label">Reason (optional)</label>
          <input type="text" id="stop-reason" placeholder="Condition not met" style="width:100%" />
        </div>
        <button class="btn btn-primary btn-sm" id="stop-confirm">Confirm</button>
      </div>
    `);

    document.getElementById('stop-confirm')?.addEventListener('click', () => {
      const reason = document.getElementById('stop-reason')?.value.trim() || '';
      _finishWithNode({ type: 'stop', reason, description: `stop${reason ? ' — ' + reason : ''}` });
    });
  }

  function _renderForEachStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">For Each loop</div>
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="editor-field-group">
          <label class="editor-field-label">Loop variable name (without $)</label>
          <input type="text" id="fe-var" value="device" style="width:100%" />
        </div>
        <div class="editor-field-group">
          <label class="editor-field-label">List to iterate (global variable name without @)</label>
          <input type="text" id="fe-list" placeholder="My_Devices" style="width:100%" />
        </div>
        <button class="btn btn-primary btn-sm" id="fe-confirm">Confirm</button>
      </div>
    `);

    document.getElementById('fe-confirm')?.addEventListener('click', () => {
      const varName = '$' + (document.getElementById('fe-var')?.value.trim() || 'device');
      const list = '@' + (document.getElementById('fe-list')?.value.trim() || 'List');
      _finishWithNode({ type: 'for_each_block', variable: varName, list, actions: [] });
    });
  }

  function _renderCallPistonStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    // Check if current piston is native-script-bound
    const pistons = App.state.pistons || [];

    _setBody(`
      <div class="wizard-step-title">Call another piston</div>
      <div class="banner banner-warn" style="margin-bottom:12px; font-size:12px">
        Waiting for a called piston to finish requires converting this piston to PyScript.
      </div>
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="editor-field-group">
          <label class="editor-field-label">Target piston</label>
          <select id="call-target" style="width:100%">
            ${pistons.map(p => `<option value="${_esc(p.id)}" data-name="${_esc(p.name)}">${_esc(p.name || p.id)}</option>`).join('')}
          </select>
        </div>
        <div class="editor-field-group">
          <label class="editor-field-label">Wait for completion?</label>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-top:4px">
            <input type="checkbox" id="call-wait" />
            <span style="font-size:13px">Wait for this piston to finish before continuing</span>
          </label>
        </div>
        <button class="btn btn-primary btn-sm" id="call-confirm">Confirm</button>
      </div>
    `);

    document.getElementById('call-confirm')?.addEventListener('click', () => {
      const sel = document.getElementById('call-target');
      const targetId = sel?.value;
      const targetName = sel?.selectedOptions[0]?.dataset.name || targetId;
      const wait = document.getElementById('call-wait')?.checked || false;
      _finishWithNode({
        type: 'call_piston',
        target_id: targetId,
        target_name: targetName,
        wait_for_completion: wait,
        description: `Call piston: ${targetName}`,
      });
    });
  }

  function _renderFireEventStep() {
    _state.step = 3;
    _showBack(true);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">Fire a custom event</div>
      <div style="display:flex; flex-direction:column; gap:12px">
        <div class="editor-field-group">
          <label class="editor-field-label">Event name</label>
          <input type="text" id="event-name" placeholder="my_custom_event" style="width:100%" />
        </div>
        <button class="btn btn-primary btn-sm" id="event-confirm">Confirm</button>
      </div>
    `);

    document.getElementById('event-confirm')?.addEventListener('click', () => {
      const name = document.getElementById('event-name')?.value.trim() || '';
      _finishWithNode({ type: 'fire_event', event: name, description: `Fire event: ${name}` });
    });
  }

  function _renderNonDeviceStep(subjectType) {
    _state.step = 2;
    _showBack(true);
    _showDone(false);

    const labels = {
      variable: 'Variable condition',
      time:     'Time condition',
      date:     'Date condition',
      sun:      'Sunrise / Sunset condition',
      ha_system: 'HA System condition',
    };

    // Simplified — these get proper implementation when wizard is expanded
    _setBody(`
      <div class="wizard-step-title">${_esc(labels[subjectType] || subjectType)}</div>
      <div class="banner banner-info" style="font-size:13px">
        ${_esc(labels[subjectType] || subjectType)} wizard steps are coming in a future session.
        For now this will insert a placeholder condition.
      </div>
      <button class="btn btn-primary btn-sm mt-3" id="nondevice-confirm">Insert placeholder</button>
    `);

    document.getElementById('nondevice-confirm')?.addEventListener('click', () => {
      _finishWithNode({
        type: _state.context,
        subject: { type: subjectType },
        operator: 'is',
        display_value: '',
        compiled_value: '',
      });
    });
  }

  // ── Back navigation ──────────────────────────────────────
  function _goBack() {
    const step = _state.step;
    const context = _state.context;

    if (step <= 1 && context !== 'action') {
      _renderConditionOrGroupStep();
    } else if (step <= 1 && context === 'action') {
      _renderActionTypeStep();
    } else if (step === 2) {
      if (context === 'action') {
        _renderActionTypeStep();
      } else {
        _renderSubjectTypeStep();
      }
    } else if (step === 3) {
      if (context === 'action') {
        _renderDevicePickerStep(context);
      } else {
        _renderDevicePickerStep(context);
      }
    } else if (step === 4) {
      _renderCapabilityStep(_state.selections.device_id);
    } else if (step === 5) {
      _renderOperatorStep();
    }
  }

  // ── Finish condition ─────────────────────────────────────
  function _buildConditionAndFinish() {
    const s = _state.selections;
    const node = {
      type: _state.type || _state.selections.operator_group || _state.context,
      subject: {
        type: s.subject_type || 'device',
        role: s.device_id || '',
        capability: s.capability || 'state',
        attribute_type: s.attribute_type || 'unknown',
      },
      aggregation: s.aggregation || null,
      operator: s.operator || '',
      display_value: s.display_value || null,
      compiled_value: s.compiled_value || s.display_value || null,
      duration: null,
      group_operator: 'AND',
    };
    _finishWithNode(node);
  }

  function _finishWithNode(node) {
    if (!node.id) {
      // IDs for conditions use cond_ prefix, actions use stmt_
      const prefix = (node.type === 'condition' || node.type === 'trigger' || node.type === 'group') ? 'cond_' : 'stmt_';
      node.id = prefix + Math.random().toString(36).slice(2, 8);
    }

    close();
    _callbacks.onDone && _callbacks.onDone(node);
  }

  // ── Done button ──────────────────────────────────────────
  function _done() {
    // Done is shown when the wizard has a complete node ready — currently
    // most steps auto-finish. This handles edge cases where Done is explicit.
    if (_state?.selections?.display_value !== undefined) {
      _buildConditionAndFinish();
    }
  }

  // ── Helpers ──────────────────────────────────────────────
  function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { open, close };

})();
