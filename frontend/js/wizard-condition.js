// pistoncore/frontend/js/wizard-condition.js
// Condition builder, group builder, condition operator editor, commit logic.
// Depends on: wizard-core.js (WizardCore must be loaded first)
//
// sel.tokens — parallel to wizard-action.js: tracks what the user selected
// (physical entity_ids, piston variable names, @global tokens).
// Used to highlight correct rows on re-render and to build role_tokens on the node.
// _getFlatEntityIds(sel.tokens) gives the real entity_ids for intersection.

function _goConditionOrGroup() {
  const { _esc, _render, _pushStep, close } = WizardCore;
  WizardCore.step = 'cog';
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
    WizardCore.sel.statement_class = 'condition';
    _goConditionBuilder();
  });
  document.getElementById('wiz-pick-group')?.addEventListener('click', () => {
    WizardCore.sel.statement_class = 'group';
    _goGroupBuilder();
  });
}

function _goConditionBuilder() {
  const {
    _esc, _render, _pushStep, close,
    isTrigger, NEEDS_VALUE, NEEDS_TWO_VALUES, _needsDuration, _durationLabel,
    CONDITIONS, TRIGGERS, WEEKDAYS, MONTHS,
  } = WizardCore;

  WizardCore.step = 'cond';
  _pushStep(_goConditionBuilder);

  const _sel = WizardCore.sel;
  const op          = _sel.operator || '';
  const hasDevice   = !!_sel.device_id;
  const hasOp       = !!op;
  const needsVal    = NEEDS_VALUE.has(op);
  const needsDur    = _needsDuration(op);
  const needsTwo    = NEEDS_TWO_VALUES.has(op);
  const agg         = _sel.aggregation || 'any';
  const attr        = _sel.attribute || '';
  const interaction = _sel.interaction || 'any';
  const subjType    = _sel.subject_type || 'device';
  const isTimeSubj  = subjType === 'time';

  const backFn = (_sel.statement_class === 'condition' && WizardCore.context !== 'if_condition')
    ? _goConditionOrGroup : null;

  const showInteraction = subjType === 'device' && hasDevice;

  const odw = _sel.time_only_on_days || [];
  const omy = _sel.time_only_on_months || [];

  const daysCheckboxes = WEEKDAYS.map((d,i) =>
    `<label class="wiz-check-label"><input type="checkbox" class="wiz-dow-cb" value="${i+1}" ${odw.includes(i+1)?'checked':''}> ${d}</label>`
  ).join('');
  const monthsCheckboxes = MONTHS.map((m,i) =>
    `<label class="wiz-check-label"><input type="checkbox" class="wiz-moy-cb" value="${i+1}" ${omy.includes(i+1)?'checked':''}> ${m}</label>`
  ).join('');

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
      <option value="" style="display:none" disabled>Select a comparison...</option>
      <optgroup label="⚡ Triggers — fire when this happens">
        ${TRIGGERS.map(t=>`<option value="${_esc(t)}" ${op===t?'selected':''}>⚡ ${_esc(t)}</option>`).join('')}
      </optgroup>
      <optgroup label="Conditions — check current state">
        ${CONDITIONS.map(c=>`<option value="${_esc(c)}" ${op===c?'selected':''}>${_esc(c)}</option>`).join('')}
      </optgroup>
    </select>

    <div id="wiz-value-row" class="${needsVal?'':'hidden'}">
      <div class="wiz-row-label">${needsTwo ? 'Between...' : 'Compare to'}</div>
      <div class="wiz-value-inputs" id="wiz-val-inputs">
        <select id="wiz-val-type" class="wiz-select-blue-sm" style="align-self:flex-start">
          <option value="value">Value</option>
          <option value="variable">Variable</option>
          <option value="expression">Expression</option>
          <option value="argument">Argument</option>
        </select>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
          <span id="wiz-val-widget" style="display:block;width:100%"></span>
          ${needsTwo ? `<span class="wiz-between-and" id="wiz-between-and">...and...</span><span id="wiz-val-widget-2" style="display:block;width:100%"></span>` : ''}
        </div>
      </div>
    </div>

    <div id="wiz-dur-row" class="${needsDur?'':'hidden'}">
      <div class="wiz-row-label" id="wiz-dur-label">${_durationLabel(op)||'For...'}</div>
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

    ${isTimeSubj ? `
    <div class="wiz-row-label" style="margin-top:10px">Only on these days of the week...</div>
    <div class="wiz-check-group" id="wiz-dow-group">${daysCheckboxes}</div>
    <div class="wiz-row-label" style="margin-top:8px">Only on these months of the year...</div>
    <div class="wiz-check-group" id="wiz-moy-group">${monthsCheckboxes}</div>
    ` : ''}

    ${WizardCore.context === 'if_condition' ? `
    <div class="wiz-row-label" style="margin-top:10px">Connect to previous condition with</div>
    <select id="wiz-group-op-selector" class="wiz-select-blue wiz-select-full">
      <option value="and" ${(_sel.group_operator||'and')==='and'?'selected':''}>AND — all conditions must be true</option>
      <option value="or"  ${(_sel.group_operator||'and')==='or' ?'selected':''}>OR — any condition must be true</option>
    </select>` : ''}
    `,
    `
    <div class="wiz-footer-left">
      <button class="btn btn-ghost btn-sm" id="wiz-back-btn">${backFn ? '← Back' : 'Cancel'}</button>
      ${WizardCore.editNode ? '<button class="btn btn-danger btn-sm" id="wiz-cond-del">Delete</button>' : ''}
    </div>
    <div class="wiz-footer-right">
      <button class="btn btn-ghost btn-sm" id="wiz-cog">⚙</button>
      ${!WizardCore.editNode ? `<button class="btn btn-primary btn-sm" id="wiz-add-more" ${hasDevice&&hasOp?'':'disabled'}>Add more</button>` : ''}
      <button class="btn btn-primary btn-sm" id="wiz-add" ${hasDevice&&hasOp?'':'disabled'}>${WizardCore.editNode ? 'Save' : 'Add'}</button>
    </div>
    `
  );

  if (needsVal) _renderValueWidget();
  if (hasDevice && subjType === 'device') _loadCapsIntoSelect();

  document.getElementById('wiz-back-btn')?.addEventListener('click', backFn || close);
  document.getElementById('wiz-cond-del')?.addEventListener('click', WizardCore._deleteEditNode);

  document.getElementById('wiz-subj-type')?.addEventListener('change', e => {
    WizardCore.sel.subject_type = e.target.value;
    _goConditionBuilder();
  });

  document.getElementById('wiz-subj-var')?.addEventListener('change', e => {
    WizardCore.sel.device_id = e.target.value;
    _refreshConditionRows();
  });

  document.getElementById('wiz-subj-time')?.addEventListener('change', e => {
    WizardCore.sel.time_value = e.target.value;
    _refreshConditionRows();
  });

  document.getElementById('wiz-subj-date')?.addEventListener('change', e => {
    WizardCore.sel.date_value = e.target.value;
    _refreshConditionRows();
  });

  document.getElementById('wiz-subj-mode')?.addEventListener('input', e => {
    WizardCore.sel.mode_value = e.target.value;
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
      const fetches = [];
      if (!WizardCore.deviceData) {
        fetches.push(API.getDevices().then(data => { WizardCore.deviceData = data; }).catch(() => {}));
      }
      if (!WizardCore.globalsData) {
        fetches.push(
          API.getGlobals()
            .then(result => { WizardCore.globalsData = Object.values(result || {}); })
            .catch(() => { WizardCore.globalsData = []; })
        );
      }
      if (fetches.length) {
        Promise.all(fetches).then(() => {
          _renderDevPanelList(document.getElementById('wiz-dev-panel-search')?.value || '');
        });
      }
      let ft = null;
      searchEl?.addEventListener('input', e => {
        clearTimeout(ft);
        ft = setTimeout(() => _renderDevPanelList(e.target.value.trim()), 150);
      });
    }
  });

  if (!WizardCore.deviceData) {
    API.getDevices().then(data => { WizardCore.deviceData = data; }).catch(() => {});
  }
  if (!WizardCore.globalsData) {
    API.getGlobals()
      .then(result => { WizardCore.globalsData = Object.values(result || {}); })
      .catch(() => { WizardCore.globalsData = []; });
  }

  document.getElementById('wiz-attr-select')?.addEventListener('change', e => {
    const opt = e.target.selectedOptions[0];
    WizardCore.sel.attribute      = e.target.value;
    WizardCore.sel.attribute_type = opt?.dataset.type || '';
    WizardCore.sel.device_class   = opt?.dataset.class || null;
    _renderValueWidget();
  });

  document.getElementById('wiz-operator')?.addEventListener('change', e => {
    WizardCore.sel.operator = e.target.value;
    _refreshConditionRows();
  });

  document.getElementById('wiz-val-type')?.addEventListener('change', () => _renderValueWidget());
  document.getElementById('wiz-add')?.addEventListener('click', _commitCondition);
  document.getElementById('wiz-add-more')?.addEventListener('click', _commitConditionAndMore);
}

function _renderValueWidget() {
  const { _esc, NEEDS_TWO_VALUES } = WizardCore;
  const _sel = WizardCore.sel;
  const widget = document.getElementById('wiz-val-widget');
  if (!widget) return;
  const valType  = document.getElementById('wiz-val-type')?.value || 'value';
  const attrType = _sel.attribute_type || '';
  const cap      = (_sel._caps||[]).find(c => c.name === _sel.attribute);
  const needsTwo = NEEDS_TWO_VALUES.has(_sel.operator || '');

  if (valType !== 'value') {
    const ph = valType === 'expression' ? 'Expression...' : valType === 'argument' ? 'Argument...' : 'Variable...';
    widget.innerHTML = `<textarea id="wiz-val-1" class="wiz-value-input wiz-expr-inline" placeholder="${ph}" style="width:100%;min-height:100px;resize:vertical;box-sizing:border-box;display:block">${_esc(_sel.value||'')}</textarea>`;
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
      <option value="" style="display:none" disabled>Nothing selected</option>
      ${cap.values.map(v => `<option value="${_esc(v)}" ${_sel.value===v?'selected':''}>${_esc(v)}</option>`).join('')}
    </select>`;
  } else if (attrType === 'numeric') {
    const unit = cap?.unit || '';
    widget.innerHTML = `<input type="number" id="wiz-val-1" class="wiz-value-input wiz-dur-number" value="${_esc(_sel.value||'')}" placeholder="0" />${unit ? `<span style="color:var(--text-muted);font-size:12px;padding-left:4px">${_esc(unit)}</span>` : ''}`;
    const w2 = document.getElementById('wiz-val-widget-2');
    if (w2) w2.innerHTML = `<input type="number" id="wiz-val-2" class="wiz-value-input wiz-dur-number" value="${_esc(_sel.value2||'')}" placeholder="0" />${unit ? `<span style="color:var(--text-muted);font-size:12px;padding-left:4px">${_esc(unit)}</span>` : ''}`;
    return;
  } else {
    widget.innerHTML = `<textarea id="wiz-val-1" class="wiz-value-input wiz-expr-inline" placeholder="Value..." style="width:100%;min-height:100px;resize:vertical;box-sizing:border-box;display:block">${_esc(_sel.value||'')}</textarea>`;
  }

  const w2 = document.getElementById('wiz-val-widget-2');
  if (w2) w2.innerHTML = `<input type="text" id="wiz-val-2" class="wiz-value-input" value="${_esc(_sel.value2||'')}" placeholder="Value..." />`;
}

