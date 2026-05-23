// pistoncore/frontend/js/wizard-action.js
// Action device picker, location command picker, physical device command picker.
// Depends on: wizard-core.js (WizardCore must be loaded first)

function _goActionDevicePicker() {
  const { _render, _pushStep, close } = WizardCore;
  WizardCore.step = 'act_dev';
  _pushStep(_goActionDevicePicker);
  // Reset command/params when arriving at device picker — device may change
  WizardCore.sel.command = '';
  WizardCore.sel.parameters = {};
  // Reset device selection state only when starting a fresh action (not editing).
  // On edit, _route() pre-populates devices/device_id/device_label before opening.
  if (!WizardCore.editNode) {
    WizardCore.sel.devices       = [];
    WizardCore.sel.device_id     = '';
    WizardCore.sel.device_label  = '';
    WizardCore.sel.device_labels = [];
  }
  _render(
    'Add a new action',
    `<div class="wiz-desc">Actions represent a collection of tasks a device or group of devices have to perform. The <em>Location</em> virtual device provides a way to execute some non-device-specific tasks, such as sending notifications, communicating with integrated apps, and more.</div>
     <div class="wiz-selected-bar" id="wiz-sel-bar" style="display:none"><span id="wiz-sel-label"></span></div>
     <div class="wiz-search-row" style="margin:8px 0 4px;border:1px solid var(--border-subtle);border-radius:4px;padding:4px 8px;background:var(--bg-raised)">
       <span style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px">Search for devices</span>
       <input type="text" id="wiz-act-search" placeholder="Type to filter..." autocomplete="off" style="width:100%;background:var(--bg-input,var(--bg-raised));border:1px solid var(--border-subtle);border-radius:3px;color:var(--text-primary);font-size:13px;outline:none;padding:4px 6px;margin-top:2px;box-sizing:border-box" />
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
    if (!WizardCore.sel.devices?.length) return;
    if (WizardCore.sel.device_id === '__location__') _goLocationCmdPicker();
    else _goCommandPicker();
  });
  document.getElementById('wiz-sel-all')?.addEventListener('click', () => _actDevSelectAll(true));
  document.getElementById('wiz-desel-all')?.addEventListener('click', () => _actDevSelectAll(false));

  let _ft = null;
  document.getElementById('wiz-act-search')?.addEventListener('input', e => {
    clearTimeout(_ft);
    // Only filter once deviceData has loaded — avoids "None match" during API call
    if (!WizardCore.deviceData) return;
    _ft = setTimeout(() => _renderActDevList(e.target.value.trim()), 200);
  });

  _loadActDevices();
}
async function _loadActDevices() {
  _renderActDevList('');
  try {
    if (!WizardCore.deviceData) WizardCore.deviceData = await API.getDevices();
  } catch(e) {}
  // Always re-render after load attempt — picks up any search text already typed
  _renderActDevList(document.getElementById('wiz-act-search')?.value || '');
}

function _renderActDevList(query) {
  const { _esc, _filterDevices, VIRTUAL_DEVICES, SYSTEM_VARS, DEMO_DEVICES } = WizardCore;
  const el = document.getElementById('wiz-act-devlist');
  if (!el) return;
  const q = query.toLowerCase();

  const physical = _filterDevices(WizardCore.deviceData).filter(d =>
    !q || d.friendly_name.toLowerCase().includes(q) || d.entity_id.toLowerCase().includes(q)
  );
  const allLocals = Editor.getPistonVariables ? Editor.getPistonVariables() : [];
  const pistonDevVars = allLocals.filter(v =>
    v.var_type === 'device' && (!q || v.name.toLowerCase().includes(q))
  );
  const filteredVirtual = VIRTUAL_DEVICES.filter(v =>
    !q || v.friendly_name.toLowerCase().includes(q)
  );
  const filteredSystem = SYSTEM_VARS.filter(sv =>
    !q || sv.toLowerCase().includes(q)
  );
  const filteredDemo = DEMO_DEVICES.filter(d =>
    !q || d.friendly_name.toLowerCase().includes(q)
  );

  const sel = new Set(WizardCore.sel.devices||[]);
  let html = '';

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

  html += `<div class="wiz-device-group-header">System variables</div>`;
  if (filteredSystem.length) {
    html += filteredSystem.map(sv => _actDevRow(sv, sv, sel.has(sv))).join('');
  } else {
    html += `<div class="wiz-empty" style="padding:4px 10px;font-size:12px;color:var(--text-muted)">None match.</div>`;
  }

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
        WizardCore.sel.devices = [id];
        WizardCore.sel.device_id = id;
        WizardCore.sel.device_label = row.dataset.label;
        _updateActSelBar([row.dataset.label]);
        document.getElementById('wiz-act-next')?.removeAttribute('disabled');
        setTimeout(() => {
          if (id === '__location__') _goLocationCmdPicker();
          else _goCommandPicker();
        }, 150);
      } else {
        row.classList.toggle('selected');
        const newSel = new Set(WizardCore.sel.devices||[]);
        if (row.classList.contains('selected')) newSel.add(id); else newSel.delete(id);
        WizardCore.sel.devices = [...newSel];
        WizardCore.sel.device_id = WizardCore.sel.devices[0] || '';
        // Build label array now while the DOM rows are present — store for use at save time
        const allLabels = WizardCore.sel.devices.map(d => el.querySelector(`[data-id="${CSS.escape(d)}"]`)?.dataset.label || d);
        WizardCore.sel.device_labels = allLabels;
        WizardCore.sel.device_label = allLabels.length === 1 ? allLabels[0] : `${allLabels.length} devices`;
        _updateActSelBar(allLabels);
        document.getElementById('wiz-act-next')?.toggleAttribute('disabled', !WizardCore.sel.devices.length);
      }
    });
  });

  sel.forEach(id => el.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('selected'));
}

function _actDevRow(id, label, selected) {
  const { _esc } = WizardCore;
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
  WizardCore.sel.devices = on ? ids : [];
  WizardCore.sel.device_id = ids[0]||'';
  _updateActSelBar(on ? labels : []);
  document.getElementById('wiz-act-next')?.toggleAttribute('disabled', !on || !ids.length);
}

function _goLocationCmdPicker() {
  const { _esc, _render, _pushStep, _deleteEditNode, close, LOCATION_COMMANDS } = WizardCore;
  WizardCore.step = 'loc_cmd';
  _pushStep(_goLocationCmdPicker);
  const _sel = WizardCore.sel;
  const isNew = !WizardCore.editNode;

  _render(
    'Add a new task',
    `<div class="wiz-with-row"><span class="wiz-with-label">With...</span><span class="wiz-with-device">Location</span></div>
     <div class="wiz-do-label">Do...</div>
     <select id="wiz-loc-cmd" class="wiz-select-blue wiz-select-full">
       <option value="" style="display:none" disabled>Please select a command</option>
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
    WizardCore.sel.location_cmd = e.target.value;
    _renderLocParams(e.target.value);
    document.getElementById('wiz-loc-save')?.removeAttribute('disabled');
    document.getElementById('wiz-loc-addmore')?.removeAttribute('disabled');
  });
  if (_sel.location_cmd) _renderLocParams(_sel.location_cmd);
}

