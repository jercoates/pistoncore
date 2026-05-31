// pistoncore/frontend/js/wizard-loops.js
// For loop, For Each loop, Switch, Exit, Timer pickers.
// Depends on: wizard-core.js (WizardCore must be loaded first)

function _goForPicker() {
  const { _esc, _render, _pushStep, _newId, close } = WizardCore;
  WizardCore.step = 'for';
  _pushStep(_goForPicker);
  const _sel = WizardCore.sel;
  const pistonVars = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
    .filter(v => ['integer','decimal','dynamic'].includes(v.var_type));
  const isNew = !WizardCore.editNode;

  _render('Add a for loop',
    `<div class="wiz-desc">A FOR loop is an iteration block that allows you to repeat the same action for a preset number of times. You can optionally use a counter variable that will be updated to reflect the current iteration index.</div>
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
       <button class="btn btn-primary btn-sm" id="wiz-for-save">${isNew ? 'Add a statement' : 'Save'}</button>
     </div>`
  );

  document.getElementById('wiz-for-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);
  document.getElementById('wiz-for-save')?.addEventListener('click', () => {
    const blockId = WizardCore.extra?.['block-id'];
    const branch  = WizardCore.extra?.['branch'] || 'then';
    const meta = blockId ? { blockId, branch } : undefined;
    const node = {
      type:'for', id:WizardCore.editNode?.id || _newId(), async:false,
      start:   parseInt(document.getElementById('wiz-for-start')?.value||'1') || 1,
      end:     parseInt(document.getElementById('wiz-for-end')?.value||'10') || 10,
      step:    parseInt(document.getElementById('wiz-for-step')?.value||'1') || 1,
      counter_variable: document.getElementById('wiz-for-counter')?.value || null,
      statements:[], description:null, disabled:false,
    };
    close();
    Editor.insertStatement(WizardCore.context, node, meta);
  });
}

function _goForEachPicker() {
  const { _esc, _render, _pushStep, _newId, close, _groupDevices, _filterGrouped } = WizardCore;
  WizardCore.step = 'for_each';
  _pushStep(_goForEachPicker);
  const _sel = WizardCore.sel;
  const pistonDevVars = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
    .filter(v => v.var_type === 'device');
  const isNew = !WizardCore.editNode;

  // sel.fe_tokens tracks what the user selected for the device list.
  // Same model as action/condition pickers: variable name, @global, or primary_entity_id.
  if (!_sel.fe_tokens) {
    // On edit, restore from list_role if it was a variable name or token.
    // On new, start empty.
    _sel.fe_tokens = _sel.list_role ? [_sel.list_role] : [];
  }

  _render('Add a for each loop',
    `<div class="wiz-desc">A FOR EACH loop is an iteration block that allows you to repeat the same action for each device in a device list</div>
     <div class="wiz-row-label">Counter variable (optional)</div>
     <div class="wiz-value-inputs">
       <select id="wiz-fe-var" class="wiz-select-blue" style="flex:1">
         <option value="$device" ${(_sel.variable||'$device')==='$device'?'selected':''}>$device (system default)</option>
         ${pistonDevVars.map(v=>`<option value="${_esc(v.name)}" ${_sel.variable===v.name?'selected':''}>${_esc(v.name)} (${_esc(v.var_type)})</option>`).join('')}
         <option value="__custom__">Type a name...</option>
       </select>
       <input type="text" id="wiz-fe-var-custom" class="wiz-value-input" placeholder="Variable name..." style="display:none;flex:1" value="${_esc(_sel.variable||'')}" />
     </div>
     <div class="wiz-row-label" style="margin-top:10px">List of devices</div>
     <div class="wiz-selected-bar" id="wiz-fe-sel-bar" style="${_sel.fe_tokens.length ? '' : 'display:none'}">
       <span id="wiz-fe-sel-label">${_esc(_sel.fe_tokens.join(', '))}</span>
     </div>
     <div style="display:flex;gap:8px;margin:4px 0">
       <button class="btn btn-ghost btn-xs" id="wiz-fe-sel-all">Select All</button>
       <button class="btn btn-ghost btn-xs" id="wiz-fe-desel-all">Deselect All</button>
     </div>
     <input type="text" id="wiz-fe-search" placeholder="Search devices..." autocomplete="off"
       style="width:100%;background:var(--bg-input,var(--bg-raised));border:1px solid var(--border-subtle);border-radius:3px;color:var(--text-primary);font-size:13px;outline:none;padding:4px 6px;margin-bottom:4px;box-sizing:border-box" />
     <div class="wiz-device-list" id="wiz-fe-devlist">
       <div class="wiz-loading"><div class="spinner"></div></div>
     </div>`,
    `<button class="btn btn-ghost btn-sm" id="wiz-fe-back">← Back</button>
     <div class="wiz-footer-right"><button class="btn btn-primary btn-sm" id="wiz-fe-save">${isNew ? 'Add a statement' : 'Save'}</button></div>`
  );

  document.getElementById('wiz-fe-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);

  document.getElementById('wiz-fe-var')?.addEventListener('change', e => {
    const custom = document.getElementById('wiz-fe-var-custom');
    if (custom) custom.style.display = e.target.value === '__custom__' ? '' : 'none';
  });

  let _ft = null;
  document.getElementById('wiz-fe-search')?.addEventListener('input', e => {
    clearTimeout(_ft);
    _ft = setTimeout(() => _renderFeDevList(e.target.value.trim()), 200);
  });

  document.getElementById('wiz-fe-sel-all')?.addEventListener('click', () => {
    const rows = document.querySelectorAll('#wiz-fe-devlist .wiz-device-row');
    rows.forEach(r => {
      r.classList.add('selected');
      r.dataset.id.split(',').filter(Boolean).forEach(id => {
        if (!WizardCore.sel.fe_tokens.includes(id)) WizardCore.sel.fe_tokens.push(id);
      });
    });
    _updateFeSelBar();
  });

  document.getElementById('wiz-fe-desel-all')?.addEventListener('click', () => {
    document.querySelectorAll('#wiz-fe-devlist .wiz-device-row').forEach(r => r.classList.remove('selected'));
    WizardCore.sel.fe_tokens = [];
    _updateFeSelBar();
  });

  document.getElementById('wiz-fe-save')?.addEventListener('click', () => {
    const varSel    = document.getElementById('wiz-fe-var')?.value || '$device';
    const varCustom = document.getElementById('wiz-fe-var-custom')?.value || '';
    const variable  = varSel === '__custom__' ? varCustom : varSel;

    // list_role: store the first token (variable name or @global) as a friendly label.
    // entity_ids: resolve tokens → flat entity_ids now, at commit time. No attribute
    // filter — for_each iterates the full device list so all entity_ids are correct.
    // This satisfies the load-bearing rule: nodes store entity_ids, not role names.
    const tokens = WizardCore.sel.fe_tokens || [];
    const list_role = tokens.length === 1 ? tokens[0] : tokens.join(', ');
    const entity_ids = WizardCore._getFlatEntityIds(tokens);

    const blockId = WizardCore.extra?.['block-id'];
    const branch  = WizardCore.extra?.['branch'] || 'then';
    const meta = blockId ? { blockId, branch } : undefined;
    const node = {
      type:'for_each', id:WizardCore.editNode?.id || _newId(), async:false,
      variable: variable || '$device',
      role: list_role,
      list_role,
      role_tokens: tokens,
      entity_ids,
      statements:[], description:null, disabled:false,
    };
    close();
    Editor.insertStatement(WizardCore.context, node, meta);
  });

  // Load devices then render
  _loadFeDevices();

  function _loadFeDevices() {
    const fetches = [];
    if (!WizardCore.deviceData) {
      fetches.push(API.getDevices().then(d => { WizardCore.deviceData = d; }).catch(() => {}));
    }
    if (!WizardCore.globalsData) {
      fetches.push(
        API.getGlobals()
          .then(result => { WizardCore.globalsData = Object.values(result || {}); })
          .catch(() => { WizardCore.globalsData = []; })
      );
    }
    if (fetches.length) {
      Promise.all(fetches).then(() => _renderFeDevList(''));
    } else {
      _renderFeDevList('');
    }
  }

  function _renderFeDevList(query) {
    const el = document.getElementById('wiz-fe-devlist');
    if (!el) return;
    const selTokens = new Set(WizardCore.sel.fe_tokens || []);
    const grouped = _filterGrouped(_groupDevices(WizardCore.deviceData), query);
    const q = query.toLowerCase();
    const allLocals = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
      .filter(v => v.var_type === 'device' && (!q || v.name.toLowerCase().includes(q)));
    const globalDevVars = (WizardCore.globalsData || [])
      .filter(g => g.var_type === 'device' && (!q || (g.name||'').toLowerCase().includes(q)));

    let html = '';

    if (grouped.length) {
      html += `<div class="wiz-device-group-header">Physical devices</div>`;
      html += grouped.slice(0,150).map(d => {
        const ids = d.entity_ids || [d.primary_entity_id];
        const isSel = ids.some(id => selTokens.has(id));
        return `<div class="wiz-device-row ${isSel?'selected':''}"
          data-id="${_esc(ids.join(','))}"
          data-label="${_esc(d.friendly_name)}"
          data-row-type="physical">
          <span class="wiz-dev-label">${_esc(d.friendly_name)}</span>
        </div>`;
      }).join('');
    }

    if (allLocals.length) {
      html += `<div class="wiz-device-group-header">Piston variables</div>`;
      html += allLocals.map(v =>
        `<div class="wiz-device-row ${selTokens.has(v.name)?'selected':''}"
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
        return `<div class="wiz-device-row ${selTokens.has(gtoken)?'selected':''}"
          data-id="${_esc(gtoken)}"
          data-label="${_esc(gtoken)}"
          data-row-type="global">
          <span class="wiz-dev-prefix">global</span>
          <span class="wiz-dev-label">${_esc(gtoken)}</span>
        </div>`;
      }).join('');
    }

    if (!html) {
      html = `<div class="wiz-empty" style="padding:8px 12px">No devices found.</div>`;
    }

    el.innerHTML = html;

    el.querySelectorAll('.wiz-device-row').forEach(row => {
      row.addEventListener('click', () => {
        const rowIds = row.dataset.id.split(',').filter(Boolean);
        row.classList.toggle('selected');
        const newTokens = new Set(WizardCore.sel.fe_tokens || []);
        if (row.classList.contains('selected')) {
          rowIds.forEach(id => newTokens.add(id));
        } else {
          rowIds.forEach(id => newTokens.delete(id));
        }
        WizardCore.sel.fe_tokens = [...newTokens];
        _updateFeSelBar();
      });
    });
  }

  function _updateFeSelBar() {
    const tokens = WizardCore.sel.fe_tokens || [];
    const bar = document.getElementById('wiz-fe-sel-bar');
    const lbl = document.getElementById('wiz-fe-sel-label');
    if (bar) bar.style.display = tokens.length ? '' : 'none';
    if (lbl) lbl.textContent = tokens.join(', ');
  }
}

function _goSwitchPicker() {
  const { _esc, _render, _pushStep, _newId, close } = WizardCore;
  WizardCore.step = 'switch';
  _pushStep(_goSwitchPicker);
  const _sel = WizardCore.sel;
  const existingExpr = _sel.switch_expression?.expression || _sel.switch_expression?.data || '';
  const isNew = !WizardCore.editNode;

  _render('Add a switch block',
    `<div class="wiz-desc">A SWITCH block is a decisional block designed to compare an expression against a list of possible values and execute actions depending on their matching.</div>
     <div class="wiz-row-label">Expression</div>
     <textarea id="wiz-switch-expr" class="wiz-expr-area" placeholder="e.g. $myVariable or an expression...">${_esc(existingExpr)}</textarea>
     ${!isNew ? `
     <div class="wiz-row-label" style="margin-top:10px">Case Traversal Policy</div>
     <select id="wiz-switch-ctp" class="wiz-select-blue wiz-select-full">
       <option value="safe" ${(_sel.switch_ctp||'safe')==='safe'?'selected':''}>Safe (auto-break after matching a case) (default)</option>
       <option value="fallthrough" ${(_sel.switch_ctp||'')==='fallthrough'?'selected':''}>Fall-through (programmer style)</option>
     </select>` : ''}`,
    `<button class="btn btn-ghost btn-sm" id="wiz-switch-back">← Back</button>
     <div class="wiz-footer-right">
       <button class="btn btn-primary btn-sm" id="wiz-switch-save">${isNew ? 'Add a case' : 'Save'}</button>
     </div>`
  );

  document.getElementById('wiz-switch-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);
  document.getElementById('wiz-switch-save')?.addEventListener('click', () => {
    const expr = document.getElementById('wiz-switch-expr')?.value.trim() || '';
    const ctp  = document.getElementById('wiz-switch-ctp')?.value || 'safe';
    const blockId = WizardCore.extra?.['block-id'];
    const branch  = WizardCore.extra?.['branch'] || 'then';
    const meta = blockId ? { blockId, branch } : undefined;
    const node = {
      type:'switch', id:WizardCore.editNode?.id || _newId(), async:false,
      expression: expr ? { type:'expression', expression: expr } : null,
      case_traversal_policy: ctp,
      cases:[], default:[],
      description:null, disabled:false,
    };
    close();
    Editor.insertStatement(WizardCore.context, node, meta);
  });
}

function _goExitPicker() {
  const { _esc, _render, _pushStep, _newId, close } = WizardCore;
  WizardCore.step = 'exit';
  _pushStep(_goExitPicker);
  const _editNode = WizardCore.editNode;
  const existingVal = _editNode?.value?.data !== undefined ? String(_editNode.value.data) :
                      _editNode?.value?.expression || '';
  const isNew = !_editNode;

  _render('Add an exit',
    `<div class="wiz-desc">Return causes the piston to end the evaluation stage and set the piston state to the value provided.</div>
     <div class="wiz-row-label">New piston state</div>
     <input type="text" id="wiz-exit-val" class="wiz-value-input" placeholder="Leave blank for default..." value="${_esc(existingVal)}" />`,
    `<button class="btn btn-ghost btn-sm" id="wiz-exit-back">← Back</button>
     <div class="wiz-footer-right">
       <button class="btn btn-primary btn-sm" id="wiz-exit-save">${isNew ? 'Add' : 'Save'}</button>
     </div>`
  );

  document.getElementById('wiz-exit-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);
  document.getElementById('wiz-exit-save')?.addEventListener('click', () => {
    const val = document.getElementById('wiz-exit-val')?.value.trim() || '';
    const blockId = WizardCore.extra?.['block-id'];
    const branch  = WizardCore.extra?.['branch'] || 'then';
    const meta = blockId ? { blockId, branch } : undefined;
    const node = {
      type:'exit', id:WizardCore.editNode?.id || _newId(),
      value: val ? { type:'expression', expression: val } : null,
      description:null, disabled:false,
    };
    close();
    Editor.insertStatement(WizardCore.context, node, meta);
  });
}

function _goTimerPicker() {
  const { _esc, _render, _pushStep, _newId, close, WEEKDAYS, MONTHS } = WizardCore;
  WizardCore.step = 'timer';
  _pushStep(_goTimerPicker);
  const _sel = WizardCore.sel;
  const isNew = !WizardCore.editNode;

  const unit = _sel.interval_unit || 'minutes';
  const odw  = _sel.only_on_days    || [];
  const omy  = _sel.only_on_months  || [];

  const dowHtml = WEEKDAYS.map((d,i) =>
    `<label class="wiz-check-label"><input type="checkbox" class="wiz-timer-dow" value="${i}" ${odw.includes(i)?'checked':''}> ${d}</label>`
  ).join('');
  const moyHtml = MONTHS.map((m,i) =>
    `<label class="wiz-check-label"><input type="checkbox" class="wiz-timer-moy" value="${i+1}" ${omy.includes(i+1)?'checked':''}> ${m}</label>`
  ).join('');

  const showHours  = ['milliseconds','seconds','minutes'].includes(unit);
  const showAtMin  = unit === 'hours';
  const showAtTime = !['milliseconds','seconds','minutes','hours'].includes(unit);

  _render('Add a timer',
    `<div class="wiz-desc">Timers trigger piston runs at regular intervals.</div>
     <div class="wiz-row-label">Every...</div>
     <div class="wiz-duration-inputs">
       <input type="number" id="wiz-timer-n" class="wiz-dur-number" value="${_sel.interval||5}" min="1" />
       <select id="wiz-timer-u" class="wiz-select-blue-sm">
         <option value="milliseconds" ${unit==='milliseconds'?'selected':''}>milliseconds</option>
         <option value="seconds"      ${unit==='seconds'     ?'selected':''}>seconds</option>
         <option value="minutes"      ${unit==='minutes'     ?'selected':''}>minutes</option>
         <option value="hours"        ${unit==='hours'       ?'selected':''}>hours</option>
         <option value="days"         ${unit==='days'        ?'selected':''}>days</option>
         <option value="weeks"        ${unit==='weeks'       ?'selected':''}>weeks</option>
         <option value="months"       ${unit==='months'      ?'selected':''}>months</option>
         <option value="years"        ${unit==='years'       ?'selected':''}>years</option>
       </select>
     </div>
     ${showAtMin ? `
     <div class="wiz-row-label" style="margin-top:10px">At this minute of the hour...</div>
     <input type="number" id="wiz-timer-atmin" class="wiz-value-input wiz-dur-number" min="0" max="59" value="${_esc(String(_sel.at_minute??0))}" />` : ''}
     ${showAtTime ? `
     <div class="wiz-row-label" style="margin-top:10px">At this time...</div>
     <input type="time" id="wiz-timer-attime" class="wiz-value-input" value="${_esc(_sel.at_time||'00:00')}" style="width:140px" />` : ''}
     <div class="wiz-row-label" style="margin-top:10px">Only on these days of the week...</div>
     <div class="wiz-check-group">${dowHtml}</div>
     <div class="wiz-row-label" style="margin-top:8px">Only on these months of the year...</div>
     <div class="wiz-check-group">${moyHtml}</div>`,
    `<button class="btn btn-ghost btn-sm" id="wiz-timer-back">← Back</button>
     <div class="wiz-footer-right"><button class="btn btn-primary btn-sm" id="wiz-timer-save">${isNew ? 'Add a statement' : 'Save'}</button></div>`
  );

  document.getElementById('wiz-timer-u')?.addEventListener('change', e => {
    WizardCore.sel.interval_unit = e.target.value;
    WizardCore.sel.interval = parseInt(document.getElementById('wiz-timer-n')?.value||'5');
    _goTimerPicker();
  });

  document.getElementById('wiz-timer-back')?.addEventListener('click', isNew ? _goStatementTypePicker : close);
  document.getElementById('wiz-timer-save')?.addEventListener('click', () => {
    const blockId  = WizardCore.extra?.['block-id'];
    const branch   = WizardCore.extra?.['branch'] || 'then';
    const meta     = blockId ? { blockId, branch } : undefined;
    const selUnit  = document.getElementById('wiz-timer-u')?.value || 'minutes';
    const node = {
      type:'every', id:WizardCore.editNode?.id || _newId(), async:false,
      interval:      parseInt(document.getElementById('wiz-timer-n')?.value||'5'),
      interval_unit: selUnit,
      at_minute:  showAtMin  ? (parseInt(document.getElementById('wiz-timer-atmin')?.value||'0') || 0) : null,
      at_time:    showAtTime ? (document.getElementById('wiz-timer-attime')?.value || null) : null,
      only_on_days:   [...document.querySelectorAll('.wiz-timer-dow:checked')].map(cb => parseInt(cb.value)),
      only_on_dom:    [],
      only_on_months: [...document.querySelectorAll('.wiz-timer-moy:checked')].map(cb => parseInt(cb.value)),
      statements:[], description:null, disabled:false,
    };
    close();
    Editor.insertStatement(WizardCore.context, node, meta);
  });
}