function _refreshConditionRows() {
  const { NEEDS_VALUE, NEEDS_TWO_VALUES, _needsDuration, _durationLabel, isTrigger } = WizardCore;
  const op = document.getElementById('wiz-operator')?.value || '';
  WizardCore.sel.operator = op;
  const needsVal = NEEDS_VALUE.has(op);
  const needsDur = _needsDuration(op);
  const needsTwo = NEEDS_TWO_VALUES.has(op);

  const subjType = WizardCore.sel.subject_type || 'device';
  let hasSubject = false;
  if (subjType === 'device') {
    hasSubject = !!WizardCore.sel.device_id;
  } else if (subjType === 'variable') {
    hasSubject = !!(document.getElementById('wiz-subj-var')?.value || WizardCore.sel.device_id);
  } else if (subjType === 'time') {
    hasSubject = !!(document.getElementById('wiz-subj-time')?.value || WizardCore.sel.time_value);
  } else if (subjType === 'date') {
    hasSubject = !!(document.getElementById('wiz-subj-date')?.value || WizardCore.sel.date_value);
  } else if (subjType === 'mode') {
    hasSubject = !!(document.getElementById('wiz-subj-mode')?.value || WizardCore.sel.mode_value);
  }

  document.getElementById('wiz-value-row')?.classList.toggle('hidden', !needsVal);
  document.getElementById('wiz-dur-row')?.classList.toggle('hidden', !needsDur);

  const lbl = document.getElementById('wiz-dur-label');
  if (lbl) lbl.textContent = _durationLabel(op) || 'For...';

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

// GAP-S63-3: Condition device panel — accumulates multi-select like the action picker.
// Also resolves pistonvar/global rows at click time for intersection.
function _renderDevPanelList(query) {
  const { _esc, _groupDevices, _filterGrouped, DEMO_DEVICES } = WizardCore;
  const el = document.getElementById('wiz-dev-panel-list');
  if (!el) return;
  const q = query.toLowerCase();
  const _sel = WizardCore.sel;

  const grouped = _filterGrouped(_groupDevices(WizardCore.deviceData), query);
  const allLocals = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
  const localDeviceVars = allLocals.filter(v =>
    v.var_type === 'device' && (!q || v.name.toLowerCase().includes(q))
  );
  const globalDevVars = (WizardCore.globalsData || []).filter(g =>
    g.var_type === 'device' && (!q || (g.name || '').toLowerCase().includes(q) || (`@${g.name}`).toLowerCase().includes(q))
  );
  const filteredDemos = DEMO_DEVICES.filter(d =>
    !q || d.friendly_name.toLowerCase().includes(q)
  );

  // Use sel.tokens to determine which rows are highlighted
  const selTokens = new Set(_sel.tokens || (_sel.device_id ? [_sel.device_id] : []));

  let html = '';
  if (grouped.length) {
    html += `<div class="wiz-device-group-header">Physical devices</div>`;
    html += grouped.slice(0, 150).map(d => {
      const ids = d.entity_ids || [d.primary_entity_id];
      const isSelected = ids.some(id => selTokens.has(id));
      return `<div class="wiz-device-row ${isSelected ? 'selected' : ''}"
        data-id="${_esc(ids.join(','))}"
        data-label="${_esc(d.friendly_name)}"
        data-row-type="physical">
        <span class="wiz-dev-label">${_esc(d.friendly_name)}</span>
      </div>`;
    }).join('');
  }
  if (localDeviceVars.length) {
    html += `<div class="wiz-device-group-header">Piston variables</div>`;
    html += localDeviceVars.map(v =>
      `<div class="wiz-device-row ${selTokens.has(v.name) ? 'selected' : ''}"
        data-id="${_esc(v.name)}"
        data-label="${_esc(v.name)}"
        data-row-type="pistonvar">
        <span class="wiz-dev-prefix">device</span>
        <span class="wiz-dev-label">${_esc(v.name)}</span>
      </div>`
    ).join('');
  }
  if (globalDevVars.length) {
    html += `<div class="wiz-device-group-header">Global variables</div>`;
    html += globalDevVars.map(g => {
      const gtoken = `@${g.name}`;
      return `<div class="wiz-device-row ${selTokens.has(gtoken) ? 'selected' : ''}"
        data-id="${_esc(gtoken)}"
        data-label="${_esc(gtoken)}"
        data-row-type="global">
        <span class="wiz-dev-prefix">global</span>
        <span class="wiz-dev-label">${_esc(gtoken)}</span>
      </div>`;
    }).join('');
  }
  html += `<div class="wiz-device-group-header">Demo devices</div>`;
  if (filteredDemos.length) {
    html += filteredDemos.map(d =>
      `<div class="wiz-device-row ${selTokens.has(d.entity_id) ? 'selected' : ''} wiz-demo-row"
        data-id="${_esc(d.entity_id)}"
        data-label="${_esc(d.friendly_name)}"
        data-row-type="physical">
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
      const label   = row.dataset.label;
      // Physical rows carry all entity_ids for the device comma-separated.
      // Variable and global rows carry a single token (name or @name).
      const rowIds = row.dataset.id.split(',').filter(Boolean);

      // GAP-S63-3: toggle-accumulate, not replace.
      row.classList.toggle('selected');
      const newTokens = new Set(WizardCore.sel.tokens || []);

      if (row.classList.contains('selected')) {
        rowIds.forEach(id => newTokens.add(id));
      } else {
        rowIds.forEach(id => newTokens.delete(id));
      }

      WizardCore.sel.tokens = [...newTokens];

      // Collect labels from all selected rows
      const allLabels = [...el.querySelectorAll('.wiz-device-row.selected')]
        .map(r => r.dataset.label).filter(Boolean);

      // device_label: friendly role string built from token labels (not entity count)
      let deviceLabel;
      if (allLabels.length === 0) {
        deviceLabel = '';
      } else if (allLabels.length === 1) {
        deviceLabel = allLabels[0];
      } else if (allLabels.length === 2) {
        deviceLabel = `${allLabels[0]} and ${allLabels[1]}`;
      } else if (allLabels.length === 3) {
        deviceLabel = `${allLabels[0]}, ${allLabels[1]} and ${allLabels[2]}`;
      } else {
        deviceLabel = `${allLabels[0]} +${allLabels.length - 1}`;
      }

      WizardCore.sel.device_label = deviceLabel;
      // Fix 4: explicitly clear device_id when nothing selected so
      // _refreshConditionRows sees no subject and disables Add correctly.
      WizardCore.sel.device_id    = WizardCore.sel.tokens.length ? WizardCore.sel.tokens[0] : '';
      WizardCore.sel.attribute    = '';
      WizardCore.sel.attribute_type = '';
      WizardCore.sel._caps = [];

      // Update the picker button label
      const btn = document.getElementById('wiz-open-devpicker');
      if (btn) {
        if (WizardCore.sel.tokens.length) {
          btn.innerHTML = `<span class="wiz-device-tag">device</span> ${_esc(deviceLabel)}`;
          btn.classList.add('has-value');
        } else {
          btn.innerHTML = 'Nothing selected';
          btn.classList.remove('has-value');
        }
      }

      const aggBar = document.getElementById('wiz-agg-bar');
      if (aggBar) aggBar.style.display = WizardCore.sel.tokens.length ? '' : 'none';

      const intRow = document.getElementById('wiz-int-row');
      if (intRow && (WizardCore.sel.subject_type || 'device') === 'device') {
        intRow.style.display = WizardCore.sel.tokens.length ? '' : 'none';
      }

      const attrSel = document.getElementById('wiz-attr-select');
      if (attrSel) {
        if (WizardCore.sel.tokens.length) {
          attrSel.disabled = false;
          attrSel.innerHTML = `<option value="">loading...</option>`;
          _loadCapsIntoSelect();
        } else {
          attrSel.disabled = true;
          attrSel.innerHTML = `<option value="">attribute...</option>`;
        }
      }

      _refreshConditionRows();
    });
  });
}

// Capability intersection for condition picker.
// Resolves sel.tokens → one primary_entity_id per physical device, fetches caps
// for each device, intersects. Only attributes shared across ALL selected devices shown.
// Uses _getPrimaryIdsForTokens (not _getFlatEntityIds) so device variables resolve
// to one cap lookup per device, not one per sub-entity.
async function _loadCapsIntoSelect() {
  const { _esc, DEMO_DEVICES, _getCapsForDomain, _getPrimaryIdsForTokens } = WizardCore;
  const _sel = WizardCore.sel;
  const sel = document.getElementById('wiz-attr-select');
  if (!sel) return;

  sel.innerHTML = '<option value="">loading...</option>';
  sel.disabled = true;

  let caps = [];

  // Ensure deviceData is loaded — _getPrimaryIdsForTokens needs it to resolve
  // friendly names → device groups → primary_entity_id.
  if (!WizardCore.deviceData) {
    try {
      const data = await API.getDevices();
      WizardCore.deviceData = data;
    } catch(e) {}
  }

  // Resolve tokens → one primary_entity_id per physical device.
  // This is the correct input for capability intersection: one device = one cap set.
  const tokens     = _sel.tokens || (_sel.device_id ? [_sel.device_id] : []);
  const primaryIds = _getPrimaryIdsForTokens(tokens);

  // Demo device shortcut
  const demo = DEMO_DEVICES.find(d => primaryIds.length === 1 && d.entity_id === primaryIds[0]);
  if (demo) {
    caps = demo.capabilities;

  } else if (!primaryIds.length) {
    WizardCore.sel._caps = [];
    sel.innerHTML = '<option value="">No devices available — check variable assignments</option>';
    sel.disabled = true;
    return;

  } else {
    // Fetch capabilities for each device's primary entity in parallel.
    // One fetch per physical device — not per sub-entity.
    const allResults = await Promise.all(primaryIds.map(async id => {
      try {
        const data = await API.getCapabilities(id);
        return data.capabilities || [];
      } catch(e) {
        return _getCapsForDomain(id);
      }
    }));

    // Intersection: only keep caps present across ALL devices.
    if (allResults.length === 1) {
      caps = allResults[0];
    } else {
      let intersectedNames = new Set(allResults[0].map(c => c.name));
      for (let i = 1; i < allResults.length; i++) {
        const thisSet = new Set(allResults[i].map(c => c.name));
        for (const name of intersectedNames) {
          if (!thisSet.has(name)) intersectedNames.delete(name);
        }
      }
      caps = allResults[0].filter(c => intersectedNames.has(c.name));
    }

    // If intersection produced nothing, fall back to domain map for the first primary
    if (!caps.length) {
      caps = _getCapsForDomain(primaryIds[0]);
    }
  }

  WizardCore.sel._caps = caps;
  sel.innerHTML = '<option value="">attribute...</option>' +
    caps.map(c => `<option value="${_esc(c.name)}" data-type="${_esc(c.attribute_type||'')}" data-class="${_esc(c.device_class||'')}" ${_sel.attribute===c.name?'selected':''}>${_esc(c.name)}</option>`).join('');
  sel.disabled = false;

  // Restore device_class from prior attribute selection if still valid
  if (_sel.attribute) {
    const opt = sel.querySelector(`option[value="${CSS.escape(_sel.attribute)}"]`);
    if (opt) WizardCore.sel.device_class = opt.dataset.class || null;
  }
}

function _goGroupBuilder() {
  const { _esc, _render, _pushStep, _newId, close } = WizardCore;
  WizardCore.step = 'group';
  _pushStep(_goGroupBuilder);
  const existingOp = WizardCore.sel.group_condition_operator || 'and';

  _render(
    'Add a new group',
    `<div class="wiz-desc">A group is a collection of conditions, connected with a logical operator. Groups can be nested inside other groups.</div>
     <div class="wiz-row-label">Group logical operator</div>
     <select id="wiz-grp-op" class="wiz-select-blue wiz-select-full">
       <option value="and" ${existingOp==='and'?'selected':''}>Logical AND — all conditions must be true</option>
       <option value="or"  ${existingOp==='or' ?'selected':''}>Logical OR — any condition must be true</option>
     </select>`,
    `<button class="btn btn-ghost btn-sm" id="wiz-grp-back">← Back</button>
     <div class="wiz-footer-right">
       <button class="btn btn-primary btn-sm" id="wiz-grp-save">Add a group</button>
     </div>`
  );

  document.getElementById('wiz-grp-back')?.addEventListener('click', _goConditionOrGroup);
  document.getElementById('wiz-grp-save')?.addEventListener('click', () => {
    const op = document.getElementById('wiz-grp-op')?.value || 'and';
    const node = {
      id: WizardCore.editNode?.id || _newId(),
      type: 'condition',
      is_group: true,
      group_operator: op,
      conditions: [],
      description: null,
    };
    const ctx = WizardCore.context;
    const blockId = WizardCore.extra?.['block-id'];
    const meta = blockId ? { blockId } : {};
    close();
    Editor.insertStatement(ctx, node, meta);
  });
}

function _goConditionOperatorEditor() {
  const { _render, _pushStep, close } = WizardCore;
  WizardCore.step = 'condop';
  const blockId  = WizardCore.extra?.['block-id'] || null;
  const currentOp = WizardCore.extra?.['condition-operator'] || WizardCore.sel.condition_operator || 'and';

  _render(
    'Edit condition group',
    `<div class="wiz-desc">Choose how the conditions in this block connect to each other.</div>
     <div class="wiz-row-label">Logical Operator</div>
     <select id="wiz-condop-op" class="wiz-select-blue wiz-select-full">
       <option value="and" ${currentOp === 'and' ? 'selected' : ''}>Logical AND — all conditions must be true</option>
       <option value="or"  ${currentOp === 'or'  ? 'selected' : ''}>Logical OR — any condition must be true</option>
     </select>`,
    `<button class="btn btn-ghost btn-sm" id="wiz-condop-cancel">Cancel</button>
     <div class="wiz-footer-right">
       <button class="btn btn-primary btn-sm" id="wiz-condop-save">Save</button>
     </div>`
  );

  document.getElementById('wiz-condop-cancel')?.addEventListener('click', close);
  document.getElementById('wiz-condop-save')?.addEventListener('click', () => {
    const op = document.getElementById('wiz-condop-op')?.value || 'and';
    if (blockId && Editor.updateConditionOperator) {
      Editor.updateConditionOperator(blockId, op);
    }
    close();
  });
}

function _commitCondition() {
  const { _newId, close } = WizardCore;
  const node = _buildConditionNode();
  if (!node) return;

  const ctx     = WizardCore.context;
  const blockId = WizardCore.extra?.['block-id'] || null;

  if (ctx === 'if_condition' || (ctx === 'trigger_or_condition' && blockId)) {
    const meta = blockId ? { blockId } : {};
    close();
    Editor.insertStatement(ctx, node, meta);
  } else {
    const ifBlockId = blockId || _newId();
    const ifNode = {
      type: 'if', id: ifBlockId, async: false,
      conditions: [node], condition_operator: 'and',
      then: [], else_ifs: [], else: [],
      description: null, disabled: false,
    };
    close();
    Editor.insertStatement(ctx, ifNode);
  }
}

function _commitConditionAndMore() {
  const { _newId } = WizardCore;
  const node = _buildConditionNode();
  if (!node) return;

  const ctx     = WizardCore.context;
  const blockId = WizardCore.extra?.['block-id'] || null;

  if (ctx === 'if_condition' || (ctx === 'trigger_or_condition' && blockId)) {
    const meta = blockId ? { blockId } : {};
    Editor.insertStatement(ctx, node, meta);
    WizardCore.sel = { statement_class: 'condition', group_operator: 'and' };
  } else {
    const ifBlockId = blockId || _newId();
    const ifNode = {
      type: 'if', id: ifBlockId, async: false,
      conditions: [node], condition_operator: 'and',
      then: [], else_ifs: [], else: [],
      description: null, disabled: false,
    };
    Editor.insertStatement(ctx, ifNode);
    WizardCore.sel = { statement_class: 'condition' };
    WizardCore.context = 'if_condition';
    WizardCore.extra = { 'block-id': ifBlockId };
  }
  WizardCore.editNode = null;
  WizardCore.stepStack = [];
  _goConditionBuilder();
}

// _buildConditionNode — writes the condition node to piston JSON.
//
// role:        friendly label derived from token labels (not entity count).
// role_tokens: the raw tokens the user selected — preserved for edit round-trip.
// entity_ids:  resolved flat entity_ids at commit time via _getFlatEntityIds.
function _buildConditionNode() {
  const { _condId, isTrigger, _needsDuration, NEEDS_TWO_VALUES, _getFlatEntityIds } = WizardCore;
  const _sel = WizardCore.sel;
  const op = document.getElementById('wiz-operator')?.value || _sel.operator || '';
  const subjType = _sel.subject_type || 'device';

  let role = '';
  let entity_ids = [];
  let role_tokens = [];

  if (subjType === 'device') {
    role        = _sel.device_label || _sel.device_id || '';
    role_tokens = (_sel.tokens || []).filter(Boolean);
    // Resolve tokens → flat real entity_ids at commit time
    entity_ids  = _getFlatEntityIds(role_tokens);
    if (!entity_ids.length && _sel.device_id && !_sel.device_id.startsWith('__')) {
      entity_ids = [_sel.device_id];
    }
  } else if (subjType === 'variable') {
    role = document.getElementById('wiz-subj-var')?.value || _sel.device_id || '';
    entity_ids = [];
  } else if (subjType === 'time') {
    role = 'time';
    entity_ids = [];
  } else if (subjType === 'date') {
    role = 'date';
    entity_ids = [];
  } else if (subjType === 'mode') {
    role = 'mode';
    entity_ids = [];
  }

  if (!role || !op) return null;

  const attrSel  = document.getElementById('wiz-attr-select');
  const attrVal  = attrSel ? attrSel.value : (_sel.attribute || '');
  const attrType = attrSel
    ? (attrSel.selectedOptions[0]?.dataset.type || '')
    : (_sel.attribute_type || '');
  const deviceClass = attrSel
    ? (attrSel.selectedOptions[0]?.dataset.class || _sel.device_class || null)
    : (_sel.device_class || null);

  const rawVal1 = document.getElementById('wiz-val-1')?.value || '';
  const rawVal2 = document.getElementById('wiz-val-2')?.value || '';
  const isBinary = attrType === 'binary';
  const BINARY_COMPILED = {
    open:'on', closed:'off', detected:'on', clear:'off',
    active:'on', inactive:'off', wet:'on', dry:'off',
    home:'on', away:'off', locked:'off', unlocked:'on',
    on:'on', off:'off', true:'on', false:'off',
  };
  const compiledVal1 = isBinary
    ? (BINARY_COMPILED[rawVal1.toLowerCase()] ?? rawVal1)
    : rawVal1;

  const needsDur  = _needsDuration(op);
  const durAmount = needsDur ? (parseInt(document.getElementById('wiz-dur-amount')?.value || '1') || 1) : null;
  const durUnit   = needsDur ? (document.getElementById('wiz-dur-unit')?.value || 'minutes') : null;

  const groupOpEl = document.getElementById('wiz-group-op-selector');
  const groupOp   = groupOpEl ? groupOpEl.value : 'and';

  const odw = subjType === 'time'
    ? [...document.querySelectorAll('.wiz-dow-cb:checked')].map(cb => parseInt(cb.value))
    : (_sel.time_only_on_days || []);
  const omy = subjType === 'time'
    ? [...document.querySelectorAll('.wiz-moy-cb:checked')].map(cb => parseInt(cb.value))
    : (_sel.time_only_on_months || []);

  const node = {
    id:             WizardCore.editNode?.id || _condId(),
    is_trigger:     isTrigger(op),
    role,
    role_tokens,                       // preserved for edit round-trip
    entity_ids,                        // resolved flat HA entity_ids
    attribute:      attrVal,
    attribute_type: attrType,
    device_class:   deviceClass,
    aggregation:    document.getElementById('wiz-agg')?.value || _sel.aggregation || 'any',
    operator:       op,
    display_value:  rawVal1,
    compiled_value: compiledVal1,
    value_to:       rawVal2 || null,
    duration:       durAmount,
    duration_unit:  durUnit,
    interaction:    document.getElementById('wiz-interaction')?.value || 'any',
    group_operator: groupOp,
  };

  if (subjType === 'time') {
    node.only_on_days   = odw;
    node.only_on_months = omy;
  }

  return node;
}
