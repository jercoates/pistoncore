// frontend/js/wizard-statement.js
//
// Statement type picker and statement dialog forms.
//
// Entry points (called by editor.js):
//   WizardStatement.openAdd(context)          — add mode, shows type picker page 0
//   WizardStatement.openEdit(node, context)   — edit mode, opens directly on page 1
//
// On commit, calls Editor.insertStatement(context, builtNode) to write into the tree.
// Chaining per §7.4: new IF opens condition dialog; new ACTION opens task dialog.
//
// Node shapes per PISTON_JSON_STRUCTURE_MAP.md §6–27.
// No hardcoded operator lists or capability tables — those live in wizard-core.js.

const WizardStatement = (() => {

  // ── ID generator (mirrors editor.js pattern) ─────────────────────────────
  function _newId(prefix) {
    return (prefix || 'stmt') + '_' + Math.random().toString(36).slice(2, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open in add mode — shows type picker (page 0)
  // context: passed through to Editor.insertStatement on commit
  // ─────────────────────────────────────────────────────────────────────────
  function openAdd(context) {
    const designer = WizardCore.newDesigner({
      isNew:       true,
      page:        0,
      type:        '',
      description: '',
      tep:         '',
      tcp:         '',
      async:       '0',
      disabled:    '0',
      // type-specific fields added when user picks a type
    });

    WizardCore.openDialog(designer, null, null);
    _renderDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open in edit mode — opens directly on page 1 with existing node
  // ─────────────────────────────────────────────────────────────────────────
  function openEdit(node, context) {
    const designer = WizardCore.newDesigner({
      isNew:       false,
      page:        1,
      $node:       node,
      type:        node.type,
      description: node.description || '',
      tep:         node.tep         || '',
      tcp:         node.tcp         || '',
      async:       node.async       ? '1' : '0',
      disabled:    node.disabled    ? '1' : '0',
    });

    _seedTypeFields(designer, node);
    WizardCore.openDialog(designer, null, null);
    _renderDialog(designer, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Seed type-specific designer fields from an existing node (edit mode)
  // ─────────────────────────────────────────────────────────────────────────
  function _seedTypeFields(designer, node) {
    switch (node.type) {
      case 'switch':
        designer.expression     = WizardCore.deepClone(node.expression || {});
        designer.ctp            = node.case_traversal_policy || 'safe';
        break;
      case 'for':
        designer.start          = node.start != null ? String(node.start) : '1';
        designer.end            = node.end   != null ? String(node.end)   : '10';
        designer.step           = node.step  != null ? String(node.step)  : '1';
        designer.counter        = node.counter_variable || '';
        break;
      case 'for_each':
        designer.variable       = node.variable || '';
        designer.role           = node.role || '';
        designer.roleTokens     = (node.role_tokens || []).slice();
        designer.entityIds      = (node.entity_ids  || []).slice();
        break;
      case 'every':
        designer.interval       = node.interval      != null ? String(node.interval) : '5';
        designer.intervalUnit   = node.interval_unit || 'minutes';
        designer.atMinute       = node.at_minute     != null ? String(node.at_minute) : '';
        designer.atTime         = node.at_time       || '';
        designer.onlyOnDays     = (node.only_on_days    || []).slice();
        designer.onlyOnDom      = (node.only_on_dom     || []).slice();
        designer.onlyOnMonths   = (node.only_on_months  || []).slice();
        break;
      case 'exit':
        designer.exitValue      = WizardCore.deepClone(node.value || {});
        break;
      case 'wait':
        designer.waitType       = node.wait_type        || 'duration';
        designer.duration       = node.duration         != null ? String(node.duration) : '';
        designer.durationUnit   = node.duration_unit    || 's';
        designer.durationVar    = node.duration_variable || '';
        designer.until          = node.until            || '';
        break;
      case 'wait_for_state':
        designer.timeoutSeconds = node.timeout_seconds  != null ? String(node.timeout_seconds) : '';
        break;
      case 'log_message':
        designer.level          = node.level   || 'info';
        designer.message        = WizardCore.deepClone(node.message || { type: 'literal', data: '' });
        break;
      case 'set_variable':
        designer.variable       = node.variable || '';
        designer.value          = WizardCore.deepClone(node.value || { type: 'literal', data: '' });
        break;
      case 'call_piston':
        designer.targetPistonId   = node.target_piston_id   || '';
        designer.targetPistonName = node.target_piston_name || '';
        break;
      // if, do, on_event, while, repeat, break, action, cancel_pending_tasks:
      // no extra scalar fields to seed (child arrays are on the live node, not designer)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render the dialog into #wizard-modal based on designer.page
  // ─────────────────────────────────────────────────────────────────────────
  function _renderDialog(designer, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;

    if (designer.page === 0) {
      modal.innerHTML = _buildPage0HTML(designer);
      _bindPage0Events(modal, designer, context);
    } else {
      modal.innerHTML = _buildPage1HTML(designer);
      _bindPage1Events(modal, designer, context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page 0: statement type picker
  // All types shown in one flat list (simple/advanced toggle permanently removed).
  // ─────────────────────────────────────────────────────────────────────────
  function _buildPage0HTML(designer) {
    const { simple, advanced } = WizardCore.STATEMENT_TYPES;

    function _cards(types) {
      return types.map(t => `
        <div class="ws-type-card">
          <div class="ws-card-label">${_esc(t.label)}</div>
          <div class="ws-card-desc">${_esc(t.desc)}</div>
          <button class="btn btn-sm btn-${t.color} ws-type-select" data-type="${_esc(t.type)}">Add ${_esc(t.btn)}</button>
        </div>
      `).join('');
    }

    return `
      <div class="wizard-dialog" id="wizard-statement-dialog">
        <div class="wizard-header">
          <span class="wizard-title">Add a new statement</span>
          <button class="wizard-close btn-icon" id="wizard-statement-cancel">✕</button>
        </div>
        <div class="wizard-body">
          <div class="ws-section-label">Basic statements</div>
          <div class="ws-card-grid">${_cards(simple)}</div>
          <div class="ws-section-label">Advanced statements</div>
          <div class="ws-card-grid">${_cards(advanced)}</div>
        </div>
      </div>
    `;
  }

  function _bindPage0Events(modal, designer, context) {
    modal.querySelector('#wizard-statement-cancel')
      .addEventListener('click', () => WizardCore.closeDialog());


    modal.querySelectorAll('.ws-type-select').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        designer.type = type;
        designer.page = 1;
        _seedTypeDefaults(designer, type);
        _renderDialog(designer, context);
      });
    });
  }

  // Seed blank defaults for type-specific fields when user first picks a type
  function _seedTypeDefaults(designer, type) {
    switch (type) {
      case 'switch':
        designer.expression   = { type: 'expression', expression: '' };
        designer.ctp          = 'safe';
        break;
      case 'for':
        designer.start        = '1';
        designer.end          = '10';
        designer.step         = '1';
        designer.counter      = '';
        break;
      case 'for_each':
        designer.variable     = '';
        designer.role         = '';
        designer.roleTokens   = [];
        designer.entityIds    = [];
        break;
      case 'every':
        designer.interval     = '5';
        designer.intervalUnit = 'minutes';
        designer.atMinute     = '';
        designer.atTime       = '';
        designer.onlyOnDays   = [];
        designer.onlyOnDom    = [];
        designer.onlyOnMonths = [];
        break;
      case 'exit':
        designer.exitValue    = { type: 'literal', data: '' };
        break;
      case 'wait':
        designer.waitType     = 'duration';
        designer.duration     = '5';
        designer.durationUnit = 's';
        designer.durationVar  = '';
        designer.until        = '';
        break;
      case 'wait_for_state':
        designer.timeoutSeconds = '';
        break;
      case 'log_message':
        designer.level        = 'info';
        designer.message      = { type: 'literal', data: '' };
        break;
      case 'set_variable':
        designer.variable     = '';
        designer.value        = { type: 'literal', data: '' };
        break;
      case 'call_piston':
        designer.targetPistonId   = '';
        designer.targetPistonName = '';
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page 1: type-specific form
  // ─────────────────────────────────────────────────────────────────────────
  function _buildPage1HTML(designer) {
    const isNew   = designer.isNew;
    const type    = designer.type;
    const typeInfo = [...WizardCore.STATEMENT_TYPES.simple, ...WizardCore.STATEMENT_TYPES.advanced].find(t => t.type === type) || { label: type };
    const backBtn  = isNew ? `<button class="btn btn-sm btn-secondary" id="ws-back">← Back</button>` : '';

    const typeForm = _buildTypeFormHTML(designer);

    const advancedFields = _buildAdvancedHTML(designer, type);

    return `
      <div class="wizard-dialog" id="wizard-statement-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${isNew ? 'Add' : 'Edit'}: ${typeInfo.label}</span>
          <button class="wizard-close btn-icon" id="ws-cancel">✕</button>
        </div>
        <div class="wizard-body">
          ${typeForm}
          <div class="wv-section">
            <label class="wv-section-label">Description (optional)</label>
            <textarea id="ws-description" class="form-input wv-textarea" rows="3"
              placeholder="Description for this statement">${_esc(designer.description)}</textarea>
          </div>
        </div>
        <div class="wizard-footer">
          ${backBtn}
          <button class="btn btn-sm btn-secondary" id="ws-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="ws-commit">${isNew ? 'Add' : 'Save'}</button>
        </div>
      </div>
    `;
  }

  function _buildTypeFormHTML(designer) {
    switch (designer.type) {
      case 'if':
        return `
          <p class="wizard-info">An IF block is the simplest decisional block available. It allows you to execute different actions depending on conditions you set.</p>
          <div class="wizard-card-grid">
            <div class="wizard-card">
              <div class="wizard-card-title">Condition</div>
              <div class="wizard-card-desc">A condition is a single comparison between two or more operands, the basic building block of a decisional statement</div>
              <button class="btn btn-sm btn-info" id="ws-add-condition">Add a condition</button>
            </div>
            <div class="wizard-card">
              <div class="wizard-card-title">Group</div>
              <div class="wizard-card-desc">A group is a collection of conditions, with a logical operator between them, allowing for complex decisional statements</div>
              <button class="btn btn-sm btn-warning" id="ws-add-group">Add a group</button>
            </div>
          </div>
        `;

      case 'do':
      case 'while':
      case 'repeat':
      case 'on_event':
      case 'break':
      case 'cancel_pending_tasks':
      case 'action':
        return `<p class="wizard-info">No options to configure here. Statements and tasks are added after this step.</p>`;

      case 'every':
        return `
          <label>Interval</label>
          <div class="wizard-row">
            <input type="number" id="ws-interval" class="form-input" min="1" value="${_esc(designer.interval)}">
            <select id="ws-interval-unit" class="form-select">
              ${['ms','s','minutes','hours','days','weeks','months','years'].map(u =>
                `<option value="${u}" ${designer.intervalUnit === u ? 'selected' : ''}>${u}</option>`
              ).join('')}
            </select>
          </div>
          <div id="ws-atminute-row" style="${designer.intervalUnit === 'hours' ? '' : 'display:none'}">
            <label>At minute</label>
            <input type="number" id="ws-atminute" class="form-input" min="0" max="59" value="${_esc(designer.atMinute)}">
          </div>
          <div id="ws-attime-row" style="${['days','weeks','months','years'].includes(designer.intervalUnit) ? '' : 'display:none'}">
            <label>At time</label>
            <input type="time" id="ws-attime" class="form-input" value="${_esc(designer.atTime)}">
          </div>
          <div>
            <label>Only on days of the week</label>
            <div class="wizard-checkbox-row" id="ws-days">
              ${WizardCore.WEEKDAYS.map((d, i) => `
                <label class="wizard-checkbox-label">
                  <input type="checkbox" value="${i+1}" ${(designer.onlyOnDays||[]).includes(i+1) ? 'checked' : ''}> ${d}
                </label>`).join('')}
            </div>
          </div>
        `;

      case 'switch':
        return `
          <label>Switch expression</label>
          <input type="text" id="ws-expression" class="form-input"
            placeholder="e.g. $myVar or expression"
            value="${_esc((designer.expression && designer.expression.expression) || '')}">
          <label>Case traversal</label>
          <select id="ws-ctp" class="form-select">
            <option value="safe"        ${designer.ctp === 'safe'        ? 'selected' : ''}>Safe (auto-break)</option>
            <option value="fallthrough" ${designer.ctp === 'fallthrough' ? 'selected' : ''}>Fallthrough</option>
          </select>
        `;

      case 'for':
        return `
          <label>Loop: for i = <em>start</em> to <em>end</em> step <em>step</em></label>
          <div class="wizard-row">
            <input type="number" id="ws-start" class="form-input" placeholder="Start" value="${_esc(designer.start)}">
            <span>to</span>
            <input type="number" id="ws-end"   class="form-input" placeholder="End"   value="${_esc(designer.end)}">
            <span>step</span>
            <input type="number" id="ws-step"  class="form-input" placeholder="Step"  value="${_esc(designer.step)}">
          </div>
          <label>Counter variable name (optional)</label>
          <input type="text" id="ws-counter" class="form-input" placeholder="e.g. $index" value="${_esc(designer.counter)}">
        `;

      case 'for_each':
        return `
          <label>Counter variable name</label>
          <input type="text" id="ws-variable" class="form-input" placeholder="e.g. $device" value="${_esc(designer.variable)}">
          <label>Device list (role / friendly name)</label>
          <input type="text" id="ws-role" class="form-input" placeholder="Friendly name or variable" value="${_esc(designer.role)}">
          <p class="wizard-hint">The device picker for the full entity list opens in the action dialog when you add tasks.</p>
        `;

      case 'exit':
        return `
          <label>End piston with state (optional)</label>
          <input type="text" id="ws-exit-value" class="form-input"
            placeholder="expression or leave blank"
            value="${_esc((designer.exitValue && designer.exitValue.data) || (designer.exitValue && designer.exitValue.expression) || '')}">
        `;

      case 'wait':
        return `
          <label>Wait type</label>
          <select id="ws-wait-type" class="form-select">
            <option value="duration"          ${designer.waitType === 'duration'          ? 'selected' : ''}>Fixed duration</option>
            <option value="duration_variable" ${designer.waitType === 'duration_variable' ? 'selected' : ''}>Duration from variable</option>
            <option value="until"             ${designer.waitType === 'until'             ? 'selected' : ''}>Until expression is true</option>
          </select>
          <div id="ws-wait-duration" style="${designer.waitType === 'duration' ? '' : 'display:none'}">
            <label>Duration</label>
            <div class="wizard-row">
              <input type="number" id="ws-duration" class="form-input" min="0" value="${_esc(designer.duration)}">
              <select id="ws-duration-unit" class="form-select">
                ${['ms','s','m','h'].map(u =>
                  `<option value="${u}" ${designer.durationUnit === u ? 'selected' : ''}>${{ms:'ms',s:'seconds',m:'minutes',h:'hours'}[u]}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div id="ws-wait-var" style="${designer.waitType === 'duration_variable' ? '' : 'display:none'}">
            <label>Duration variable</label>
            <input type="text" id="ws-duration-var" class="form-input" placeholder="e.g. $WaitTime" value="${_esc(designer.durationVar)}">
          </div>
          <div id="ws-wait-until" style="${designer.waitType === 'until' ? '' : 'display:none'}">
            <label>Until (expression)</label>
            <input type="text" id="ws-until" class="form-input" placeholder="e.g. $device.switch == 'on'" value="${_esc(designer.until)}">
          </div>
        `;

      case 'wait_for_state':
        return `
          <label>Timeout (seconds, optional)</label>
          <input type="number" id="ws-timeout" class="form-input" min="0" placeholder="Leave blank for no timeout" value="${_esc(designer.timeoutSeconds)}">
          <p class="wizard-hint">Add the conditions for this wait block after this step.</p>
        `;

      case 'log_message':
        return `
          <label>Log level</label>
          <select id="ws-level" class="form-select">
            <option value="info"  ${designer.level === 'info'  ? 'selected' : ''}>Info</option>
            <option value="warn"  ${designer.level === 'warn'  ? 'selected' : ''}>Warning</option>
            <option value="error" ${designer.level === 'error' ? 'selected' : ''}>Error</option>
          </select>
          <label>Message</label>
          <input type="text" id="ws-message" class="form-input" placeholder="Log message text"
            value="${_esc((designer.message && designer.message.data) || '')}">
        `;

      case 'set_variable':
        return `
          <label>Variable name</label>
          <input type="text" id="ws-varname" class="form-input" placeholder="e.g. $DoorsOpen" value="${_esc(designer.variable)}">
          <label>Value</label>
          <input type="text" id="ws-varvalue" class="form-input" placeholder="Literal value or expression"
            value="${_esc((designer.value && designer.value.data) || (designer.value && designer.value.expression) || '')}">
        `;

      case 'call_piston':
        return `
          <label>Target piston</label>
          <input type="text" id="ws-piston-name" class="form-input" placeholder="Piston name" value="${_esc(designer.targetPistonName)}">
          <p class="wizard-hint">Type the target piston name. The ID is resolved on save.</p>
        `;

      default:
        return `<p class="wizard-info">Type: ${designer.type}</p>`;
    }
  }

  function _buildAdvancedHTML(designer, type) {
    const noTepTcp = (type === 'on_event');
    const noAsync  = (type === 'every' || type === 'on_event');

    return `
      ${!noTepTcp ? `
        <label>Task execution policy</label>
        <select id="ws-tep" class="form-select">
          <option value=""  ${designer.tep === ''  ? 'selected' : ''}>Default</option>
          <option value="c" ${designer.tep === 'c' ? 'selected' : ''}>Cancel running</option>
          <option value="p" ${designer.tep === 'p' ? 'selected' : ''}>Parallel</option>
          <option value="b" ${designer.tep === 'b' ? 'selected' : ''}>Block</option>
        </select>
        <label>Task cancellation policy</label>
        <select id="ws-tcp" class="form-select">
          <option value=""  ${designer.tcp === ''  ? 'selected' : ''}>Default</option>
          <option value="c" ${designer.tcp === 'c' ? 'selected' : ''}>Cancel</option>
          <option value="p" ${designer.tcp === 'p' ? 'selected' : ''}>Preserve</option>
          <option value="b" ${designer.tcp === 'b' ? 'selected' : ''}>Block</option>
        </select>
      ` : ''}
      ${!noAsync ? `
        <label>Execution mode</label>
        <select id="ws-async" class="form-select">
          <option value="0" ${designer.async === '0' ? 'selected' : ''}>Synchronous</option>
          <option value="1" ${designer.async === '1' ? 'selected' : ''}>Asynchronous</option>
        </select>
      ` : ''}
      <label>Description (optional)</label>
      <input type="text" id="ws-description" class="form-input" placeholder="Description" value="${_esc(designer.description)}">
      <label>Disabled</label>
      <select id="ws-disabled" class="form-select">
        <option value="0" ${designer.disabled === '0' ? 'selected' : ''}>Enabled</option>
        <option value="1" ${designer.disabled === '1' ? 'selected' : ''}>Disabled</option>
      </select>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page 1 event binding
  // ─────────────────────────────────────────────────────────────────────────
  function _bindPage1Events(modal, designer, context) {
    const type = designer.type;

    // Cancel / close
    modal.querySelector('#ws-cancel')
      && modal.querySelector('#ws-cancel').addEventListener('click', () => WizardCore.closeDialog());
    modal.querySelector('#ws-cancel-footer')
      && modal.querySelector('#ws-cancel-footer').addEventListener('click', () => WizardCore.closeDialog());

    // Back button (add mode only)
    const backBtn = modal.querySelector('#ws-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        designer.page = 0;
        designer.type = '';
        _renderDialog(designer, context);
      });
    }

    // Type-specific live bindings
    _bindTypeFields(modal, designer);

    // IF block — card buttons commit the IF and tell the chain which type to open directly
    if (type === 'if') {
      const addCondBtn  = modal.querySelector('#ws-add-condition');
      const addGroupBtn = modal.querySelector('#ws-add-group');
      if (addCondBtn) addCondBtn.addEventListener('click', () => {
        designer._chainSubtype = 'condition';
        _readAdvancedFields(modal, designer, type);
        _commit(designer, context);
      });
      if (addGroupBtn) addGroupBtn.addEventListener('click', () => {
        designer._chainSubtype = 'group';
        _readAdvancedFields(modal, designer, type);
        _commit(designer, context);
      });
    }

    // Commit
    modal.querySelector('#ws-commit').addEventListener('click', () => {
      _readAdvancedFields(modal, designer, type);
      _readTypeFields(modal, designer);
      _commit(designer, context);
    });
  }

  function _bindTypeFields(modal, designer) {
    switch (designer.type) {
      case 'every': {
        const unitSel = modal.querySelector('#ws-interval-unit');
        if (unitSel) {
          unitSel.addEventListener('change', () => {
            designer.intervalUnit = unitSel.value;
            const atMinRow = modal.querySelector('#ws-atminute-row');
            const atTimeRow = modal.querySelector('#ws-attime-row');
            if (atMinRow)  atMinRow.style.display  = (unitSel.value === 'hours') ? '' : 'none';
            if (atTimeRow) atTimeRow.style.display = (['days','weeks','months','years'].includes(unitSel.value)) ? '' : 'none';
          });
        }
        break;
      }
      case 'wait': {
        const waitTypeSel = modal.querySelector('#ws-wait-type');
        if (waitTypeSel) {
          waitTypeSel.addEventListener('change', () => {
            designer.waitType = waitTypeSel.value;
            const durEl  = modal.querySelector('#ws-wait-duration');
            const varEl  = modal.querySelector('#ws-wait-var');
            const untEl  = modal.querySelector('#ws-wait-until');
            if (durEl)  durEl.style.display  = (waitTypeSel.value === 'duration')          ? '' : 'none';
            if (varEl)  varEl.style.display  = (waitTypeSel.value === 'duration_variable') ? '' : 'none';
            if (untEl)  untEl.style.display  = (waitTypeSel.value === 'until')             ? '' : 'none';
          });
        }
        break;
      }
    }
  }

  function _readAdvancedFields(modal, designer, type) {
    const noTepTcp = (type === 'on_event');
    const noAsync  = (type === 'every' || type === 'on_event');

    if (!noTepTcp) {
      const tepEl = modal.querySelector('#ws-tep');
      const tcpEl = modal.querySelector('#ws-tcp');
      if (tepEl) designer.tep = tepEl.value;
      if (tcpEl) designer.tcp = tcpEl.value;
    }
    if (!noAsync) {
      const asyncEl = modal.querySelector('#ws-async');
      if (asyncEl) designer.async = asyncEl.value;
    }
    const descEl = modal.querySelector('#ws-description');
    if (descEl) designer.description = descEl.value.trim();
  }

  function _readTypeFields(modal, designer) {
    switch (designer.type) {
      case 'every': {
        const iv = modal.querySelector('#ws-interval');
        const iu = modal.querySelector('#ws-interval-unit');
        const am = modal.querySelector('#ws-atminute');
        const at = modal.querySelector('#ws-attime');
        if (iv) designer.interval     = iv.value;
        if (iu) designer.intervalUnit = iu.value;
        if (am) designer.atMinute     = am.value;
        if (at) designer.atTime       = at.value;
        const dayChecks = modal.querySelectorAll('#ws-days input[type=checkbox]');
        designer.onlyOnDays = [];
        dayChecks.forEach(cb => { if (cb.checked) designer.onlyOnDays.push(parseInt(cb.value, 10)); });
        break;
      }
      case 'switch': {
        const ex = modal.querySelector('#ws-expression');
        const ct = modal.querySelector('#ws-ctp');
        if (ex) designer.expression = { type: 'expression', expression: ex.value.trim() };
        if (ct) designer.ctp        = ct.value;
        break;
      }
      case 'for': {
        const st = modal.querySelector('#ws-start');
        const en = modal.querySelector('#ws-end');
        const sp = modal.querySelector('#ws-step');
        const co = modal.querySelector('#ws-counter');
        if (st) designer.start   = st.value;
        if (en) designer.end     = en.value;
        if (sp) designer.step    = sp.value;
        if (co) designer.counter = co.value.trim();
        break;
      }
      case 'for_each': {
        const vr = modal.querySelector('#ws-variable');
        const ro = modal.querySelector('#ws-role');
        if (vr) designer.variable = vr.value.trim();
        if (ro) designer.role     = ro.value.trim();
        break;
      }
      case 'exit': {
        const ev = modal.querySelector('#ws-exit-value');
        if (ev) designer.exitValue = ev.value.trim()
          ? { type: 'expression', expression: ev.value.trim() }
          : null;
        break;
      }
      case 'wait': {
        const wt = modal.querySelector('#ws-wait-type');
        const du = modal.querySelector('#ws-duration');
        const duu = modal.querySelector('#ws-duration-unit');
        const dv = modal.querySelector('#ws-duration-var');
        const un = modal.querySelector('#ws-until');
        if (wt) designer.waitType    = wt.value;
        if (du) designer.duration    = du.value;
        if (duu) designer.durationUnit = duu.value;
        if (dv) designer.durationVar  = dv.value.trim();
        if (un) designer.until        = un.value.trim();
        break;
      }
      case 'wait_for_state': {
        const to = modal.querySelector('#ws-timeout');
        if (to) designer.timeoutSeconds = to.value.trim();
        break;
      }
      case 'log_message': {
        const lv = modal.querySelector('#ws-level');
        const mg = modal.querySelector('#ws-message');
        if (lv) designer.level   = lv.value;
        if (mg) designer.message = { type: 'literal', data: mg.value };
        break;
      }
      case 'set_variable': {
        const vn = modal.querySelector('#ws-varname');
        const vv = modal.querySelector('#ws-varvalue');
        if (vn) designer.variable = vn.value.trim();
        if (vv) designer.value    = { type: 'literal', data: vv.value };
        break;
      }
      case 'call_piston': {
        const pn = modal.querySelector('#ws-piston-name');
        if (pn) designer.targetPistonName = pn.value.trim();
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commit — §9.4 Commit Sequence
  // ─────────────────────────────────────────────────────────────────────────
  function _commit(designer, context) {
    // Step 1: autoSave BEFORE writing to live tree (§0.5 Commit Bracket)
    WizardCore.autoSave();

    // Step 2 & 3: build the node from designer
    const node = designer.isNew
      ? _buildNewNode(designer)
      : _applyDesignerToNode(designer);

    // Step 4: clear cached render
    node.$$html = null;

    // Steps 5 & 6: splice into tree and close dialog
    // context may be a string ('action', 'if', ...) for edits,
    // or an object {type, blockId, branch} for branch inserts from the ghost link.
    WizardCore.closeDialog();
    if (typeof Editor !== 'undefined' && Editor.insertStatement) {
      const ctxStr = typeof context === 'object' ? (context.type || 'action') : context;
      const meta   = { chain: _chainFor(designer.type), chainSubtype: designer._chainSubtype || null };
      if (typeof context === 'object') {
        if (context.blockId) meta.blockId = context.blockId;
        if (context.branch)  meta.branch  = context.branch;
      }
      Editor.insertStatement(ctxStr, node, meta);
    }
  }

  // Returns what to open next after committing this type (§7.4 chaining)
  function _chainFor(type) {
    if (type === 'if' || type === 'while' || type === 'repeat' || type === 'on_event' || type === 'wait_for_state') {
      return 'condition';
    }
    if (type === 'action') {
      return 'task';
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build new node from designer (§9.3 new node templates)
  // Shapes from PISTON_JSON_STRUCTURE_MAP.md §6–27
  // ─────────────────────────────────────────────────────────────────────────
  function _buildNewNode(designer) {
    const id      = _newId('stmt');
    const isAsync = designer.async === '1';
    const disabled = designer.disabled === '1';
    const desc    = designer.description || null;

    switch (designer.type) {
      case 'if':
        return {
          type: 'if', id,
          async: isAsync,
          conditions: [], condition_operator: 'and',
          then: [], else_ifs: [], else: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'do':
        return {
          type: 'do', id,
          async: isAsync,
          statements: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'on_event':
        return {
          type: 'on_event', id,
          async: isAsync,
          conditions: [], condition_operator: 'and',
          statements: [],
          description: desc, disabled,
        };

      case 'while':
        return {
          type: 'while', id,
          async: isAsync,
          conditions: [], condition_operator: 'and',
          statements: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'repeat':
        return {
          type: 'repeat', id,
          async: isAsync,
          statements: [],
          until_conditions: [], condition_operator: 'and',
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'every':
        return {
          type: 'every', id,
          async: isAsync,
          interval:      parseInt(designer.interval, 10) || 5,
          interval_unit: designer.intervalUnit || 'minutes',
          at_minute:     designer.atMinute !== '' ? parseInt(designer.atMinute, 10) : null,
          at_time:       designer.atTime   || null,
          only_on_days:  designer.onlyOnDays   || [],
          only_on_dom:   designer.onlyOnDom    || [],
          only_on_months: designer.onlyOnMonths || [],
          statements: [],
          description: desc, disabled,
        };

      case 'switch':
        return {
          type: 'switch', id,
          async: isAsync,
          expression:            designer.expression || { type: 'expression', expression: '' },
          case_traversal_policy: designer.ctp || 'safe',
          cases: [], default: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'for':
        return {
          type: 'for', id,
          async: isAsync,
          start:            parseFloat(designer.start)  || 1,
          end:              parseFloat(designer.end)    || 10,
          step:             parseFloat(designer.step)   || 1,
          counter_variable: designer.counter || null,
          statements: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'for_each':
        return {
          type: 'for_each', id,
          async: isAsync,
          variable:    designer.variable   || '$device',
          role:        designer.role       || '',
          role_tokens: designer.roleTokens || [],
          entity_ids:  designer.entityIds  || [],
          statements: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'break':
        return { type: 'break', id, description: desc, disabled };

      case 'exit':
        return {
          type: 'exit', id,
          value: designer.exitValue || null,
          description: desc, disabled,
        };

      case 'action':
        return {
          type: 'action', id,
          async: isAsync,
          role:        '',
          role_tokens: [],
          entity_ids:  [],
          tasks: [],
          description: desc, disabled,
          tep: designer.tep || null,
          tcp: designer.tcp || null,
        };

      case 'set_variable':
        return {
          type: 'set_variable', id,
          variable: designer.variable || '',
          value:    designer.value    || { type: 'literal', data: '' },
          description: desc, disabled,
        };

      case 'wait': {
        const base = {
          type: 'wait', id,
          wait_type: designer.waitType || 'duration',
          description: desc, disabled,
        };
        if (designer.waitType === 'duration_variable') {
          base.duration_variable = designer.durationVar || '';
          base.duration          = null;
        } else if (designer.waitType === 'until') {
          base.until = designer.until || '';
        } else {
          base.duration      = parseFloat(designer.duration) || 5;
          base.duration_unit = designer.durationUnit || 's';
        }
        return base;
      }

      case 'wait_for_state':
        return {
          type: 'wait_for_state', id,
          conditions: [], condition_operator: 'and',
          timeout_seconds: designer.timeoutSeconds !== ''
            ? parseFloat(designer.timeoutSeconds) : null,
          description: desc, disabled,
        };

      case 'log_message':
        return {
          type: 'log_message', id,
          level:   designer.level   || 'info',
          message: designer.message || { type: 'literal', data: '' },
          description: desc, disabled,
        };

      case 'call_piston':
        return {
          type: 'call_piston', id,
          target_piston_id:   designer.targetPistonId   || null,
          target_piston_name: designer.targetPistonName || '',
          description: desc, disabled,
        };

      case 'cancel_pending_tasks':
        return { type: 'cancel_pending_tasks', id, description: desc, disabled };

      default:
        return { type: designer.type, id, description: desc, disabled };
    }
  }

  // Apply designer fields onto an existing live node (edit mode)
  function _applyDesignerToNode(designer) {
    const node = designer.$node;
    node.description = designer.description || null;
    node.disabled    = designer.disabled === '1';
    if (designer.tep !== undefined) node.tep = designer.tep || null;
    if (designer.tcp !== undefined) node.tcp = designer.tcp || null;
    if (designer.async !== undefined) node.async = designer.async === '1';

    switch (node.type) {
      case 'every':
        node.interval       = parseInt(designer.interval, 10) || 5;
        node.interval_unit  = designer.intervalUnit || 'minutes';
        node.at_minute      = designer.atMinute !== '' ? parseInt(designer.atMinute, 10) : null;
        node.at_time        = designer.atTime   || null;
        node.only_on_days   = designer.onlyOnDays   || [];
        node.only_on_dom    = designer.onlyOnDom    || [];
        node.only_on_months = designer.onlyOnMonths || [];
        break;
      case 'switch':
        node.expression            = designer.expression || {};
        node.case_traversal_policy = designer.ctp || 'safe';
        break;
      case 'for':
        node.start            = parseFloat(designer.start) || 1;
        node.end              = parseFloat(designer.end)   || 10;
        node.step             = parseFloat(designer.step)  || 1;
        node.counter_variable = designer.counter || null;
        break;
      case 'for_each':
        node.variable    = designer.variable   || '';
        node.role        = designer.role       || '';
        break;
      case 'exit':
        node.value = designer.exitValue || null;
        break;
      case 'wait':
        node.wait_type = designer.waitType || 'duration';
        if (designer.waitType === 'duration_variable') {
          node.duration_variable = designer.durationVar || '';
          node.duration          = null;
        } else if (designer.waitType === 'until') {
          node.until = designer.until || '';
        } else {
          node.duration      = parseFloat(designer.duration) || 5;
          node.duration_unit = designer.durationUnit || 's';
        }
        break;
      case 'wait_for_state':
        node.timeout_seconds = designer.timeoutSeconds !== ''
          ? parseFloat(designer.timeoutSeconds) : null;
        break;
      case 'log_message':
        node.level   = designer.level   || 'info';
        node.message = designer.message || { type: 'literal', data: '' };
        break;
      case 'set_variable':
        node.variable = designer.variable || '';
        node.value    = designer.value    || { type: 'literal', data: '' };
        break;
      case 'call_piston':
        node.target_piston_id   = designer.targetPistonId   || null;
        node.target_piston_name = designer.targetPistonName || '';
        break;
    }
    return node;
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
  };

})();
