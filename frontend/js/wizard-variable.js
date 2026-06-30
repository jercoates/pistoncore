// frontend/js/wizard-variable.js
//
// Three variable dialogs, all spec'd in EDITOR_WIZARD_SPEC.md §9.6:
//
//   WizardVariable.openAdd(context)             — add piston variable (edit-variable)
//   WizardVariable.openEdit(varNode, context)   — edit piston variable (edit-variable)
//   WizardVariable.openGlobalAdd(context)       — add global variable  (edit-global-variable)
//   WizardVariable.openGlobalEdit(gv, context)  — edit global variable (edit-global-variable)
//   WizardVariable.openLocalEdit(v, context)    — edit local var value (edit-local-variable)
//
// Node shape: PISTON_JSON_STRUCTURE_MAP.md §2
// Variable names: stored WITHOUT $ prefix (e.g. "DoorsOpen"); the $ is the runtime-reference
// prefix used in expressions, NOT part of the stored name.

const WizardVariable = (() => {

  // ─────────────────────────────────────────────────────────────────────────
  // Type definitions — drives the type picker.
  // Labels come from the designer; var_type is what the node stores.
  // ─────────────────────────────────────────────────────────────────────────
  const PISTON_VAR_TYPES = [
    { key: 'dynamic',   label: 'Dynamic',        varType: 'dynamic'  },
    { key: 'string',    label: 'Text (string)',   varType: 'string'   },
    { key: 'boolean',   label: 'True/False',      varType: 'boolean'  },
    { key: 'integer',   label: 'Integer number',  varType: 'number'   },
    { key: 'decimal',   label: 'Decimal number',  varType: 'number'   },
    { key: 'datetime',  label: 'Date & Time',     varType: 'datetime' },
    { key: 'device',    label: 'Device',          varType: 'device'   },
  ];

  const GLOBAL_VAR_TYPES = [
    { key: 'dynamic',   label: 'Dynamic',        varType: 'dynamic'  },
    { key: 'string',    label: 'Text (string)',   varType: 'string'   },
    { key: 'boolean',   label: 'True/False',      varType: 'boolean'  },
    { key: 'integer',   label: 'Integer number',  varType: 'number'   },
    { key: 'decimal',   label: 'Decimal number',  varType: 'number'   },
    { key: 'datetime',  label: 'Date & Time',     varType: 'datetime' },
    { key: 'device',    label: 'Device',          varType: 'device'   },
  ];

  function _newId() {
    return 'var_' + Math.random().toString(36).slice(2, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open to add a new piston variable
  // ─────────────────────────────────────────────────────────────────────────
  function openAdd(context) {
    const designer = _newVarDesigner(null);
    WizardCore.openDialog(designer, null, null);
    _renderVarDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open to edit an existing piston variable
  // ─────────────────────────────────────────────────────────────────────────
  function openEdit(varNode, context) {
    const designer        = _newVarDesigner(varNode);
    designer.name         = varNode.name || '';
    designer.varType      = _nodeVarTypeToKey(varNode.var_type);
    designer.initialValue = varNode.initial_value || '';
    designer.description  = varNode.description || '';

    WizardCore.openDialog(designer, null, null);
    _renderVarDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open to add a new global variable
  // ─────────────────────────────────────────────────────────────────────────
  function openGlobalAdd(context) {
    const designer     = _newGlobalDesigner(null);
    WizardCore.openDialog(designer, null, null);
    _renderGlobalDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open to edit an existing global variable
  // ─────────────────────────────────────────────────────────────────────────
  function openGlobalEdit(gv, context) {
    const designer        = _newGlobalDesigner(gv);
    designer.name         = gv.name || '';
    designer.varType      = _nodeVarTypeToKey(gv.var_type);
    designer.initialValue = gv.initial_value || '';

    WizardCore.openDialog(designer, null, null);
    _renderGlobalDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open inline value editor for an already-declared local variable.
  // Name is read-only; user only sets the current value.
  // §9.6: onlyAllowConstants — constant and device-list only, no expressions
  // ─────────────────────────────────────────────────────────────────────────
  function openLocalEdit(varNode, context) {
    const designer        = _newLocalDesigner(varNode);
    designer.name         = varNode.name || '';
    designer.varType      = _nodeVarTypeToKey(varNode.var_type);
    designer.currentValue = varNode.initial_value || '';

    WizardCore.openDialog(designer, null, null);
    _renderLocalDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Designer factories
  // ─────────────────────────────────────────────────────────────────────────
  function _newVarDesigner(varNode) {
    return WizardCore.newDesigner({
      $dialogType:  'var',
      isNew:        !varNode,
      $node:        varNode,
      name:         '',
      varType:      'dynamic',
      initialValue: '',
      assignment:   's',   // 's'=constant; 'd'=dynamic recalculate
      description:  '',
    });
  }

  function _newGlobalDesigner(gv) {
    return WizardCore.newDesigner({
      $dialogType:  'global',
      isNew:        !gv,
      $node:        gv,
      name:         '',
      varType:      'dynamic',
      initialValue: '',
    });
  }

  function _newLocalDesigner(varNode) {
    return WizardCore.newDesigner({
      $dialogType:  'local',
      isNew:        false,
      $node:        varNode,
      name:         varNode ? (varNode.name || '') : '',
      varType:      varNode ? _nodeVarTypeToKey(varNode.var_type) : 'dynamic',
      currentValue: '',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Map a stored var_type back to the designer type key
  // ─────────────────────────────────────────────────────────────────────────
  function _nodeVarTypeToKey(varType) {
    const map = { dynamic:'dynamic', string:'string', boolean:'boolean',
                  number:'integer', datetime:'datetime', device:'device', devices:'device' };
    return map[varType] || 'dynamic';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Map designer type key → stored var_type
  // ─────────────────────────────────────────────────────────────────────────
  function _keyToVarType(key) {
    const map = { dynamic:'dynamic', string:'string', boolean:'boolean',
                  integer:'number', decimal:'number', datetime:'datetime',
                  device:'device', devices:'devices' };
    return map[key] || 'dynamic';
  }

  function _isDeviceType(varType) {
    return varType === 'device' || varType === 'devices';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── DIALOG 1: Piston Variable (edit-variable) ─────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  function _renderVarDialog(designer, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;
    modal.innerHTML = _buildVarHTML(designer);
    _bindVarEvents(modal, designer, context);
  }

  function _buildVarHTML(designer) {
    const isNew     = designer.isNew;
    const isDevice  = _isDeviceType(designer.varType);
    const valueHTML = _buildValueInputHTML(designer, false);
    const assignHTML = !isDevice && designer.initialValue !== '' && designer.varType !== 'dynamic'
      ? `
        <div class="wv-assign-row">
          <label>Assignment</label>
          <select id="wv-assignment" class="form-select">
            <option value="s" ${designer.assignment === 's' ? 'selected' : ''}>Constant — set once</option>
            <option value="d" ${designer.assignment === 'd' ? 'selected' : ''}>Dynamic — evaluate each time</option>
          </select>
        </div>` : '';

    const canCommit = !!designer.name.trim();

    return `
      <div class="wizard-dialog" id="wizard-variable-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${isNew ? 'Add Piston Variable' : 'Edit Piston Variable'}</span>
          <button class="wizard-close btn-icon" id="wv-cancel">✕</button>
        </div>
        <div class="wizard-body">

          <div class="wc-section">
            <label class="wc-section-label">Variable name</label>
            <div class="wizard-row">
              <span class="wv-prefix">$</span>
              <input type="text" id="wv-name" class="form-input" placeholder="VariableName"
                value="${_esc(designer.name)}"
                pattern="[A-Za-z_][A-Za-z0-9_]*"
                title="Letters, digits, underscores — no spaces">
            </div>
          </div>

          <div class="wc-section">
            <label class="wc-section-label">Type</label>
            <select id="wv-type" class="form-select">
              ${PISTON_VAR_TYPES.map(t =>
                `<option value="${t.key}" ${designer.varType === t.key ? 'selected' : ''}>${_esc(t.label)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="wc-section" id="wv-value-section">
            <label class="wc-section-label">Initial value</label>
            ${valueHTML}
            ${assignHTML}
          </div>

          <div class="wizard-advanced-toggle">
            <button class="btn btn-sm btn-link" id="wv-adv-toggle">
              ${designer.showAdvancedOptions ? '▲ Hide advanced' : '▼ Show advanced'}
            </button>
          </div>
          <div id="wv-advanced" style="${designer.showAdvancedOptions ? '' : 'display:none'}">
            <label>Description (optional)</label>
            <input type="text" id="wv-description" class="form-input"
              placeholder="What this variable is for" value="${_esc(designer.description)}">
          </div>
        </div>
        <div class="wizard-footer">
          <button class="btn btn-sm btn-secondary" id="wv-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="wv-commit"
            ${canCommit ? '' : 'disabled'}>${isNew ? 'Add' : 'Save'}</button>
          ${isNew ? `<button class="btn btn-sm btn-success" id="wv-add-more"
            ${canCommit ? '' : 'disabled'}>Add more</button>` : ''}
        </div>
      </div>
    `;
  }

  function _bindVarEvents(modal, designer, context) {
    [modal.querySelector('#wv-cancel'), modal.querySelector('#wv-cancel-footer')]
      .filter(Boolean).forEach(el => el.addEventListener('click', () => WizardCore.closeDialog()));

    modal.querySelector('#wv-adv-toggle').addEventListener('click', () => {
      designer.showAdvancedOptions = !designer.showAdvancedOptions;
      const sec = modal.querySelector('#wv-advanced');
      if (sec) sec.style.display = designer.showAdvancedOptions ? '' : 'none';
      modal.querySelector('#wv-adv-toggle').textContent =
        designer.showAdvancedOptions ? '▲ Hide advanced' : '▼ Show advanced';
    });

    // Name input — live validation to enable/disable buttons
    modal.querySelector('#wv-name').addEventListener('input', e => {
      designer.name = e.target.value;
      _updateVarButtons(modal, designer);
    });

    // Type change — re-render the value section
    modal.querySelector('#wv-type').addEventListener('change', e => {
      designer.varType      = e.target.value;
      designer.initialValue = '';
      _renderVarDialog(designer, context);
    });

    // Commit
    const commitBtn  = modal.querySelector('#wv-commit');
    const addMoreBtn = modal.querySelector('#wv-add-more');

    if (commitBtn && !commitBtn.disabled) {
      commitBtn.addEventListener('click', () => {
        _readVarFields(modal, designer);
        _commitVar(designer, context, false);
      });
    }
    if (addMoreBtn && !addMoreBtn.disabled) {
      addMoreBtn.addEventListener('click', () => {
        _readVarFields(modal, designer);
        _commitVar(designer, context, true);
      });
    }

    _bindValueInputEvents(modal, designer, () => _updateVarButtons(modal, designer));
  }

  function _updateVarButtons(modal, designer) {
    const canCommit = !!designer.name.trim();
    const commit = modal.querySelector('#wv-commit');
    const more   = modal.querySelector('#wv-add-more');
    if (commit) commit.disabled = !canCommit;
    if (more)   more.disabled   = !canCommit;
  }

  function _readVarFields(modal, designer) {
    const nameEl = modal.querySelector('#wv-name');
    if (nameEl) designer.name = nameEl.value.trim();

    const typeEl = modal.querySelector('#wv-type');
    if (typeEl) designer.varType = typeEl.value;

    const descEl = modal.querySelector('#wv-description');
    if (descEl) designer.description = descEl.value.trim();

    const assignEl = modal.querySelector('#wv-assignment');
    if (assignEl) designer.assignment = assignEl.value;

    _readValueInputFields(modal, designer);
  }

  function _commitVar(designer, context, rearm) {
    WizardCore.autoSave();  // §0.5: snapshot BEFORE writing to live tree

    const pistonVars = WizardCore.getPistonVars() || [];

    if (designer.isNew) {
      const varNode = _buildVarNode(designer);
      pistonVars.push(varNode);
    } else if (designer.$node) {
      _applyVarToNode(designer, designer.$node);
    }

    WizardCore.setPistonVars(pistonVars);

    if (rearm) {
      designer.name         = '';
      designer.initialValue = '';
      designer.description  = '';
      designer.varType      = 'dynamic';
      _renderVarDialog(designer, context);
    } else {
      WizardCore.closeDialog();
    }

    if (typeof Editor !== 'undefined' && Editor.refreshDisplay) {
      Editor.refreshDisplay(context);
    }
  }

  function _buildVarNode(designer) {
    const varType     = _keyToVarType(designer.varType);
    const isDeviceT   = _isDeviceType(designer.varType);
    const initialVal  = isDeviceT
      ? (Array.isArray(designer.initialValue) ? designer.initialValue : [designer.initialValue].filter(Boolean))
      : designer.initialValue;

    const node = {
      type:          'variable',
      id:            _newId(),
      name:          designer.name,
      var_type:      varType,
      initial_value: initialVal,
    };

    if (isDeviceT) node.initial_value_type = 'device';
    if (designer.description) node.description = designer.description;

    return node;
  }

  function _applyVarToNode(designer, node) {
    const varType   = _keyToVarType(designer.varType);
    const isDeviceT = _isDeviceType(designer.varType);
    node.name        = designer.name;
    node.var_type    = varType;
    node.initial_value = isDeviceT
      ? (Array.isArray(designer.initialValue) ? designer.initialValue : [designer.initialValue].filter(Boolean))
      : designer.initialValue;
    if (isDeviceT) {
      node.initial_value_type = 'device';
    } else {
      delete node.initial_value_type;
    }
    if (designer.description) {
      node.description = designer.description;
    } else {
      delete node.description;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── DIALOG 2: Global Variable (edit-global-variable) ─────────────────
  // Same structure as piston variable but onlyAllowConstants (§9.6),
  // no assignment field, and validates name uniqueness.
  // ─────────────────────────────────────────────────────────────────────────
  function _renderGlobalDialog(designer, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;
    modal.innerHTML = _buildGlobalHTML(designer);
    _bindGlobalEvents(modal, designer, context);
  }

  function _buildGlobalHTML(designer) {
    const isNew    = designer.isNew;
    const valueHTML = _buildValueInputHTML(designer, true);
    const canCommit = _globalCanCommit(designer);

    return `
      <div class="wizard-dialog" id="wizard-global-variable-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${isNew ? 'Add Global Variable' : 'Edit Global Variable'}</span>
          <button class="wizard-close btn-icon" id="wgv-cancel">✕</button>
        </div>
        <div class="wizard-body">

          <div class="wc-section">
            <label class="wc-section-label">Variable name</label>
            <div class="wizard-row">
              <span class="wv-prefix">@</span>
              <input type="text" id="wgv-name" class="form-input" placeholder="GlobalName"
                value="${_esc(designer.name)}">
            </div>
            <div id="wgv-name-error" class="wc-error" style="display:none">
              A global variable with that name already exists.
            </div>
          </div>

          <div class="wc-section">
            <label class="wc-section-label">Type</label>
            <select id="wgv-type" class="form-select">
              ${GLOBAL_VAR_TYPES.map(t =>
                `<option value="${t.key}" ${designer.varType === t.key ? 'selected' : ''}>${_esc(t.label)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="wc-section">
            <label class="wc-section-label">Value</label>
            ${valueHTML}
          </div>
        </div>
        <div class="wizard-footer">
          <button class="btn btn-sm btn-secondary" id="wgv-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="wgv-commit"
            ${canCommit ? '' : 'disabled'}>${isNew ? 'Add' : 'Save'}</button>
          ${isNew ? `<button class="btn btn-sm btn-success" id="wgv-add-more"
            ${canCommit ? '' : 'disabled'}>Add more</button>` : ''}
        </div>
      </div>
    `;
  }

  function _globalCanCommit(designer) {
    if (!designer.name.trim()) return false;
    // Name uniqueness check
    const globals = WizardCore.getGlobalsData() || [];
    const existing = globals.find(g => g.name === designer.name.trim() && g !== designer.$node);
    if (existing) return false;
    return true;
  }

  function _bindGlobalEvents(modal, designer, context) {
    [modal.querySelector('#wgv-cancel'), modal.querySelector('#wgv-cancel-footer')]
      .filter(Boolean).forEach(el => el.addEventListener('click', () => WizardCore.closeDialog()));

    modal.querySelector('#wgv-name').addEventListener('input', e => {
      designer.name = e.target.value;
      const errEl = modal.querySelector('#wgv-name-error');
      const globals = WizardCore.getGlobalsData() || [];
      const dup = globals.find(g => g.name === designer.name.trim() && g !== designer.$node);
      if (errEl) errEl.style.display = dup ? '' : 'none';
      _updateGlobalButtons(modal, designer);
    });

    modal.querySelector('#wgv-type').addEventListener('change', e => {
      designer.varType      = e.target.value;
      designer.initialValue = '';
      _renderGlobalDialog(designer, context);
    });

    const commitBtn  = modal.querySelector('#wgv-commit');
    const addMoreBtn = modal.querySelector('#wgv-add-more');

    if (commitBtn && !commitBtn.disabled) {
      commitBtn.addEventListener('click', () => {
        _readGlobalFields(modal, designer);
        _commitGlobal(designer, context, false);
      });
    }
    if (addMoreBtn && !addMoreBtn.disabled) {
      addMoreBtn.addEventListener('click', () => {
        _readGlobalFields(modal, designer);
        _commitGlobal(designer, context, true);
      });
    }

    _bindValueInputEvents(modal, designer, () => _updateGlobalButtons(modal, designer));
  }

  function _updateGlobalButtons(modal, designer) {
    const ok     = _globalCanCommit(designer);
    const commit = modal.querySelector('#wgv-commit');
    const more   = modal.querySelector('#wgv-add-more');
    if (commit) commit.disabled = !ok;
    if (more)   more.disabled   = !ok;
  }

  function _readGlobalFields(modal, designer) {
    const nameEl = modal.querySelector('#wgv-name');
    if (nameEl) designer.name = nameEl.value.trim();

    const typeEl = modal.querySelector('#wgv-type');
    if (typeEl) designer.varType = typeEl.value;

    _readValueInputFields(modal, designer);
  }

  function _commitGlobal(designer, context, rearm) {
    WizardCore.autoSave();

    const globals = WizardCore.getGlobalsData() || [];

    if (designer.isNew) {
      const gv = {
        id:       _newId(),
        name:     designer.name,
        var_type: _keyToVarType(designer.varType),
        initial_value: _isDeviceType(designer.varType)
          ? (Array.isArray(designer.initialValue) ? designer.initialValue : [designer.initialValue].filter(Boolean))
          : designer.initialValue,
      };
      if (_isDeviceType(designer.varType)) gv.initial_value_type = 'device';
      globals.push(gv);
    } else if (designer.$node) {
      _applyVarToNode(designer, designer.$node);
    }

    WizardCore.setGlobalsData(globals);

    if (rearm) {
      designer.name         = '';
      designer.initialValue = '';
      designer.varType      = 'dynamic';
      _renderGlobalDialog(designer, context);
    } else {
      WizardCore.closeDialog();
    }

    if (typeof Editor !== 'undefined' && Editor.refreshDisplay) {
      Editor.refreshDisplay(context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── DIALOG 3: Local Variable Inline Edit (edit-local-variable) ────────
  // Only sets the current value. Name read-only in header. onlyAllowConstants.
  // ─────────────────────────────────────────────────────────────────────────
  function _renderLocalDialog(designer, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;
    modal.innerHTML = _buildLocalHTML(designer);
    _bindLocalEvents(modal, designer, context);
  }

  function _buildLocalHTML(designer) {
    const valueHTML = _buildValueInputHTML(designer, true);

    return `
      <div class="wizard-dialog" id="wizard-local-variable-dialog">
        <div class="wizard-header">
          <span class="wizard-title">Edit variable: $${_esc(designer.name)}</span>
          <button class="wizard-close btn-icon" id="wlv-cancel">✕</button>
        </div>
        <div class="wizard-body">
          <div class="wc-section">
            <label class="wc-section-label">Current value</label>
            ${valueHTML}
          </div>
        </div>
        <div class="wizard-footer">
          <button class="btn btn-sm btn-secondary" id="wlv-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="wlv-commit">Save</button>
        </div>
      </div>
    `;
  }

  function _bindLocalEvents(modal, designer, context) {
    [modal.querySelector('#wlv-cancel'), modal.querySelector('#wlv-cancel-footer')]
      .filter(Boolean).forEach(el => el.addEventListener('click', () => WizardCore.closeDialog()));

    const commitBtn = modal.querySelector('#wlv-commit');
    if (commitBtn) {
      commitBtn.addEventListener('click', () => {
        _readValueInputFields(modal, designer, 'currentValue');
        WizardCore.autoSave();
        if (designer.$node) {
          designer.$node.initial_value = designer.currentValue;
        }
        WizardCore.closeDialog();
        if (typeof Editor !== 'undefined' && Editor.refreshDisplay) {
          Editor.refreshDisplay(context);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Shared value input widget (used in all three dialogs) ─────────────
  //
  // onlyConstants=true: only constant value or device picker allowed (§9.6)
  // For device types: device picker with checkboxes
  // For boolean: true/false dropdown
  // For integer/decimal: number input
  // For datetime: datetime-local input
  // For string/dynamic and onlyConstants: plain text
  // ─────────────────────────────────────────────────────────────────────────
  function _buildValueInputHTML(designer, onlyConstants) {
    const vt = designer.varType;

    if (vt === 'device' || vt === 'devices') {
      return _buildDevicePickerHTML(designer);
    }

    if (vt === 'boolean') {
      const cur = String(designer.initialValue);
      return `<select id="wv-value" class="form-select">
        <option value="">— pick a value —</option>
        <option value="true"  ${cur === 'true'  ? 'selected' : ''}>true</option>
        <option value="false" ${cur === 'false' ? 'selected' : ''}>false</option>
      </select>`;
    }

    if (vt === 'integer') {
      return `<input type="number" id="wv-value" class="form-input" step="1"
        value="${_esc(designer.initialValue)}" placeholder="0">`;
    }

    if (vt === 'decimal') {
      return `<input type="number" id="wv-value" class="form-input" step="0.01"
        value="${_esc(designer.initialValue)}" placeholder="0.0">`;
    }

    if (vt === 'datetime') {
      // datetime-local input covers date and time
      return `<input type="datetime-local" id="wv-value" class="form-input"
        value="${_esc(designer.initialValue)}">`;
    }

    // string, dynamic — text input
    return `<input type="text" id="wv-value" class="form-input"
      placeholder="Initial value" value="${_esc(designer.initialValue)}">`;
  }

  function _buildDevicePickerHTML(designer) {
    const deviceData = WizardCore.getDeviceData() || [];
    const deviceMap  = WizardCore.groupEntitiesByDevice(deviceData);
    const selected   = Array.isArray(designer.initialValue)
      ? designer.initialValue
      : (designer.initialValue ? [designer.initialValue] : []);

    if (deviceMap.size === 0) {
      return '<p class="wizard-hint">No devices loaded yet.</p>';
    }

    const rows = [...deviceMap.entries()].map(([, dev]) => {
      const label   = dev.label || 'Unknown device';
      const checked = selected.includes(label);
      return `<label class="wv-device-row${checked ? ' wv-checked' : ''}">
        <input type="checkbox" name="wv-device-pick"
          class="wv-device-input" value="${_esc(label)}" ${checked ? 'checked' : ''}>
        <span>${_esc(label)}</span>
      </label>`;
    }).join('');

    return `
      <input type="text" id="wv-device-search" class="form-input wv-device-search"
        placeholder="Search devices…" autocomplete="off">
      <div class="wv-device-list">${rows}</div>
    `;
  }

  function _bindValueInputEvents(modal, designer, onChange) {
    const simpleInput = modal.querySelector('#wv-value');
    if (simpleInput) {
      simpleInput.addEventListener('change', e => {
        designer.initialValue = e.target.value;
        if (onChange) onChange();
      });
      simpleInput.addEventListener('input', e => {
        designer.initialValue = e.target.value;
        if (onChange) onChange();
      });
    }

    // Device search filter
    const searchEl = modal.querySelector('#wv-device-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        const q = searchEl.value.trim().toLowerCase();
        modal.querySelectorAll('.wv-device-row').forEach(row => {
          const label = row.querySelector('span')?.textContent.toLowerCase() || '';
          row.style.display = q === '' || label.includes(q) ? '' : 'none';
        });
      });
      searchEl.focus();
    }

    // Device checkmark list
    modal.querySelectorAll('.wv-device-input').forEach(el => {
      el.addEventListener('change', () => {
        el.closest('.wv-device-row')?.classList.toggle('wv-checked', el.checked);
        const all = [...modal.querySelectorAll('.wv-device-input:checked')].map(c => c.value);
        designer.initialValue = all;
        if (onChange) onChange();
      });
    });
  }

  function _readValueInputFields(modal, designer, targetProp) {
    const prop = targetProp || 'initialValue';

    const simpleInput = modal.querySelector('#wv-value');
    if (simpleInput) {
      designer[prop] = simpleInput.value;
      return;
    }

    // Device checkmark list
    const deviceInputs = [...modal.querySelectorAll('.wv-device-input')];
    if (deviceInputs.length > 0) {
      designer[prop] = deviceInputs.filter(i => i.checked).map(i => i.value);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    openAdd,
    openEdit,
    openGlobalAdd,
    openGlobalEdit,
    openLocalEdit,
  };

})();
