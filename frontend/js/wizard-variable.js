// pistoncore/frontend/js/wizard-variable.js
// Variable picker dialog — add/edit piston variables.
// Depends on: wizard-core.js (WizardCore must be loaded first)
//
// GAP-S46-1: Delete button added here. Wire to _deleteEditNode when _editNode is set.

function _goVariablePicker() {
  const { _esc, _render, _pushStep, _deleteEditNode, close, _newId } = WizardCore;
  WizardCore.step = 'var';
  _pushStep(_goVariablePicker);
  const _sel     = WizardCore.sel;
  const _editNode = WizardCore.editNode;
  const initType = _sel.initial_value_type || 'nothing';

  const BASIC_TYPES = ['Dynamic','String (text)','Boolean (true/false)','Number (integer)','Number (decimal)','Large number (long)','Date and Time','Date (date only)','Time (time only)','Device'];
  const ADV_TYPES   = ['Dynamic list','String list (text)','Boolean list (true/false)','Number list (integer)','Number list (decimal)','Large number list (long)','Date and Time list','Date list (date only)','Time list (time only)'];

  const warnIcon = initType !== 'nothing' ? '<span class="wiz-initval-warn">&#9650;</span>' : '';

  _render(
    `${_editNode ? 'Edit' : 'Add a new'} variable`,
    `<div class="wiz-compare-row">
       <select id="wiz-vt" class="wiz-select-blue">
         <optgroup label="Basic">${BASIC_TYPES.map(t=>`<option value="${_esc(t)}" ${_sel.var_type===t?'selected':''}>${_esc(t)}</option>`).join('')}</optgroup>
         <optgroup label="Advanced lists">${ADV_TYPES.map(t=>`<option value="${_esc(t)}" ${_sel.var_type===t?'selected':''}>${_esc(t)}</option>`).join('')}</optgroup>
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

     <div class="wiz-var-initval-note">NOTE: By assigning an initial value to the variable, you are instructing the piston to initialize the variable on every run to that initial value. While you can change the value of the variable during a piston run, the variable will revert to its initial value on subsequent piston runs. If you plan on storing data in this variable that needs to persist between piston runs, leave the value as <em>Nothing selected</em>.</div>`,

    `<button class="btn btn-ghost btn-sm" id="wiz-var-cancel">Cancel</button>
     <div class="wiz-footer-right">
       <button class="btn btn-ghost btn-sm" id="wiz-var-cog">⚙</button>
       ${_editNode
         ? `<button class="btn btn-danger btn-sm" id="wiz-var-delete">Delete</button>`
         : `<button class="btn btn-primary btn-sm" id="wiz-var-add">Add more</button>`}
       <button class="btn btn-primary btn-sm" id="wiz-var-done">${_editNode ? 'Save' : 'Add'}</button>
     </div>`
  );

  document.getElementById('wiz-var-cancel')?.addEventListener('click', close);
  document.getElementById('wiz-var-delete')?.addEventListener('click', _deleteEditNode);

  document.getElementById('wiz-vinit-type')?.addEventListener('change', e => {
    WizardCore.sel.initial_value_type = e.target.value;
    WizardCore.sel.initial_value = '';
    WizardCore.sel.var_type = document.getElementById('wiz-vt')?.value || WizardCore.sel.var_type;
    WizardCore.sel.name     = document.getElementById('wiz-vname')?.value || WizardCore.sel.name;
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
      initial_value = WizardCore.sel.initial_device_label || WizardCore.sel.initial_device_id || '';
    } else if (ivType === 'variable') {
      initial_value = WizardCore.sel.initial_variable || '';
    } else {
      initial_value = document.getElementById('wiz-vinit-val')?.value || '';
    }
    const rawType = document.getElementById('wiz-vt')?.value || 'Dynamic';
    return { type:'variable', id:WizardCore.editNode?.id||_newId(), name,
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
    WizardCore.sel = {}; WizardCore.editNode = null;
    _goVariablePicker();
  });
}

function _varInitSubHtml(type) {
  const { _esc } = WizardCore;
  const _sel = WizardCore.sel;
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
      <option value="" style="display:none" disabled>Nothing selected</option>
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
      WizardCore.sel.initial_variable = e.target.value;
    });
  }
}

function _goVarInitDevicePicker() {
  const { _esc, _render, _pushStep, _filterDevices, DEMO_DEVICES } = WizardCore;
  WizardCore.step = 'varinit_dev';
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
    WizardCore.sel.var_type = document.getElementById('wiz-vt')?.value || WizardCore.sel.var_type;
    WizardCore.sel.name     = document.getElementById('wiz-vname')?.value || WizardCore.sel.name;
    _goVariablePicker();
  });

  const render = (q) => {
    const el = document.getElementById('wiz-varinit-devlist');
    if (!el) return;
    const lq = (q||'').toLowerCase();
    const physical = _filterDevices(WizardCore.deviceData).filter(d =>
      !lq || d.friendly_name.toLowerCase().includes(lq) || d.entity_id.toLowerCase().includes(lq)
    );
    const _sel = WizardCore.sel;
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
        WizardCore.sel.initial_device_id    = row.dataset.id;
        WizardCore.sel.initial_device_label = row.dataset.label;
        WizardCore.sel.initial_value_type   = 'device';
        WizardCore.sel.var_type = document.getElementById('wiz-vt')?.value || WizardCore.sel.var_type;
        WizardCore.sel.name     = document.getElementById('wiz-vname')?.value || WizardCore.sel.name;
        _goVariablePicker();
      });
    });
  };

  if (!WizardCore.deviceData) {
    API.getDevices().then(data => { WizardCore.deviceData = data; render(''); }).catch(() => render(''));
  } else {
    render('');
  }

  let ft = null;
  document.getElementById('wiz-varinit-search')?.addEventListener('input', e => {
    clearTimeout(ft);
    ft = setTimeout(() => render(e.target.value.trim()), 150);
  });
}