function _goLocationCmd(cmd) {
  WizardCore.sel.location_cmd  = cmd;
  WizardCore.sel.device_id     = '__location__';
  WizardCore.sel.device_label  = 'Location';
  WizardCore.sel.devices       = ['__location__'];
  const _editNode = WizardCore.editNode;
  if (_editNode) {
    if (cmd === 'set_variable') {
      WizardCore.sel.variable = _editNode.variable || '';
      WizardCore.sel.value    = _editNode.value?.expression || _editNode.value?.data || '';
    } else if (cmd === 'wait') {
      WizardCore.sel.duration_amount = _editNode.duration || 1;
      WizardCore.sel.duration_unit   = _editNode.duration_unit || 'minutes';
    } else if (cmd === 'log') {
      WizardCore.sel.message = _editNode.message?.data || _editNode.message || '';
    } else if (cmd === 'execute_piston') {
      WizardCore.sel.target_piston_id = _editNode.target_piston_id || '';
    }
  }
  _goLocationCmdPicker();
}

function _renderLocParams(cmd) {
  const { _esc } = WizardCore;
  const _sel = WizardCore.sel;
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
        <option value="" style="display:none" disabled>Select piston...</option>
        ${(App.state?.pistons||[]).map(p=>`<option value="${_esc(p.id)}" ${_sel.target_piston_id===p.id?'selected':''}>${_esc(p.name)}</option>`).join('')}
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
  const { _newId, _taskId, close } = WizardCore;
  const _sel = WizardCore.sel;
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
    node = { type:'set_variable', id:WizardCore.editNode?.id||_newId(),
      variable: document.getElementById('wiz-sv-name')?.value||'',
      value:    svValue,
      description: null, disabled: false };
  } else if (cmd === 'wait') {
    node = { type:'wait', id:WizardCore.editNode?.id||_newId(), wait_type:'duration',
      duration: parseInt(document.getElementById('wiz-wait-n')?.value||'1'),
      duration_unit: document.getElementById('wiz-wait-u')?.value||'minutes',
      description: null, disabled: false };
  } else if (cmd === 'log') {
    node = { type:'log_message', id:WizardCore.editNode?.id||_newId(),
      message: { type:'literal', data: document.getElementById('wiz-log-msg')?.value||'' },
      level:   document.getElementById('wiz-log-lvl')?.value||'info',
      description: null, disabled: false };
  } else if (cmd === 'execute_piston') {
    const pid   = document.getElementById('wiz-ep-target')?.value||'';
    const pname = (App.state?.pistons||[]).find(p=>p.id===pid)?.name || pid;
    node = { type:'call_piston', id:WizardCore.editNode?.id||_newId(),
      target_piston_id: pid, target_piston_name: pname,
      description: null, disabled: false };
  } else if (cmd === 'send_notification') {
    node = { type:'action', id:WizardCore.editNode?.id||_newId(),
      devices: ['Location'],
      tasks: [{ id: _taskId(), command:'persistent_notification.create', domain:'notify',
        ha_service:'persistent_notification.create',
        parameters:{ message: document.getElementById('wiz-notif-msg')?.value||'',
                     title:   document.getElementById('wiz-notif-title')?.value||'' },
        description: null }],
      description: null, disabled: false };
  } else if (cmd === 'http_request') {
    node = { type:'action', id:WizardCore.editNode?.id||_newId(),
      devices: ['Location'],
      tasks: [{ id: _taskId(), command:'http_request', domain:'location', ha_service:'location.http_request',
        parameters:{
          url:    document.getElementById('wiz-http-url')?.value||'',
          method: document.getElementById('wiz-http-method')?.value||'GET',
          body:   document.getElementById('wiz-http-body')?.value||'',
        }, description: null }],
      description: null, disabled: false };
  } else if (cmd === 'set_mode') {
    node = { type:'action', id:WizardCore.editNode?.id||_newId(),
      devices: ['Location'],
      tasks: [{ id: _taskId(), command:'set_mode', domain:'location', ha_service:'location.set_mode',
        parameters:{ mode: document.getElementById('wiz-setmode-val')?.value||'' },
        description: null }],
      description: null, disabled: false };
  } else if (cmd === 'raise_event') {
    node = { type:'action', id:WizardCore.editNode?.id||_newId(),
      devices: ['Location'],
      tasks: [{ id: _taskId(), command:'raise_event', domain:'location', ha_service:'location.raise_event',
        parameters:{
          event_type: document.getElementById('wiz-event-name')?.value||'',
          event_data: document.getElementById('wiz-event-data')?.value||'',
        }, description: null }],
      description: null, disabled: false };
  } else {
    node = { type:'action', id:WizardCore.editNode?.id||_newId(),
      devices: ['Location'],
      tasks: [{ id: _taskId(), command: cmd, domain:'location', ha_service:`location.${cmd}`, parameters:{}, description: null }],
      description: null, disabled: false };
  }

  const ctx     = WizardCore.context;
  const blockId = WizardCore.extra?.['block-id'];
  const branch  = WizardCore.extra?.['branch'] || 'then';
  const meta    = blockId ? { blockId, branch } : undefined;
  Editor.insertStatement(ctx, node, meta);

  if (addMore) {
    WizardCore.sel.location_cmd = '';
    WizardCore.sel.variable = ''; WizardCore.sel.value = ''; WizardCore.sel.message = '';
    WizardCore.editNode = null;
    _goLocationCmdPicker();
  } else {
    close();
  }
}

