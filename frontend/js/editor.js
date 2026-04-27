// pistoncore/frontend/js/editor.js
//
// Page 3 — Piston Editor
// Continuous document renderer — WebCoRE style.
// No boxes or section headers. Line numbers, teal keywords,
// ghost text insertion points, right-click context menu.
// Save → navigates to status page.
// Globals accessible via header button (GlobalsDrawer).

const Editor = (() => {

  const container = document.getElementById('page-editor');
  let _piston = null;
  let _stmtCounter = 0;
  let _selectedId = null;
  let _cutId = null;
  let _isNew = false;  // true when piston was just created and never saved

  // ── Load ─────────────────────────────────────────────────
  async function load(pistonId, opts = {}) {
    if (!container) return;
    _isNew = opts.isNew || false;
    container.innerHTML = `<div class="editor-loading"><div class="spinner"></div> Loading...</div>`;
    try {
      _piston = await API.getPiston(pistonId);
      _stmtCounter = _highestStmtId(_piston);
      App.state.unsavedChanges = false;
      _selectedId = null;
      _cutId = null;
      render();
    } catch (e) {
      container.innerHTML = `<div class="banner banner-error">Could not load piston: ${_esc(e.message)}</div>`;
    }
  }

  // ── Render ───────────────────────────────────────────────
  function render() {
    if (!container || !_piston) return;
    const p = _piston;
    const isSimple = App.state.simpleMode;
    const isPy = (p.compile_target || '').toLowerCase().includes('pyscript');

    container.innerHTML = `
      <!-- Toolbar — mirrors WebCoRE top bar layout -->
      <div class="editor-toolbar">
        <div class="editor-tb-left">
          <button class="etb-icon" id="btn-editor-cancel" title="Cancel — return to status page">✕</button>
          <div class="etb-sep"></div>
          <div class="etb-mode-toggle">
            <button class="${isSimple ? 'active' : ''}" id="toggle-simple">Simple</button>
            <button class="${!isSimple ? 'active' : ''}" id="toggle-adv">Advanced</button>
          </div>
        </div>

        <div class="editor-tb-center">
          <input type="text" id="editor-piston-name" class="editor-name-input" value="${_esc(p.name || '')}" placeholder="Piston name..." />
          <span class="unsaved-dot" id="unsaved-dot" style="display:none" title="Unsaved changes">●</span>
        </div>

        <div class="editor-tb-right">
          <button class="btn btn-danger btn-sm" id="btn-editor-delete">🗑 Delete</button>
          <button class="btn btn-primary btn-sm" id="btn-save">💾 Save</button>
          <button class="btn btn-ghost btn-sm" id="btn-editor-options">Options ▾</button>
          <span class="etb-sep"></span>
          <button class="btn btn-ghost btn-sm" id="btn-editor-cancel-text">Cancel</button>
        </div>
      </div>

      <!-- PyScript warning — only shown when piston crosses threshold -->
      <div class="pyscript-warning" id="pyscript-warning" ${isPy ? '' : 'style="display:none"'}>
        ⚠ This piston requires PyScript — some features will not work without the companion integration.
      </div>

      <!-- Editor notice (save errors, warnings) -->
      <div id="editor-notice"></div>

      <!-- Main document -->
      <div class="editor-doc" id="editor-doc">
        ${_renderDocument(p, isSimple)}
      </div>

      <!-- Context menu anchor -->
    `;

    _wireEvents();
    _markUnsaved(false);
  }

  // ── Document renderer ────────────────────────────────────
  function _renderDocument(p, isSimple) {
    const lines = [];
    const num = { n: 1 };

    // ln() — numbered line
    const ln = (html, indent, opts = {}) => {
      const { id, type } = opts;
      const sel = id && id === _selectedId;
      const cut = id && id === _cutId;
      const cls = ['doc-line',
        id ? 'doc-stmt' : '',
        sel ? 'doc-selected' : '',
        cut ? 'doc-cut' : '',
      ].filter(Boolean).join(' ');
      const attrs = id ? `data-id="${_esc(id)}" data-type="${_esc(type||'')}"` : '';
      const ind = indent > 0 ? `style="padding-left:calc(var(--doc-indent)*${indent})"` : '';
      lines.push(`<div class="${cls}" ${attrs} ${ind}><span class="doc-ln">${num.n++}</span><span class="doc-lc">${html}</span></div>`);
    };

    // gh() — ghost text line (no line number)
    const gh = (text, ctx, indent, extra = {}) => {
      const attrs = Object.entries(extra).map(([k,v]) => `data-${k}="${_esc(String(v))}"`).join(' ');
      const ind = indent > 0 ? `style="padding-left:calc(var(--doc-indent)*${indent})"` : '';
      lines.push(`<div class="doc-line doc-ghost" ${ind}><span class="doc-ln"></span><span class="doc-lc"><span class="ghost" data-insert="${_esc(ctx)}" ${attrs}>· ${_esc(text)}</span></span></div>`);
    };

    // ── Comment header ──
    ln(_cm(`************************************************************`), 0);
    ln(_cm(`* ${p.name || 'Untitled'}`), 0);
    ln(_cm(`************************************************************`), 0);
    if (p.author) ln(_cm(`* Author    : ${p.author}`), 0);
    ln(_cm(`* Created   : ${_fmtDate(p.created_at)}`), 0);
    ln(_cm(`* Modified  : ${_fmtDate(p.updated_at)}`), 0);
    ln(_cm(`************************************************************`), 0);
    // ── settings block ──
    ln(`<span class="kw">settings</span>`, 0);
    ln(`<span class="kw">end settings;</span>`, 0);

    // blank line
    lines.push(`<div class="doc-line doc-blank"><span class="doc-ln">${num.n++}</span><span class="doc-lc"></span></div>`);

    // ── define block ──
    ln(`<span class="kw">define</span>`, 0);
    if (!isSimple) {
      (p.variables || []).forEach(v => {
        const typeKw = _kw(_typeLabel(v.var_type));
        const varName = _esc(v.name || '');
        let valueStr = '';
        if (v.initial_value !== undefined && v.initial_value !== '') {
          // Device variables: show "= DeviceLabel" like WebCoRE
          // Other types: show "= value"
          valueStr = ` = <span class="doc-dev-inline">${_esc(String(v.initial_value))}</span>`;
        }
        ln(`${typeKw} ${varName}${valueStr} ;`, 1, { id: v.id, type: 'variable' });
      });
      gh('+ add a new variable', 'variable', 1);
    }
    ln(`<span class="kw">end define;</span>`, 0);

    // blank line
    lines.push(`<div class="doc-line doc-blank"><span class="doc-ln">${num.n++}</span><span class="doc-lc"></span></div>`);

    // ── top-level only when (restrictions) — advanced mode only or when populated ──
    const restrictions = p.restrictions || [];
    if (restrictions.length || !isSimple) {
      ln(`<span class="kw">only when</span>`, 0);
      restrictions.forEach(r => ln(_condLine(r), 1, { id: r.id, type: 'restriction' }));
      gh('· add a new restriction', 'restriction', 1);
      lines.push(`<div class="doc-line doc-blank"><span class="doc-ln">${num.n++}</span><span class="doc-lc"></span></div>`);
    }

    // ── execute block ──
    ln(`<span class="kw">execute</span>`, 0);

    // only when inside execute — only render if triggers/conditions exist OR advanced mode
    const triggers = p.triggers || [];
    const conditions = p.conditions || [];
    if (triggers.length || conditions.length || !isSimple) {
      ln(`<span class="kw">only when</span>`, 1);
      triggers.forEach(t => {
        ln(`<span class="doc-bolt">⚡</span> ${_condLine(t)}`, 2, { id: t.id, type: 'trigger' });
      });
      conditions.forEach(c => {
        ln(_condLine(c), 2, { id: c.id, type: 'condition' });
      });
      gh('· add a new trigger or condition', 'trigger_or_condition', 2);
    }
    // Simple mode with no triggers/conditions: skip the only when block entirely.

    // action nodes
    _actionLines(p.actions || [], 1, lines, num, gh);

    gh('· add a new statement', 'action', 1);
    ln(`<span class="kw">end execute;</span>`, 0);

    return lines.join('\n');
  }

  // ── Recursive action renderer ────────────────────────────
  function _actionLines(nodes, depth, lines, num, gh) {
    const pad = Math.min(depth, 7);

    const ln = (html, indent, opts = {}) => {
      const { id, type } = opts;
      const sel = id && id === _selectedId;
      const cut = id && id === _cutId;
      const cls = ['doc-line', id ? 'doc-stmt' : '', sel ? 'doc-selected' : '', cut ? 'doc-cut' : ''].filter(Boolean).join(' ');
      const attrs = id ? `data-id="${_esc(id)}" data-type="${_esc(type||'')}"` : '';
      const ind = indent > 0 ? `style="padding-left:calc(var(--doc-indent)*${indent})"` : '';
      lines.push(`<div class="${cls}" ${attrs} ${ind}><span class="doc-ln">${num.n++}</span><span class="doc-lc">${html}</span></div>`);
    };

    nodes.forEach(node => {
      const id = node.id || '';
      const t = node.type;

      if (t === 'if_block') {
        ln(`<span class="kw">if</span>`, pad, { id, type: t });
        (node.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
        gh('· add a new condition', 'if_condition', pad + 1, { 'block-id': id });
        ln(`<span class="kw">then</span>`, pad);
        _actionLines(node.then_actions || [], depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { branch: 'then', 'block-id': id });
        (node.else_if_blocks || []).forEach(eib => {
          ln(`<span class="kw">else if</span>`, pad);
          (eib.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
          ln(`<span class="kw">then</span>`, pad);
          _actionLines(eib.actions || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { branch: 'else_if', 'block-id': eib.id });
        });
        if (node.else_actions !== undefined) {
          ln(`<span class="kw">else</span>`, pad);
          _actionLines(node.else_actions || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { branch: 'else', 'block-id': id });
        }
        ln(`<span class="kw">end if;</span>`, pad);

      } else if (t === 'with_block') {
        ln(`<span class="kw">with</span>`, pad, { id, type: t });
        (node.devices || []).forEach(d => ln(`    ${_dr(d.label || d.role || d)}`, pad + 1));
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.tasks || [], depth + 2, lines, num, gh);
        gh('· add a new task', 'task', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end with;</span>`, pad);

      } else if (t === 'for_each') {
        const dv = node.device_var ? _dv('$', node.device_var) : _dr(node.device_list || '');
        const lv = node.list_var ? _dv('@', node.list_var) : _dr(node.device_list || '');
        ln(`<span class="kw">for each</span> (${dv} <span class="kw">in</span> ${lv})`, pad, { id, type: t });
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.actions || [], depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end for each;</span>`, pad);

      } else if (t === 'while_loop') {
        ln(`<span class="kw">while</span>`, pad, { id, type: t });
        (node.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.actions || [], depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end while;</span>`, pad);

      } else if (t === 'repeat_loop') {
        ln(`<span class="kw">repeat</span> ${_esc(String(node.times ?? '?'))} <span class="kw">times</span>`, pad, { id, type: t });
        _actionLines(node.actions || [], depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end repeat;</span>`, pad);

      } else if (t === 'wait') {
        const w = node.wait_type === 'duration'
          ? `<span class="kw">wait</span> ${_esc(node.duration||'')} ${_esc(node.unit||'')};`
          : node.wait_type === 'time'
          ? `<span class="kw">wait until</span> ${_esc(node.time||'')};`
          : `<span class="kw">wait</span>;`;
        ln(w, pad, { id, type: t });

      } else if (t === 'set_variable') {
        ln(`<span class="kw">set variable</span> ${_dv('$', node.variable)} = ${_val(node.value)};`, pad, { id, type: t });

      } else if (t === 'service_call') {
        const params = node.parameters
          ? Object.entries(node.parameters).map(([k,v]) => `<span class="doc-param-k">${_esc(k)}</span>: ${_val(v)}`).join(', ')
          : '';
        ln(`<span class="doc-svc">●</span> <span class="kw">do</span> ${_esc(node.service||'call service')}${params ? ` <span class="doc-params">${params}</span>` : ''};`, pad, { id, type: t });

      } else if (t === 'log') {
        ln(`<span class="kw">log</span> <span class="doc-str">"${_esc(node.message||'')}"</span>;`, pad, { id, type: t });

      } else if (t === 'stop') {
        ln(`<span class="kw">stop</span>${node.reason ? ' — ' + _esc(node.reason) : ''};`, pad, { id, type: t });

      } else if (t === 'call_piston') {
        ln(`<span class="kw">execute piston</span> ${_esc(node.target_name||node.target||'')};`, pad, { id, type: t });

      } else {
        ln(_esc(node.description || node.label || node.type || '[statement]') + ';', pad, { id, type: t });
      }
    });
  }

  // ── Inline helpers ───────────────────────────────────────
  function _condLine(c) {
    if (!c) return '<span class="doc-ph">[condition]</span>';
    const agg = c.aggregation && c.aggregation !== 'null'
      ? `<span class="kw">${_esc({any:'Any of',all:'All of',none:'None of'}[c.aggregation]||c.aggregation)}</span> `
      : '';
    const subj = _subj(c.subject);
    const attr = c.subject?.capability ? ` <span class="doc-attr">${_esc(c.subject.capability)}</span>` : '';
    const op   = c.operator ? ` <span class="kw">${_esc(c.operator)}</span>` : '';
    const val  = c.display_value !== undefined ? ` ${_esc(String(c.display_value))}` : '';
    const dur  = c.duration ? ` <span class="kw">for</span> ${_esc(String(c.duration))}` : '';
    const gop  = c.group_operator ? ` <span class="kw doc-gop">${_esc(c.group_operator)}</span>` : '';
    return `${agg}${subj}${attr}${op}${val}${dur}${gop}`;
  }

  function _subj(s) {
    if (!s) return '';
    if (s.type === 'device')   return _dr(s.role || s.entity_id || 'device');
    if (s.type === 'variable') return _dv('$', s.name || '');
    if (s.type === 'global')   return _dv('@', s.name || '');
    return `<span class="kw">${_esc(s.type || '')}</span>`;
  }

  function _val(v) {
    if (v === null || v === undefined) return '<span class="doc-ph">?</span>';
    if (typeof v === 'object' && v.__type === 'variable') return _dv('$', v.name || '');
    if (typeof v === 'object' && v.__type === 'global')   return _dv('@', v.name || '');
    return _esc(String(v));
  }

  function _typeLabel(t) {
    return { string:'string', boolean:'boolean', integer:'number (integer)', decimal:'number (decimal)', long:'large number', datetime:'date and time', date:'date', time:'time', device:'device', dynamic:'dynamic' }[t] || t || 'dynamic';
  }

  function _dr(label) { return `<span class="doc-dev">{${_esc(label)}}</span>`; }
  function _dv(sig, name) { return `<span class="doc-var">${_esc(sig)}${_esc(name)}</span>`; }
  function _kw(text) { return `<span class="kw">${_esc(text)}</span>`; }
  function _cm(text) { return `<span class="doc-cmt">/* ${_esc(text)} */</span>`; }

  // ── Event wiring ─────────────────────────────────────────
  function _wireEvents() {
    document.getElementById('btn-editor-cancel')?.addEventListener('click', _handleCancel);
    document.getElementById('btn-editor-cancel-text')?.addEventListener('click', _handleCancel);
    document.getElementById('btn-save')?.addEventListener('click', () => save());
    document.getElementById('btn-editor-delete')?.addEventListener('click', _handleDelete);
    document.getElementById('toggle-simple')?.addEventListener('click', () => { App.state.simpleMode = true; render(); });
    document.getElementById('toggle-adv')?.addEventListener('click', () => { App.state.simpleMode = false; render(); });

    // Name input — mark unsaved on change
    document.getElementById('editor-piston-name')?.addEventListener('input', () => _markUnsaved(true));

    const doc = document.getElementById('editor-doc');
    if (doc) {
      doc.addEventListener('click', _handleDocClick);
      doc.addEventListener('contextmenu', _handleContextMenu);
    }
  }

  function _handleDocClick(e) {
    const ghost = e.target.closest('.ghost');
    if (ghost) {
      const ctx = ghost.dataset.insert;
      const extra = {};
      for (const k of Object.keys(ghost.dataset)) { if (k !== 'insert') extra[k] = ghost.dataset[k]; }
      Wizard.open(ctx, null, extra);
      return;
    }
    const stmt = e.target.closest('.doc-stmt');
    if (stmt) { _selectStmt(stmt.dataset.id); return; }  }

  function _handleContextMenu(e) {
    const stmt = e.target.closest('.doc-stmt');
    if (!stmt) return;
    e.preventDefault();
    _selectStmt(stmt.dataset.id);
    App.showContextMenu(e.clientX, e.clientY, [
      { label: 'Edit statement',               action: () => _editSelected() },
      { label: 'Copy selected statement',      action: () => _copySelected() },
      { label: 'Duplicate selected statement', action: () => _duplicateSelected() },
      { separator: true },
      { label: 'Cut selected statement',       action: () => _cutSelected() },
      { label: 'Paste after selected',         action: () => _pasteSelected(), disabled: !App.state.clipboard },
      { separator: true },
      { label: 'Delete selected statement',    action: () => _deleteSelected(), danger: true },
      { separator: true },
      { label: 'Clear clipboard',              action: () => { App.state.clipboard = null; } },
    ]);
  }

  function _selectStmt(id) {
    _selectedId = id;
    document.querySelectorAll('.doc-stmt').forEach(el => {
      el.classList.toggle('doc-selected', el.dataset.id === id);
    });
  }

  function _editSelected() {
    if (!_selectedId) return;
    const all = [...(_piston.triggers||[]), ...(_piston.conditions||[]), ...(_piston.actions||[])];
    const node = _findNode(all, _selectedId);
    if (node) Wizard.open(node.type, node, {});
  }
  function _copySelected() {
    if (!_selectedId) return;
    const all = [...(_piston.triggers||[]), ...(_piston.conditions||[]), ...(_piston.actions||[])];
    const node = _findNode(all, _selectedId);
    if (node) App.state.clipboard = JSON.parse(JSON.stringify(node));
  }

  function _duplicateSelected() { _copySelected(); _pasteSelected(); }

  function _cutSelected() {
    _copySelected();
    _cutId = _selectedId;
    document.querySelectorAll('.doc-stmt').forEach(el => {
      el.classList.toggle('doc-cut', el.dataset.id === _cutId);
    });
  }

  function _pasteSelected() {
    if (!App.state.clipboard) return;
    const clone = JSON.parse(JSON.stringify(App.state.clipboard));
    clone.id = _nextStmtId();
    if (_selectedId) { if (!_insertAfter(_piston.actions, _selectedId, clone)) _piston.actions.push(clone); }
    else _piston.actions.push(clone);
    _cutId = null;
    _markUnsaved(true);
    render();
  }

  function _deleteSelected() {
    if (!_selectedId) return;
    _removeNode(_piston.triggers, _selectedId) ||
    _removeNode(_piston.conditions, _selectedId) ||
    _removeNode(_piston.actions, _selectedId);
    _selectedId = null;
    _markUnsaved(true);
    render();
  }

  function _handleCancel() {
    if (_isNew) {
      // Brand new piston — offer to discard entirely
      App.confirm({
        title: 'Discard new piston?',
        message: 'This piston has never been saved. Discard it and go back to the list?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
        onConfirm: async () => {
          try { await API.deletePiston(_piston.id); } catch {}
          App.navigate('list');
        },
      });
    } else if (App.state.unsavedChanges) {
      App.confirm({
        title: 'Unsaved changes',
        message: 'Leave without saving?',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        danger: true,
        onConfirm: () => App.navigate('status', { pistonId: _piston.id }),
      });
    } else {
      App.navigate('status', { pistonId: _piston.id });
    }
  }

  function _handleDelete() {
    App.confirm({
      title: 'Delete piston',
      message: `Delete "${_piston.name || 'this piston'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try { await API.deletePiston(_piston.id); App.navigate('list'); }
        catch(e) { _showNotice(`Delete failed: ${e.message}`, 'error'); }
      },
    });
  }

  // ── Save ─────────────────────────────────────────────────
  async function save() {
    // Read name from toolbar input
    const nameInput = document.getElementById('editor-piston-name');
    if (nameInput) _piston.name = nameInput.value.trim();

    if (!_piston.name) {
      if (nameInput) { nameInput.focus(); nameInput.style.borderColor = 'var(--red)'; }
      _showNotice('Piston name is required.', 'error');
      return false;
    }

    const btn = document.getElementById('btn-save');
    if (btn) { btn.textContent = '💾 Saving...'; btn.disabled = true; }

    try {
      const result = await API.savePiston(_piston.id, _piston);
      _piston = result.piston || _piston;
      _isNew = false;
      _markUnsaved(false);

      const warnings = result.compile_check?.warnings || [];
      const errors   = result.compile_check?.errors   || [];

      // Check if piston now requires PyScript and show/hide warning bar
      const needsPy = (result.piston?.compile_target || '').toLowerCase().includes('pyscript');
      const warn = document.getElementById('pyscript-warning');
      if (warn) warn.style.display = needsPy ? '' : 'none';

      if (errors.length || warnings.length) {
        _showNotice([...errors.map(e=>`⚠ ${e}`),...warnings.map(w=>`⚠ ${w}`)].join(' | '), 'warn');
        // Stay in editor so user can address warnings
        return true;
      }

      // Navigate to status page on clean save
      App.navigate('status', { pistonId: _piston.id });
      return true;

    } catch(e) {
      _showNotice(`Save failed — your work is preserved. ${e.message}`, 'error');
      return false;
    } finally {
      if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
    }
  }

  // Called by wizard when it completes building a statement
  function insertStatement(context, statementData) {
    if (context === 'trigger' || statementData.type === 'trigger') {
      _piston.triggers = _piston.triggers || [];
      const i = _piston.triggers.findIndex(t => t.id === statementData.id);
      if (i >= 0) _piston.triggers[i] = statementData; else _piston.triggers.push(statementData);
    } else if (context === 'condition' || statementData.type === 'condition') {
      _piston.conditions = _piston.conditions || [];
      const i = _piston.conditions.findIndex(c => c.id === statementData.id);
      if (i >= 0) _piston.conditions[i] = statementData; else _piston.conditions.push(statementData);
    } else if (context === 'variable') {
      _piston.variables = _piston.variables || [];
      const i = _piston.variables.findIndex(v => v.id === statementData.id);
      if (i >= 0) _piston.variables[i] = statementData; else _piston.variables.push(statementData);
    } else {
      if (!statementData.id) statementData.id = _nextStmtId();
      if (_selectedId) { if (!_insertAfter(_piston.actions, _selectedId, statementData)) _piston.actions.push(statementData); }
      else _piston.actions.push(statementData);
    }
    _markUnsaved(true);
    render();
  }

  // ── Helpers ──────────────────────────────────────────────
  function _markUnsaved(has) {
    App.state.unsavedChanges = has;
    const dot = document.getElementById('unsaved-dot');
    if (dot) dot.style.display = has ? 'inline' : 'none';
  }

  function _showNotice(msg, type) {
    const el = document.getElementById('editor-notice');
    if (!el) return;
    el.innerHTML = `<div class="banner banner-${type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'info'} editor-notice-bar">${_esc(msg)}</div>`;
    if (type === 'info') setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _findNode(nodes, id) {
    if (!nodes) return null;
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = _findNode(n.then_actions,id)||_findNode(n.else_actions,id)||
                _findNode(n.actions,id)||_findNode(n.tasks,id)||_findNode(n.conditions,id);
      if (f) return f;
    }
    return null;
  }

  function _removeNode(nodes, id) {
    if (!nodes) return false;
    const i = nodes.findIndex(n => n.id === id);
    if (i !== -1) { nodes.splice(i, 1); return true; }
    for (const n of nodes) {
      if (_removeNode(n.then_actions,id)||_removeNode(n.else_actions,id)||
          _removeNode(n.actions,id)||_removeNode(n.tasks,id)) return true;
    }
    return false;
  }

  function _insertAfter(nodes, id, newNode) {
    if (!nodes) return false;
    const i = nodes.findIndex(n => n.id === id);
    if (i !== -1) { nodes.splice(i+1, 0, newNode); return true; }
    for (const n of nodes) {
      if (_insertAfter(n.then_actions,id,newNode)||_insertAfter(n.else_actions,id,newNode)||
          _insertAfter(n.actions,id,newNode)||_insertAfter(n.tasks,id,newNode)) return true;
    }
    return false;
  }

  function _highestStmtId(piston) {
    let max = 0;
    function walk(nodes) {
      (nodes||[]).forEach(n => {
        const m = parseInt((n.id||'').replace(/\D/g,''))||0;
        if (m > max) max = m;
        walk(n.then_actions); walk(n.else_actions); walk(n.actions); walk(n.tasks);
      });
    }
    walk(piston.triggers); walk(piston.conditions); walk(piston.actions); walk(piston.variables);
    return max;
  }

  function _nextStmtId() {
    _stmtCounter++;
    return 'stmt_' + String(_stmtCounter).padStart(3,'0');
  }

  return { load, save, insertStatement, deleteStatement: _deleteSelected, getPistonVariables: () => (_piston?.variables || []) };

})();
