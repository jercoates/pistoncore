// frontend/js/globals.js
//
// GlobalsDrawer — slide-out panel for managing global variables.
// Wired to #globals-drawer in index.html.
// Opened via GlobalsDrawer.open() from header button or list.js.
//
// Globals use the same type system and value input pattern as piston local variables
// (wizard-variable.js). The only differences are:
//   - @ prefix instead of $
//   - Saves to the globals API (GET/POST/PUT/DELETE /api/globals) instead of piston JSON
//   - Carries a used_by[] field tracking which pistons reference this global
//   - Editing a global with used_by entries prompts for deploy
//
// Types (WebCoRE names, same as local variable dialog):
//   dynamic | string | boolean | integer | decimal | datetime | date | time | device
//
// Node shape stored: { id, name, var_type, value, description, used_by: [{uuid,name}] }
// device type: value is array of friendly name strings (NOT entity IDs) — §0.1

const GlobalsDrawer = (() => {

  // ── State ────────────────────────────────────────────────────────────────
  let _globals = [];          // cached list from API
  let _devices = [];          // cached HA device list for device picker
  let _devicesLoaded = false;
  let _editingId = null;      // null = adding new; string = editing existing
  let _selectedDevices = new Set(); // device picker selection state

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const drawer = () => document.getElementById('globals-drawer');
  const body   = () => document.getElementById('globals-drawer-body');

  // ── Type definitions — same list as WebCoRE local variable dialog ─────────
  const VAR_TYPES = [
    { key: 'dynamic',  label: 'Dynamic'             },
    { key: 'string',   label: 'String (text)'        },
    { key: 'boolean',  label: 'Boolean (true/false)' },
    { key: 'integer',  label: 'Number (integer)'     },
    { key: 'decimal',  label: 'Number (decimal)'     },
    { key: 'datetime', label: 'Date and Time'        },
    { key: 'date',     label: 'Date (date only)'     },
    { key: 'time',     label: 'Time (time only)'     },
    { key: 'device',   label: 'Device'               },
  ];

  // ── Public API ───────────────────────────────────────────────────────────
  async function open() {
    const el = drawer();
    if (!el) return;
    el.classList.add('open');
    _editingId = null;
    await _loadAndRender();
    _prefetchDevices();
  }

  function close() {
    const el = drawer();
    if (!el) return;
    el.classList.remove('open');
    _editingId = null;
  }

  // Returns the cached globals list — used by wizard/editor for used_by tracking
  function getGlobals() { return _globals; }

  // Update used_by on a global by name — called by wizard at node commit and editor at save
  // action: 'add' | 'remove'
  async function updateUsedBy(globalName, pistonUuid, pistonName, action) {
    const g = _globals.find(x => x.name === globalName);
    if (!g) return;
    const usedBy = Array.isArray(g.used_by) ? [...g.used_by] : [];
    if (action === 'add') {
      if (!usedBy.find(e => e.uuid === pistonUuid)) {
        usedBy.push({ uuid: pistonUuid, name: pistonName });
      }
    } else {
      const idx = usedBy.findIndex(e => e.uuid === pistonUuid);
      if (idx >= 0) usedBy.splice(idx, 1);
    }
    g.used_by = usedBy;
    try {
      await API.updateGlobal(g.id, { used_by: usedBy });
    } catch (e) {
      console.warn('GlobalsDrawer.updateUsedBy failed:', e);
    }
  }

  // ── Load + render list ───────────────────────────────────────────────────
  async function _loadAndRender() {
    const b = body();
    if (!b) return;
    b.innerHTML = `<div class="wizard-loading"><div class="spinner"></div> Loading...</div>`;
    try {
      const result = await API.getGlobals();
      _globals = Object.values(result || {});
      _globals.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) {
      b.innerHTML = `<div class="globals-error">Could not load globals: ${_esc(e.message)}</div>`;
      return;
    }
    _renderList();
  }

  function _renderList() {
    const b = body();
    if (!b) return;

    const rows = _globals.length === 0
      ? `<div class="globals-empty">No global variables yet.<br>Click <strong>+ Add Global</strong> to create one.</div>`
      : _globals.map(_renderRow).join('');

    b.innerHTML = `
      <div class="globals-list">${rows}</div>
      <div class="globals-footer">
        <button class="btn btn-primary btn-sm" id="globals-btn-add">+ Add Global</button>
        <button class="btn btn-ghost btn-xs" id="globals-btn-recalc" title="Rebuild used_by reference lists from all pistons">Recalculate References</button>
      </div>
    `;

    b.querySelector('#globals-btn-add')?.addEventListener('click', () => _openForm(null));
    b.querySelector('#globals-btn-recalc')?.addEventListener('click', _recalculate);

    b.querySelectorAll('.globals-row-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = _globals.find(x => x.id === btn.dataset.id);
        if (g) _openForm(g);
      });
    });

    b.querySelectorAll('.globals-row-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = _globals.find(x => x.id === btn.dataset.id);
        if (g) _confirmDelete(g);
      });
    });
  }

  function _renderRow(g) {
    const typeEntry = VAR_TYPES.find(t => t.key === g.var_type);
    const typeLabel = typeEntry ? typeEntry.label : (g.var_type || '?');
    const usedBy    = Array.isArray(g.used_by) ? g.used_by : [];
    const refCount  = usedBy.length;

    let valueDisplay;
    if (g.var_type === 'device') {
      const vals = Array.isArray(g.value) ? g.value : (g.value ? [g.value] : []);
      valueDisplay = vals.length
        ? `<span class="globals-value-entity">${vals.length} device${vals.length !== 1 ? 's' : ''}</span>`
        : `<span class="globals-value-none">not set</span>`;
    } else if (g.var_type === 'boolean') {
      const v = String(g.value);
      valueDisplay = (v === 'true' || v === 'false')
        ? `<span class="globals-value">${v}</span>`
        : `<span class="globals-value-none">not set</span>`;
    } else {
      valueDisplay = (g.value !== undefined && g.value !== '' && g.value !== null)
        ? `<span class="globals-value">${_esc(String(g.value))}</span>`
        : `<span class="globals-value-none">not set</span>`;
    }

    const refLabel = refCount > 0
      ? `<span class="globals-ref-count">${refCount} piston${refCount !== 1 ? 's' : ''}</span>`
      : '';

    return `
      <div class="globals-row" data-id="${_esc(g.id)}">
        <div class="globals-row-main">
          <span class="globals-row-name">@${_esc(g.name)}</span>
          <span class="globals-row-type">${_esc(typeLabel)}</span>
          ${valueDisplay}
          ${refLabel}
          <div class="globals-row-actions">
            <button class="globals-row-edit btn-ghost" data-id="${_esc(g.id)}" title="Edit">✎</button>
            <button class="globals-row-delete btn-ghost" data-id="${_esc(g.id)}" title="Delete">✕</button>
          </div>
        </div>
        ${g.description ? `<div class="globals-row-desc">${_esc(g.description)}</div>` : ''}
      </div>
    `;
  }

  // ── Add / Edit form ──────────────────────────────────────────────────────
  // Same layout as WebCoRE local variable dialog — [Type][@ Name] on top,
  // value input below, description optional. Only the save target differs.
  function _openForm(global) {
    _editingId = global ? global.id : null;
    const b = body();
    if (!b) return;

    const isEdit   = !!global;
    const curType  = global?.var_type || 'dynamic';
    const curName  = global?.name     || '';
    const curDesc  = global?.description || '';

    b.innerHTML = `
      <div class="globals-form">
        <div class="globals-form-title">${isEdit ? 'Edit Global Variable' : 'Add a new global variable'}</div>

        <div class="globals-form-row globals-form-top-row">
          <select id="gf-type" class="globals-select globals-type-select">
            ${VAR_TYPES.map(t =>
              `<option value="${t.key}" ${curType === t.key ? 'selected' : ''}>${_esc(t.label)}</option>`
            ).join('')}
          </select>
          <div class="globals-name-wrap">
            <span class="globals-at">@</span>
            <input type="text" id="gf-name" class="globals-input" placeholder="variable_name"
              value="${_esc(curName)}" autocomplete="off" spellcheck="false" />
          </div>
        </div>

        <div class="globals-form-row" id="gf-value-row">
          <label class="globals-label">Value</label>
          <div id="gf-value-field"></div>
        </div>

        <div class="globals-form-row">
          <label class="globals-label">Description <span class="globals-optional">(optional)</span></label>
          <input type="text" id="gf-desc" class="globals-input"
            placeholder="What does this variable do?"
            value="${_esc(curDesc)}" />
        </div>

        <div class="globals-form-error" id="gf-error" style="display:none"></div>

        <div class="globals-form-actions">
          <button class="btn btn-ghost btn-sm" id="gf-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="gf-save">${isEdit ? 'Save' : 'Add'}</button>
          ${!isEdit ? `<button class="btn btn-success btn-sm" id="gf-add-more">Add more</button>` : ''}
        </div>
      </div>
    `;

    // Type change — re-render value field
    document.getElementById('gf-type').addEventListener('change', e => {
      _renderValueField(e.target.value, null);
    });
    _renderValueField(curType, global?.value ?? null);

    document.getElementById('gf-cancel').addEventListener('click', _renderList);
    document.getElementById('gf-save').addEventListener('click', () => _saveForm(isEdit, false));
    document.getElementById('gf-add-more')?.addEventListener('click', () => _saveForm(false, true));
  }

  // ── Value input per type — same pattern as wizard-variable.js ────────────
  function _renderValueField(varType, currentValue) {
    const container = document.getElementById('gf-value-field');
    if (!container) return;

    if (varType === 'device') {
      _renderDevicePicker(container, currentValue);
      return;
    }

    if (varType === 'boolean') {
      const cur = String(currentValue ?? '');
      container.innerHTML = `
        <select id="gf-value" class="globals-select">
          <option value="">— pick value —</option>
          <option value="true"  ${cur === 'true'  ? 'selected' : ''}>true</option>
          <option value="false" ${cur === 'false' ? 'selected' : ''}>false</option>
        </select>`;
      return;
    }

    if (varType === 'integer') {
      container.innerHTML = `<input type="number" id="gf-value" class="globals-input"
        step="1" value="${_esc(String(currentValue ?? ''))}" placeholder="0" />`;
      return;
    }

    if (varType === 'decimal') {
      container.innerHTML = `<input type="number" id="gf-value" class="globals-input"
        step="any" value="${_esc(String(currentValue ?? ''))}" placeholder="0.0" />`;
      return;
    }

    if (varType === 'datetime') {
      container.innerHTML = `<input type="datetime-local" id="gf-value" class="globals-input"
        value="${_esc(currentValue ?? '')}" />`;
      return;
    }

    if (varType === 'date') {
      container.innerHTML = `<input type="date" id="gf-value" class="globals-input"
        value="${_esc(currentValue ?? '')}" />`;
      return;
    }

    if (varType === 'time') {
      container.innerHTML = `<input type="time" id="gf-value" class="globals-input"
        value="${_esc(currentValue ?? '')}" />`;
      return;
    }

    // dynamic, string — plain text input
    container.innerHTML = `<input type="text" id="gf-value" class="globals-input"
      placeholder="Initial value" value="${_esc(String(currentValue ?? ''))}" />`;
  }

  // ── Device multi-select picker ───────────────────────────────────────────
  // Keeps device friendly names — same storage rule as wizard (§0.1).
  // Searchable list, checkboxes, SelectAll/DeselectAll.
  function _renderDevicePicker(container, currentValue) {
    const vals = Array.isArray(currentValue) ? currentValue
      : (currentValue ? [currentValue] : []);
    _selectedDevices = new Set(vals.filter(v => v && !v.includes('.')));

    // Old nodes stored entity_ids (have dots) — convert to friendly names via lookup
    const oldEntityIds = vals.filter(v => v && v.includes('.'));
    if (oldEntityIds.length && _devicesLoaded) {
      const grouped = _filteredDevices('');
      oldEntityIds.forEach(eid => {
        const grp = grouped.find(g => g.entity_ids.includes(eid));
        if (grp) _selectedDevices.add(grp.friendly_name);
      });
    }

    container.innerHTML = `
      <div class="gf-device-picker" id="gf-device-picker">
        <div class="gf-device-summary" id="gf-device-summary">
          ${_deviceSummaryText(_selectedDevices)}
        </div>
        <div class="gf-device-panel" id="gf-device-panel">
          <input type="text" class="gf-device-filter globals-input" id="gf-device-filter"
            placeholder="Search devices..." autocomplete="off" />
          <div class="gf-device-sel-actions">
            <button class="btn-ghost gf-sel-all" id="gf-sel-all">Select All</button>
            <button class="btn-ghost gf-sel-none" id="gf-sel-none">Deselect All</button>
          </div>
          <div class="gf-device-list" id="gf-device-list">
            <div class="globals-loading-inline">Loading devices...</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('gf-device-filter').addEventListener('input', e => {
      _renderDeviceRows(_selectedDevices, e.target.value);
    });

    document.getElementById('gf-sel-all').addEventListener('click', () => {
      const q = document.getElementById('gf-device-filter')?.value || '';
      _filteredDevices(q).forEach(d => _selectedDevices.add(d.friendly_name));
      _renderDeviceRows(_selectedDevices, q);
      _updateSummary(_selectedDevices);
    });

    document.getElementById('gf-sel-none').addEventListener('click', () => {
      const q = document.getElementById('gf-device-filter')?.value || '';
      _filteredDevices(q).forEach(d => _selectedDevices.delete(d.friendly_name));
      _renderDeviceRows(_selectedDevices, q);
      _updateSummary(_selectedDevices);
    });

    if (_devicesLoaded) {
      _renderDeviceRows(_selectedDevices, '');
    } else {
      _prefetchDevices().then(() => _renderDeviceRows(_selectedDevices, ''));
    }
  }

  // Allowed domains for device picker — same set as wizard
  const _ALLOWED_DOMAINS = new Set([
    'light','switch','binary_sensor','sensor','media_player','cover','climate',
    'fan','lock','input_boolean','input_number','input_select','automation',
    'person','device_tracker','alarm_control_panel',
  ]);

  const _DOMAIN_PRIORITY = [
    'light','switch','cover','fan','climate','lock','media_player',
    'input_boolean','input_number','input_select','automation',
    'binary_sensor','sensor','person','device_tracker','alarm_control_panel',
  ];

  function _filteredDevices(query) {
    const lq = (query || '').toLowerCase();
    const seen = new Set();
    const allowed = (_devices || []).filter(d => {
      const domain = (d.entity_id || '').split('.')[0];
      if (!_ALLOWED_DOMAINS.has(domain)) return false;
      if (seen.has(d.entity_id)) return false;
      seen.add(d.entity_id);
      return true;
    });
    const byDevice = new Map();
    for (const d of allowed) {
      const key = d.device_id || d.entity_id;
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key).push(d);
    }
    const result = [];
    for (const [, entities] of byDevice) {
      let primary = entities[0].entity_id;
      for (const domain of _DOMAIN_PRIORITY) {
        const match = entities.find(d => d.entity_id.startsWith(domain + '.'));
        if (match) { primary = match.entity_id; break; }
      }
      const label = entities.reduce((shortest, d) =>
        d.friendly_name.length < shortest.length ? d.friendly_name : shortest,
        entities[0].friendly_name
      );
      if (lq && !label.toLowerCase().includes(lq) && !primary.toLowerCase().includes(lq)) continue;
      result.push({ friendly_name: label, entity_ids: entities.map(d => d.entity_id), primary_entity_id: primary });
    }
    result.sort((a, b) => a.friendly_name.toLowerCase().localeCompare(b.friendly_name.toLowerCase()));
    return result;
  }

  function _renderDeviceRows(selected, query) {
    const list = document.getElementById('gf-device-list');
    if (!list) return;
    if (!_devicesLoaded) {
      list.innerHTML = `<div class="globals-loading-inline">Loading devices...</div>`;
      return;
    }
    const matches = _filteredDevices(query);
    if (!matches.length) {
      list.innerHTML = `<div class="gf-device-empty">No devices found.</div>`;
      return;
    }
    list.innerHTML = matches.slice(0, 300).map(d => {
      const sel = selected.has(d.friendly_name);
      return `<div class="gf-device-row ${sel ? 'selected' : ''}" data-id="${_esc(d.friendly_name)}">
        <span class="gf-device-name">${_esc(d.friendly_name)}</span>
        <span class="gf-device-check">${sel ? '✓' : ''}</span>
      </div>`;
    }).join('');

    list.querySelectorAll('.gf-device-row').forEach(row => {
      row.addEventListener('click', () => {
        const fn = row.dataset.id;
        if (selected.has(fn)) {
          selected.delete(fn);
          row.classList.remove('selected');
          row.querySelector('.gf-device-check').textContent = '';
        } else {
          selected.add(fn);
          row.classList.add('selected');
          row.querySelector('.gf-device-check').textContent = '✓';
        }
        _updateSummary(selected);
      });
    });
  }

  function _deviceSummaryText(selected) {
    const n = selected.size;
    if (n === 0) return '<span class="globals-value-none">No devices selected</span>';
    return `<span class="globals-value-entity">${n} device${n !== 1 ? 's' : ''} selected</span>`;
  }

  function _updateSummary(selected) {
    const el = document.getElementById('gf-device-summary');
    if (el) el.innerHTML = _deviceSummaryText(selected);
  }

  function _readDeviceSelection() {
    return Array.from(_selectedDevices);
  }

  async function _prefetchDevices() {
    if (_devicesLoaded) return;
    try {
      _devices = await API.getDevices();
      _devicesLoaded = true;
    } catch {
      _devices = [];
      _devicesLoaded = true;
    }
  }

  // ── Save form ────────────────────────────────────────────────────────────
  async function _saveForm(isEdit, rearm) {
    const nameEl  = document.getElementById('gf-name');
    const typeEl  = document.getElementById('gf-type');
    const descEl  = document.getElementById('gf-desc');
    const errEl   = document.getElementById('gf-error');
    const saveBtn = document.getElementById('gf-save');
    if (!nameEl || !typeEl || !errEl) return;

    const name     = nameEl.value.trim().replace(/^@+/, '');
    const var_type = typeEl.value;
    const description = descEl ? descEl.value.trim() : '';

    if (!name) { _showFormError('Name is required.'); return; }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      _showFormError('Name must start with a letter or underscore, letters/numbers/underscores only.');
      return;
    }

    // Check for duplicate name (on create, or on edit if name changed)
    const existingWithName = _globals.find(g => g.name === name && g.id !== _editingId);
    if (existingWithName) { _showFormError(`A global named @${name} already exists.`); return; }

    let value;
    if (var_type === 'device') {
      value = _readDeviceSelection();
      if (value.length === 0) { _showFormError('Select at least one device.'); return; }
    } else {
      const valueEl = document.getElementById('gf-value');
      value = valueEl ? valueEl.value : '';
    }

    if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }
    errEl.style.display = 'none';

    try {
      if (isEdit && _editingId) {
        const existing = _globals.find(g => g.id === _editingId);
        const usedBy = existing?.used_by || [];
        await API.updateGlobal(_editingId, { name, var_type, value, description, used_by: usedBy });
        _editingId = null;
        await _loadAndRender();
        // Show deploy prompt if any pistons reference this global
        if (usedBy.length > 0) {
          _showDeployPrompt(name, usedBy);
        }
      } else {
        await API.createGlobal({ name, var_type, value, description, used_by: [] });
        if (rearm) {
          // Add more — reset form to add another without closing
          await _loadAndRender();
          _openForm(null);
        } else {
          _editingId = null;
          await _loadAndRender();
        }
      }
    } catch (e) {
      if (saveBtn) { saveBtn.textContent = isEdit ? 'Save' : 'Add'; saveBtn.disabled = false; }
      _showFormError(e.message || 'Save failed.');
    }
  }

  function _showFormError(msg) {
    const errEl = document.getElementById('gf-error');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.style.display = '';
  }

  // ── Deploy prompt — shown after editing a global with used_by references ──
  // "Update all now" is a stub until the patch operation is built (see
  // COMPILER_DECISIONS_HOLDING.md §H5). "I'll deploy later" just closes.
  function _showDeployPrompt(globalName, usedBy) {
    const b = body();
    if (!b) return;
    const count = usedBy.length;
    const names = usedBy.map(p => _esc(p.name)).join(', ');

    b.innerHTML = `
      <div class="globals-deploy-prompt">
        <div class="globals-deploy-title">
          <strong>@${_esc(globalName)}</strong> is used by ${count} piston${count !== 1 ? 's' : ''}.
        </div>
        <div class="globals-deploy-names">${names}</div>
        <p>Update them now, or deploy each yourself later?</p>
        <div class="globals-deploy-actions">
          <button class="btn btn-primary btn-sm" id="gdp-now">Update all now</button>
          <button class="btn btn-ghost btn-sm" id="gdp-later">I'll deploy later</button>
        </div>
        <div id="gdp-status" class="globals-deploy-status" style="display:none"></div>
      </div>
    `;

    document.getElementById('gdp-later').addEventListener('click', _renderList);

    document.getElementById('gdp-now').addEventListener('click', async () => {
      const statusEl = document.getElementById('gdp-status');
      const nowBtn   = document.getElementById('gdp-now');
      if (nowBtn) nowBtn.disabled = true;
      if (statusEl) {
        statusEl.style.display = '';
        statusEl.textContent = 'Batch device-patch not yet available — deploy each piston manually from the piston list.';
      }
      // Stub: patch operation will be implemented when HA update path is ready (§H5)
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function _confirmDelete(g) {
    const usedBy = Array.isArray(g.used_by) ? g.used_by : [];
    const refNote = usedBy.length > 0
      ? `\n\n${usedBy.length} piston${usedBy.length !== 1 ? 's' : ''} reference it — those pistons will need to be edited to remove the reference.`
      : '';
    if (!confirm(`Delete global @${g.name}?${refNote}`)) return;
    API.deleteGlobal(g.id)
      .then(_loadAndRender)
      .catch(e => alert(`Delete failed: ${e.message}`));
  }

  // ── Recalculate References ───────────────────────────────────────────────
  // Calls the backend recalculate endpoint when available.
  // Currently a stub — the endpoint does not exist yet.
  async function _recalculate() {
    const b = body();
    if (!b) return;
    try {
      await fetch(window.location.origin + '/api/globals/recalculate', { method: 'POST' });
      await _loadAndRender();
    } catch {
      alert('Recalculate not yet available — the backend endpoint has not been built yet.');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('globals-drawer-close')?.addEventListener('click', close);

    document.addEventListener('mousedown', e => {
      const el = drawer();
      if (!el || !el.classList.contains('open')) return;
      if (el.contains(e.target)) return;
      if (e.target.closest('#btn-globals')) return;
      close();
    });

    document.getElementById('btn-globals')?.addEventListener('click', open);
  });

  return { open, close, getGlobals, updateUsedBy };

})();

window.GlobalsDrawer = GlobalsDrawer;