async function _goCommandPicker() {
  const { _esc, _render, _pushStep, _deleteEditNode, close, DEMO_DEVICES } = WizardCore;
  WizardCore.step = 'cmd';
  _pushStep(_goCommandPicker);
  const _sel  = WizardCore.sel;
  const label = _sel.device_label || _sel.device_id || 'device';
  const isNew = !WizardCore.editNode;

  _render(
    'Add a new task',
    `<div class="wiz-with-row"><span class="wiz-with-label">With...</span><span class="wiz-with-device">{${_esc(label)}}</span></div>
     <div class="wiz-do-label">Do...</div>
     <select id="wiz-cmd" class="wiz-select-blue wiz-select-full">
       <option value="" style="display:none" disabled>Please select a command</option>
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
      sel.innerHTML = `<option value="" style="display:none" disabled>Please select a command</option>` +
        demo.services.map(s => `<option value="${_esc(s)}" ${_sel.command===s?'selected':''}>${_esc(s.replace(/_/g,' '))}</option>`).join('');
      // Auto-select first option if no prior command — browser shows first item visually
      // but .value stays '' until an option has selected attribute or is set programmatically
      if (!_sel.command && demo.services.length) {
        sel.value = demo.services[0];
        WizardCore.sel.command = demo.services[0];
      }
      if (WizardCore.sel.command) {
        // Build minimal services array so _renderCmdParams has something to look up
        const demoServices = demo.services.map(s => ({ service: s, label: s.replace(/_/g,' '), fields: {} }));
        _renderCmdParams(WizardCore.sel.command, demoServices);
        document.getElementById('wiz-cmd-save')?.removeAttribute('disabled');
        document.getElementById('wiz-cmd-addmore')?.removeAttribute('disabled');
      }
      sel.addEventListener('change', e => {
        WizardCore.sel.command = e.target.value;
        const demoServices = demo.services.map(s => ({ service: s, label: s.replace(/_/g,' '), fields: {} }));
        _renderCmdParams(e.target.value, demoServices);
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
        sel.innerHTML = `<option value="" style="display:none" disabled>Please select a command</option>` +
          services.map(s=>`<option value="${_esc(s.service)}" ${_sel.command===s.service?'selected':''}>${_esc(s.label||s.service)}</option>`).join('');
      } else {
        sel.innerHTML = `<option value="" style="display:none" disabled>Please select a command</option>` +
          ['turn_on','turn_off','toggle'].map(c=>`<option value="${_esc(c)}" ${_sel.command===c?'selected':''}>${c.replace(/_/g,' ')}</option>`).join('');
      }
      // Auto-select first real option if no prior command
      if (!WizardCore.sel.command) {
        const firstOpt = sel.options[1]; // index 0 is the hidden disabled placeholder
        if (firstOpt) {
          sel.value = firstOpt.value;
          WizardCore.sel.command = firstOpt.value;
        }
      }
      if (WizardCore.sel.command) {
        _renderCmdParams(WizardCore.sel.command, services);
        document.getElementById('wiz-cmd-save')?.removeAttribute('disabled');
        document.getElementById('wiz-cmd-addmore')?.removeAttribute('disabled');
      }
      sel.addEventListener('change', e => {
        WizardCore.sel.command = e.target.value;
        _renderCmdParams(e.target.value, services);
        const ok = !!e.target.value;
        document.getElementById('wiz-cmd-save')?.toggleAttribute('disabled', !ok);
        document.getElementById('wiz-cmd-addmore')?.toggleAttribute('disabled', !ok);
      });
    }
  } catch(e) {
    const el = document.getElementById('wiz-cmd-params');
    const { _esc } = WizardCore;
    if (el) el.innerHTML = `<div class="wiz-error">Could not load device commands.<br><small>${_esc(e.message)}</small></div>`;
  }
}

function _renderCmdParams(service, services) {
  const { _esc } = WizardCore;
  const _sel = WizardCore.sel;
  const el = document.getElementById('wiz-cmd-params');
  if (!el) return;
  const svc = services.find(s=>s.service===service);
  if (!svc?.fields || !Object.keys(svc.fields).length) { el.innerHTML=''; return; }
  el.innerHTML = Object.entries(svc.fields).map(([key,field])=>`
    <div class="wiz-param-section">
      <div class="wiz-row-label">${_esc(field.name||key)}${field.optional?' (optional)':''}</div>
      ${field.selector?.number
        ? `<input type="number" class="wiz-value-input" data-param="${_esc(key)}" min="${field.selector.number.min??''}" max="${field.selector.number.max??''}" value="${_sel.parameters?.[key]??field.selector.number.min??0}" />`
        : field.selector?.select
        ? `<select class="wiz-select-blue-sm" data-param="${_esc(key)}">${field.selector.select.options.map(o=>`<option value="${_esc(o.value)}" ${_sel.parameters?.[key]===o.value?'selected':''}>${_esc(o.label)}</option>`).join('')}</select>`
        : `<input type="text" class="wiz-value-input" data-param="${_esc(key)}" value="${_esc(String(_sel.parameters?.[key]??''))}" placeholder="${_esc(field.description||'')}" />`
      }
    </div>`).join('');
}

function _saveDeviceCmd(addMore) {
  const { _newId, _taskId, close } = WizardCore;
  const _sel = WizardCore.sel;
  const command = document.getElementById('wiz-cmd')?.value || _sel.command;
  if (!command) return;
  const params = {};
  document.querySelectorAll('[data-param]').forEach(el => { params[el.dataset.param] = el.value; });

  // entity_ids: the real HA entity IDs for this action (e.g. ["light.driveway_main"])
  // These are stored in _sel.devices, set by _renderActDevList row click handler.
  const entityIds = (_sel.devices || []).filter(id => id && !id.startsWith('__'));
  const firstId   = entityIds[0] || _sel.device_id || '';
  const domain    = firstId.includes('.') ? firstId.split('.')[0] : 'homeassistant';

  // role: human label used as the key in device_map and rendered in the editor.
  // For a single device use the friendly name. For multiple, use a generated role name.
  // Stored in device_map so the compiler can resolve entity IDs at compile time.
  const labels = _sel.device_labels || [];
  let role;
  if (entityIds.length === 1) {
    role = labels[0] || _sel.device_label || firstId;
  } else if (entityIds.length > 1) {
    // Multi-device role: join friendly names, truncated for readability
    role = labels.length ? labels.join(' + ') : entityIds.join(' + ');
  } else {
    // Virtual/system device — use the label directly, no entity_ids to register
    role = _sel.device_label || _sel.device_id || '';
  }

  const newTask = {
    id:          _taskId(),
    command:     command,
    domain:      domain,
    ha_service:  domain + '.' + command,
    parameters:  params,
    description: null,
  };

  const ctx     = WizardCore.context;
  const blockId = WizardCore.extra?.['block-id'];
  const branch  = WizardCore.extra?.['branch'] || 'then';
  const meta    = blockId ? { blockId, branch } : undefined;

  // Store entity IDs in devices array (not labels) — compiler resolves via device_map.
  // For virtual/system devices that have no entity IDs, store the label as before.
  const devicesField = entityIds.length ? entityIds : [role];

  if (WizardCore.editNode && WizardCore.editNode.type === 'action') {
    const updatedNode = { ...WizardCore.editNode, devices: devicesField, tasks: [newTask] };
    Editor.insertStatement(ctx, updatedNode, meta);
  } else {
    Editor.insertStatement(ctx, {
      type: 'action', id: WizardCore.editNode?.id || _newId(), async: false,
      devices: devicesField,
      role,
      tasks: [newTask],
      description: null, disabled: false,
    }, meta);
  }

  // Register all selected entity IDs under this role in device_map
  if (entityIds.length && Editor.registerDeviceRole) {
    Editor.registerDeviceRole(role, entityIds);
  }

  if (addMore) {
    WizardCore.sel.command = '';
    WizardCore.sel.parameters = {};
    WizardCore.editNode = null;
    _goCommandPicker();
  } else {
    close();
  }
}
