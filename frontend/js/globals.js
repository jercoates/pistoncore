// pistoncore/frontend/js/globals.js
//
// GlobalsDrawer — slide-out panel for managing global variables.
// Wired to #globals-drawer (already in index.html).
// Called via GlobalsDrawer.open() from list.js and the global header button.
//
// Schema: { id, name, var_type, value, description }
// var_type values: text | number | boolean | datetime | device
// device value: array of entity_id strings (one global can group many devices)

const GlobalsDrawer = (() => {

  // ── State ────────────────────────────────────────────────
  let _globals = [];
  let _devices = [];
  let _devicesLoaded = false;
  let _editingId = null; // null = adding new, string = editing existing
  let _selectedDevices = new Set(); // tracks current device picker selection

  // ── DOM refs ─────────────────────────────────────────────
  const drawer = () => document.getElementById('globals-drawer');
  const body   = () => document.getElementById('globals-drawer-body');

  // ── Public API ───────────────────────────────────────────
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

  // ── Load + render list ───────────────────────────────────
  async function _loadAndRender() {
    const b = body();
    if (!b) return;
    b.innerHTML = `<div class="wizard-loading"><div class="spinner"></div> Loading...</div>`;
    try {
      const result = await API.getGlobals();
      // Backend returns a dict keyed by id — convert to array
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
      <div class="globals-add-bar">
        <button class="btn btn-primary btn-sm" id="globals-btn-add">+ Add Global</button>
      </div>
    `;

    b.querySelector('#globals-btn-add')?.addEventListener('click', () => _openForm(null));

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
    const typeLabel = _typeLabel(g.var_type);

    let valueDisplay;
    if (g.var_type === 'device') {
      const ids = Array.isArray(g.value) ? g.value : (g.value ? [g.value] : []);
      valueDisplay = ids.length
        ? `<span class="globals-value-entity">${ids.length} device${ids.length !== 1 ? 's' : ''}</span>`
        : `<span class="globals-value-none">not set</span>`;
    } else {
      valueDisplay = (g.value !== undefined && g.value !== '' && g.value !== null)
        ? `<span class="globals-value">${_esc(String(g.value))}</span>`
        : `<span class="globals-value-none">not set</span>`;
    }

    const desc = g.description
      ? `<div class="globals-row-desc">${_esc(g.description)}</div>`
      : '';

    return `
      <div class="globals-row" data-id="${_esc(g.id)}">
        <div class="globals-row-main">
          <span class="globals-row-name">@${_esc(g.name)}</span>
          <span class="globals-row-type">${_esc(typeLabel)}</span>
          ${valueDisplay}
          <div class="globals-row-actions">
            <button class="globals-row-edit btn-ghost" data-id="${_esc(g.id)}" title="Edit">✎</button>
            <button class="globals-row-delete btn-ghost" data-id="${_esc(g.id)}" title="Delete">✕</button>
          </div>
        </div>
        ${desc}
      </div>
    `;
  }

  // ── Add / Edit form ──────────────────────────────────────
  function _openForm(global) {
    _editingId = global ? global.id : null;
    const b = body();
    if (!b) return;

    const isEdit  = !!global;
    const curType = global?.var_type || 'text';

    b.innerHTML = `
      <div class="globals-form">
        <div class="globals-form-title">${isEdit ? 'Edit Global Variable' : 'Add a new global variable'}</div>

        <div class="globals-form-row">
          <label class="globals-label">Type</label>
          <select id="gf-type" class="globals-select">
            <option value="text"     ${curType==='text'    ?'selected':''}>String (text)</option>
            <option value="boolean"  ${curType==='boolean' ?'selected':''}>Boolean (true/false)</option>
            <option value="number"   ${curType==='number'  ?'selected':''}>Number</option>
            <option value="datetime" ${curType==='datetime'?'selected':''}>Date and Time</option>
            <option value="device"   ${curType==='device'  ?'selected':''}>Device</option>
          </select>
        </div>

        <div class="globals-form-row">
          <label class="globals-label">Name</label>
          <div class="globals-name-wrap">
            <span class="globals-at">@</span>
            <input type="text" id="gf-name" class="globals-input" placeholder="variable_name"
              value="${_esc(global?.name || '')}" autocomplete="off" spellcheck="false" />
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
            value="${_esc(global?.description || '')}" />
        </div>

        <div class="globals-form-error" id="gf-error" style="display:none"></div>

        <div class="globals-form-actions">
          <button class="btn btn-ghost btn-sm" id="gf-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="gf-save">${isEdit ? 'Save' : 'Add'}</button>
        </div>
      </div>
    `;

    const typeEl = document.getElementById('gf-type');
    typeEl.addEventListener('change', () => {
      _renderValueField(typeEl.value, null);
    });
    _renderValueField(curType, global?.value ?? null);

    document.getElementById('gf-cancel').addEventListener('click', _loadAndRender);
    document.getElementById('gf-save').addEventListener('click', () => _saveForm(isEdit));
  }

  function _renderValueField(varType, currentValue) {
    const container = document.getElementById('gf-value-field');
    if (!container) return;

    switch (varType) {
      case 'text':
        container.innerHTML = `<input type="text" id="gf-value" class="globals-input"
          value="${_esc(currentValue ?? '')}" />`;
        break;

      case 'boolean':
        container.innerHTML = `
          <select id="gf-value" class="globals-select">
            <option value="false" ${currentValue == 'false' || currentValue === false ? 'selected' : ''}>false</option>
            <option value="true"  ${currentValue == 'true'  || currentValue === true  ? 'selected' : ''}>true</option>
          </select>`;
        break;

      case 'number':
        container.innerHTML = `<input type="number" id="gf-value" class="globals-input"
          value="${_esc(String(currentValue ?? '0'))}" step="any" />`;
        break;

      case 'datetime':
        container.innerHTML = `<input type="datetime-local" id="gf-value" class="globals-input"
          value="${_esc(currentValue ?? '')}" />`;
        break;

      case 'device':
        _renderDevicePicker(container, currentValue);
        break;

      default:
        container.innerHTML = `<input type="text" id="gf-value" class="globals-input"
          value="${_esc(currentValue ?? '')}" />`;
    }
  }

  // ── Device multi-select picker ───────────────────────────
  // Matches WebCoRE image 10: searchable list, checkboxes, SelectAll/DeselectAll.
  // value is stored as an array of entity_id strings.

  function _renderDevicePicker(container, currentValue) {
    // Normalise current selection into the module-level _selectedDevices Set
    if (Array.isArray(currentValue)) {
      _selectedDevices = new Set(currentValue);
    } else if (currentValue && typeof currentValue === 'string') {
      _selectedDevices = new Set([currentValue]);
    } else {
      _selectedDevices = new Set();
    }
    const selected = _selectedDevices;

    container.innerHTML = `
      <div class="gf-device-picker" id="gf-device-picker">
        <div class="gf-device-summary" id="gf-device-summary">
          ${_deviceSummaryText(selected)}
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

    // Wire filter
    document.getElementById('gf-device-filter').addEventListener('input', (e) => {
      _renderDeviceRows(selected, e.target.value);
    });

    // Wire SelectAll / DeselectAll
    document.getElementById('gf-sel-all').addEventListener('click', () => {
      const q = document.getElementById('gf-device-filter')?.value || '';
      const visible = _filteredDevices(q);
      visible.forEach(d => selected.add(d.entity_id));
      _renderDeviceRows(selected, q);
      _updateSummary(selected);
    });

    document.getElementById('gf-sel-none').addEventListener('click', () => {
      const q = document.getElementById('gf-device-filter')?.value || '';
      const visible = _filteredDevices(q);
      visible.forEach(d => selected.delete(d.entity_id));
      _renderDeviceRows(selected, q);
      _updateSummary(selected);
    });

    // Render rows — fetching devices first if needed
    if (_devicesLoaded) {
      _renderDeviceRows(selected, '');
    } else {
      _prefetchDevices().then(() => _renderDeviceRows(selected, ''));
    }
  }

  // Allowed domains — same set as the wizard device picker.
  const _ALLOWED_DOMAINS = new Set([
    'light','switch','binary_sensor','sensor','media_player','cover','climate',
    'fan','lock','input_boolean','input_number','input_select','automation',
    'person','device_tracker','alarm_control_panel',
  ]);

  // Domain priority for picking the primary entity_id when a device has multiple.
  const _DOMAIN_PRIORITY = [
    'light','switch','cover','fan','climate','lock','media_player',
    'input_boolean','input_number','input_select','automation',
    'binary_sensor','sensor','person','device_tracker','alarm_control_panel',
  ];

  // Returns one entry per unique friendly_name with all entity_ids bundled.
  // User sees one row per physical device — no duplicate rows per entity.
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
    const byName = new Map();
    for (const d of allowed) {
      const name = d.friendly_name || d.entity_id;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(d.entity_id);
    }
    const result = [];
    for (const [friendly_name, entity_ids] of byName) {
      if (lq && !friendly_name.toLowerCase().includes(lq) &&
          !entity_ids.some(id => id.toLowerCase().includes(lq))) continue;
      let primary = entity_ids[0];
      for (const domain of _DOMAIN_PRIORITY) {
        const match = entity_ids.find(id => id.startsWith(domain + '.'));
        if (match) { primary = match; break; }
      }
      result.push({ friendly_name, entity_ids, primary_entity_id: primary });
    }
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
      // A grouped device is selected if any of its entity_ids are in the selection set
      const sel = d.entity_ids.some(id => selected.has(id));
      const eid = _esc(d.primary_entity_id);
      const label = _esc(d.friendly_name);
      return `<div class="gf-device-row ${sel ? 'selected' : ''}"
        data-id="${eid}"
        data-entity-ids="${_esc(JSON.stringify(d.entity_ids))}">
        <span class="gf-device-name">${label}</span>
        <span class="gf-device-check">${sel ? '✓' : ''}</span>
      </div>`;
    }).join('');

    list.querySelectorAll('.gf-device-row').forEach(row => {
      row.addEventListener('click', () => {
        let rowEntityIds;
        try { rowEntityIds = row.dataset.entityIds ? JSON.parse(row.dataset.entityIds) : [row.dataset.id]; }
        catch { rowEntityIds = [row.dataset.id]; }

        const isSelected = rowEntityIds.some(id => selected.has(id));
        if (isSelected) {
          rowEntityIds.forEach(id => selected.delete(id));
          row.classList.remove('selected');
          row.querySelector('.gf-device-check').textContent = '';
        } else {
          rowEntityIds.forEach(id => selected.add(id));
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

  // Read selected device entity IDs — collected from clicked rows stored in _selectedDevices
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
      _devicesLoaded = true; // don't keep retrying this session
    }
  }

  // ── Save form ─────────────────────────────────────────────
  async function _saveForm(isEdit) {
    const nameEl  = document.getElementById('gf-name');
    const typeEl  = document.getElementById('gf-type');
    const descEl  = document.getElementById('gf-desc');
    const errEl   = document.getElementById('gf-error');
    const saveBtn = document.getElementById('gf-save');
    if (!nameEl || !typeEl || !errEl || !saveBtn) return;

    const name     = nameEl.value.trim().replace(/^@+/, '');
    const var_type = typeEl.value;
    const description = descEl ? descEl.value.trim() : '';

    // Validate name
    if (!name) {
      _showFormError('Name is required.');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      _showFormError('Name must start with a letter or underscore and contain only letters, numbers, and underscores.');
      return;
    }

    // Read value — device type reads from checkboxes, others from #gf-value input
    let value;
    if (var_type === 'device') {
      value = _readDeviceSelection();
      if (value.length === 0) {
        _showFormError('Select at least one device.');
        return;
      }
    } else {
      const valueEl = document.getElementById('gf-value');
      value = valueEl ? valueEl.value : '';
    }

    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    errEl.style.display = 'none';

    try {
      if (isEdit && _editingId) {
        await API.updateGlobal(_editingId, { name, var_type, value, description });
      } else {
        await API.createGlobal({ name, var_type, value, description });
      }
      _editingId = null;
      await _loadAndRender();
    } catch (e) {
      saveBtn.textContent = isEdit ? 'Save' : 'Add';
      saveBtn.disabled = false;
      _showFormError(e.message || 'Save failed.');
    }
  }

  function _showFormError(msg) {
    const errEl = document.getElementById('gf-error');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.style.display = '';
  }

  // ── Delete ────────────────────────────────────────────────
  function _confirmDelete(g) {
    if (!confirm(`Delete global @${g.name}?\n\nAny pistons referencing this variable will break.`)) return;
    API.deleteGlobal(g.id)
      .then(_loadAndRender)
      .catch(e => alert(`Delete failed: ${e.message}`));
  }

  // ── Helpers ───────────────────────────────────────────────
  function _typeLabel(var_type) {
    switch (var_type) {
      case 'text':     return 'String';
      case 'boolean':  return 'Boolean';
      case 'number':   return 'Number';
      case 'datetime': return 'Date/Time';
      case 'device':   return 'Device';
      default:         return var_type || '?';
    }
  }

  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Boot ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Close button inside the drawer
    document.getElementById('globals-drawer-close')?.addEventListener('click', close);

    // Mousedown outside the drawer closes it (mousedown fires before click,
    // avoiding race with the open() call on the Globals button)
    document.addEventListener('mousedown', (e) => {
      const el = drawer();
      if (!el || !el.classList.contains('open')) return;
      if (el.contains(e.target)) return;
      if (e.target.closest('#btn-globals')) return;
      close();
    });

    // Wire the global header button (works from any page)
    document.getElementById('btn-globals')?.addEventListener('click', open);
  });

  return { open, close };

})();

window.GlobalsDrawer = GlobalsDrawer;
