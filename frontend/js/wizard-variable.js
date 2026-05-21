// pistoncore/frontend/js/wizard-variable.js
// Variable picker dialog — add/edit piston variables.
// Depends on: wizard-core.js (WizardCore must be loaded first)
//
// GAP-S46-1: Delete button added here. Wire to _deleteEditNode when _editNode is set.
// G-2b: Device initial value stores array of entity_id strings.
//       WizardCore.sel.initial_device_ids (array) replaces initial_device_id / initial_device_label.
//       _goVarInitDevicePicker: checkboxes, SelectAll/DeselectAll, Confirm button.
//       Three-section list: physical devices, local device variables, global device variables.

function _goVariablePicker() {
  const { _esc, _render, _pushStep, _deleteEditNode, close, _newId } = WizardCore;
  WizardCore.step = 'var';
  _pushStep(_goVariablePicker);
  const _sel     = WizardCore.sel;
  const _editNode = WizardCore.editNode;
  const initType = _sel.initial_value_type || 'nothing';

  // Normalize device selection — old format may have stored a single string
  // in initial_value instead of an array in initial_device_ids.
  if (initType === 'device' && !Array.isArray(_sel.initial_device_ids)) {
    if (Array.isArray(_sel.initial_value)) {
      _sel.initial_device_ids = _sel.initial_value;
    } else if (_sel.initial_value && typeof _sel.initial_value === 'string') {
      _sel.initial_device_ids = [_sel.initial_value];
    } else if (_sel.initial_device_id) {
      _sel.initial_device_ids = [_sel.initial_device_id];
    } else {
      _sel.initial_device_ids = [];
    }
  }

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
    WizardCore.sel.initial_device_ids = [];
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
      // Store as array of entity_id strings — matches globals.js device value schema
      initial_value = Array.isArray(WizardCore.sel.initial_device_ids)
        ? WizardCore.sel.initial_device_ids
        : [];
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
    const ids = Array.isArray(_sel.initial_device_ids) ? _sel.initial_device_ids : [];
    const label = ids.length
      ? `${ids.length} device${ids.length !== 1 ? 's' : ''} selected`
      : 'Select devices...';
    const hasVal = ids.length > 0;
    return `<button class="wiz-device-pick-btn ${hasVal ? 'has-value' : ''}" id="wiz-vinit-devbtn">
      ${hasVal ? `<span class="wiz-device-tag">device</span> ${_esc(label)}` : label}
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
      // Snapshot current field values before navigating away
      WizardCore.sel.var_type = document.getElementById('wiz-vt')?.value || WizardCore.sel.var_type;
      WizardCore.sel.name     = document.getElementById('wiz-vname')?.value || WizardCore.sel.name;
      _goVarInitDevicePicker();
    });
  }
  if (type === 'variable') {
    document.getElementById('wiz-vinit-varsel')?.addEventListener('change', e => {
      WizardCore.sel.initial_variable = e.target.value;
    });
  }
}

// ── Device multi-select picker ───────────────────────────────────────────────
// Three sections: physical devices, local device variables, global device variables.
// Checkboxes + SelectAll/DeselectAll (physical devices only) + search + Confirm button.
// WizardCore.sel.initial_device_ids holds the committed array of entity_id strings.
// WizardCore.deviceData and WizardCore.globalsData are cached after first fetch.

function _goVarInitDevicePicker() {
  const { _esc, _render, _pushStep, _filterDevices } = WizardCore;
  WizardCore.step = 'varinit_dev';
  _pushStep(_goVarInitDevicePicker);

  // Working copy of selection — committed only when user hits Confirm
  const committed = Array.isArray(WizardCore.sel.initial_device_ids)
    ? WizardCore.sel.initial_device_ids
    : [];
  const selected = new Set(committed);

  _render('Select devices',
    `<div class="wiz-varinit-dev-panel">
       <input type="text" id="wiz-varinit-search" class="wiz-varinit-dev-filter"
         placeholder="Search devices..." autocomplete="off" />
       <div class="wiz-varinit-sel-actions">
         <button class="btn-ghost wiz-varinit-sel-all" id="wiz-varinit-sel-all">Select All</button>
         <button class="btn-ghost wiz-varinit-sel-none" id="wiz-varinit-sel-none">Deselect All</button>
       </div>
       <div class="wiz-device-list" id="wiz-varinit-devlist"></div>
     </div>
     <div class="wiz-varinit-summary" id="wiz-varinit-summary">${_devSummaryText(selected)}</div>`,
    `<button class="btn btn-ghost btn-sm" id="wiz-varinit-back">← Back</button>
     <div class="wiz-footer-right">
       <button class="btn btn-primary btn-sm" id="wiz-varinit-confirm">Confirm</button>
     </div>`
  );

  // Confirm — commit selection and return to variable picker
  document.getElementById('wiz-varinit-confirm')?.addEventListener('click', () => {
    WizardCore.sel.initial_device_ids = Array.from(selected);
    WizardCore.sel.initial_value_type = 'device';
    _goVariablePicker();
  });

  // Back — discard changes
  document.getElementById('wiz-varinit-back')?.addEventListener('click', () => {
    _goVariablePicker();
  });

  // SelectAll / DeselectAll — physical devices only (not variables/globals)
  document.getElementById('wiz-varinit-sel-all')?.addEventListener('click', () => {
    const q = document.getElementById('wiz-varinit-search')?.value || '';
    _physicalDevices(q).forEach(d => selected.add(d.entity_id));
    _renderRows(selected, q);
    _updateSummary(selected);
  });

  document.getElementById('wiz-varinit-sel-none')?.addEventListener('click', () => {
    const q = document.getElementById('wiz-varinit-search')?.value || '';
    _physicalDevices(q).forEach(d => selected.delete(d.entity_id));
    _renderRows(selected, q);
    _updateSummary(selected);
  });

  // Search
  let ft = null;
  document.getElementById('wiz-varinit-search')?.addEventListener('input', e => {
    clearTimeout(ft);
    ft = setTimeout(() => _renderRows(selected, e.target.value.trim()), 150);
  });

  // Load data then render — both devices and globals may need fetching
  _ensureData().then(() => _renderRows(selected, ''));

  // ── Helpers scoped to this picker ─────────────────────────

  function _physicalDevices(query) {
    const lq = (query || '').toLowerCase();
    const all = _filterDevices ? _filterDevices(WizardCore.deviceData) : (WizardCore.deviceData || []);
    if (!lq) return all;
    return all.filter(d =>
      (d.friendly_name || '').toLowerCase().includes(lq) ||
      (d.entity_id     || '').toLowerCase().includes(lq)
    );
  }

  function _localDeviceVars(query) {
    const lq = (query || '').toLowerCase();
    const all = (Editor.getPistonVariables ? Editor.getPistonVariables() : [])
      .filter(v => v.var_type === 'device');
    if (!lq) return all;
    return all.filter(v => v.name.toLowerCase().includes(lq));
  }

  function _globalDeviceVars(query) {
    const lq = (query || '').toLowerCase();
    const globals = WizardCore.globalsData || [];
    const all = globals.filter(g => g.var_type === 'device');
    if (!lq) return all;
    return all.filter(g =>
      (g.name || '').toLowerCase().includes(lq) ||
      (`@${g.name}` || '').toLowerCase().includes(lq)
    );
  }

  function _renderRows(selected, query) {
    const list = document.getElementById('wiz-varinit-devlist');
    if (!list) return;

    const physical = _physicalDevices(query);
    const locals   = _localDeviceVars(query);
    const globals  = _globalDeviceVars(query);

    if (!physical.length && !locals.length && !globals.length) {
      list.innerHTML = `<div class="wiz-empty">No devices found.</div>`;
      return;
    }

    let html = '';

    if (physical.length) {
      html += `<div class="wiz-device-group-header">Physical devices</div>`;
      html += physical.slice(0, 150).map(d => {
        const eid   = _esc(d.entity_id);
        const label = _esc(d.friendly_name || d.entity_id);
        const sel   = selected.has(d.entity_id);
        return `<div class="wiz-varinit-dev-row ${sel ? 'selected' : ''}" data-id="${eid}">
          <span class="wiz-dev-label">${label}</span>
          <span class="wiz-dev-entity-id">${eid}</span>
          <span class="wiz-dev-check">${sel ? '✓' : ''}</span>
        </div>`;
      }).join('');
    }

    if (locals.length) {
      html += `<div class="wiz-device-group-header">Local variables</div>`;
      html += locals.map(v => {
        const vid = _esc(v.name);
        const sel = selected.has(v.name);
        return `<div class="wiz-varinit-dev-row ${sel ? 'selected' : ''}" data-id="${vid}">
          <span class="wiz-device-tag">device</span>
          <span class="wiz-dev-label">${vid}</span>
          <span class="wiz-dev-check">${sel ? '✓' : ''}</span>
        </div>`;
      }).join('');
    }

    if (globals.length) {
      html += `<div class="wiz-device-group-header">Global variables</div>`;
      html += globals.map(g => {
        const gid = _esc(`@${g.name}`);
        const sel = selected.has(`@${g.name}`);
        return `<div class="wiz-varinit-dev-row ${sel ? 'selected' : ''}" data-id="${gid}">
          <span class="wiz-device-tag">device</span>
          <span class="wiz-dev-label">${gid}</span>
          <span class="wiz-dev-check">${sel ? '✓' : ''}</span>
        </div>`;
      }).join('');
    }

    list.innerHTML = html;

    list.querySelectorAll('.wiz-varinit-dev-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (selected.has(id)) {
          selected.delete(id);
          row.classList.remove('selected');
          row.querySelector('.wiz-dev-check').textContent = '';
        } else {
          selected.add(id);
          row.classList.add('selected');
          row.querySelector('.wiz-dev-check').textContent = '✓';
        }
        _updateSummary(selected);
      });
    });
  }

  function _updateSummary(selected) {
    const el = document.getElementById('wiz-varinit-summary');
    if (el) el.innerHTML = _devSummaryText(selected);
  }

  async function _ensureData() {
    const list = document.getElementById('wiz-varinit-devlist');
    if (list) list.innerHTML = `<div class="wiz-empty">Loading...</div>`;

    const fetches = [];

    if (!WizardCore.deviceData) {
      fetches.push(
        API.getDevices()
          .then(data => { WizardCore.deviceData = data; })
          .catch(() => { WizardCore.deviceData = []; })
      );
    }

    if (!WizardCore.globalsData) {
      fetches.push(
        API.getGlobals()
          .then(result => {
            // Backend returns dict keyed by id — same as GlobalsDrawer
            WizardCore.globalsData = Object.values(result || {});
          })
          .catch(() => { WizardCore.globalsData = []; })
      );
    }

    if (fetches.length) await Promise.all(fetches);
  }
}

function _devSummaryText(selected) {
  const n = selected.size;
  if (n === 0) return '<span class="wiz-initval-placeholder">No devices selected</span>';
  return `<span class="wiz-device-tag">device</span> ${n} device${n !== 1 ? 's' : ''} selected`;
}
