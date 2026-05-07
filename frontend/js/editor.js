// pistoncore/frontend/js/editor.js
//
// Page 3 — Piston Editor
// Continuous document renderer — WebCoRE style.
// No boxes or section headers. Line numbers, teal keywords,
// ghost text insertion points, right-click context menu.
// Save → navigates to status page.

const Editor = (() => {

  const container = document.getElementById('page-editor');
  let _piston = null;
  let _stmtCounter = 0;
  let _selectedId = null;
  let _cutId = null;
  let _isNew = false;

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

      <div class="pyscript-warning" id="pyscript-warning" ${isPy ? '' : 'style="display:none"'}>
        ⚠ This piston requires PyScript — some features will not work without the companion integration.
      </div>

      <div id="editor-notice"></div>

      <div class="editor-doc" id="editor-doc">
        ${_renderDocument(p, isSimple)}
      </div>
    `;

    _wireEvents();
    _markUnsaved(false);
  }

  // ── Document renderer ────────────────────────────────────
  function _renderDocument(p, isSimple) {
    const lines = [];
    const num = { n: 1 };

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

    const gh = (text, ctx, indent, extra = {}) => {
      const attrs = Object.entries(extra).map(([k,v]) => `data-${k}="${_esc(String(v))}"`).join(' ');
      const ind = indent > 0 ? `style="padding-left:calc(var(--doc-indent)*${indent})"` : '';
      lines.push(`<div class="doc-line doc-ghost" ${ind}><span class="doc-ln"></span><span class="doc-lc"><span class="ghost" data-insert="${_esc(ctx)}" ${attrs}>· ${_esc(text)}</span></span></div>`);
    };

    // Comment header
    ln(_cm(`************************************************************`), 0);
    ln(_cm(`* ${p.name || 'Untitled'}`), 0);
    ln(_cm(`************************************************************`), 0);
    if (p.author) ln(_cm(`* Author    : ${p.author}`), 0);
    ln(_cm(`* Created   : ${_fmtDate(p.created_at)}`), 0);
    ln(_cm(`* Modified  : ${_fmtDate(p.updated_at)}`), 0);
    ln(_cm(`************************************************************`), 0);

    // settings block
    ln(`<span class="kw">settings</span>`, 0);
    ln(`<span class="kw">end settings;</span>`, 0);

    lines.push(`<div class="doc-line doc-blank"><span class="doc-ln">${num.n++}</span><span class="doc-lc"></span></div>`);

    // define block — ALWAYS shown in both Simple and Advanced
    ln(`<span class="kw">define</span>`, 0);
    (p.variables || []).forEach(v => {
      const typeKw = _kw(_typeLabel(v.var_type));
      const varName = _esc(v.name || '');
      let valueStr = '';
      if (v.initial_value !== undefined && v.initial_value !== '') {
        valueStr = ` = <span class="doc-dev-inline">${_esc(String(v.initial_value))}</span>`;
      }
      ln(`${typeKw} ${varName}${valueStr} ;`, 1, { id: v.id, type: 'variable' });
    });
    gh('+ add a new variable', 'variable', 1);
    ln(`<span class="kw">end define;</span>`, 0);

    lines.push(`<div class="doc-line doc-blank"><span class="doc-ln">${num.n++}</span><span class="doc-lc"></span></div>`);

    // only when restrictions — hidden in simple mode unless populated
    const restrictions = p.restrictions || [];
    if (restrictions.length || !isSimple) {
      ln(`<span class="kw">only when</span>`, 0);
      restrictions.forEach(r => ln(_condLine(r), 1, { id: r.id, type: 'restriction' }));
      if (!isSimple) gh('· add a new restriction', 'restriction', 1);
      lines.push(`<div class="doc-line doc-blank"><span class="doc-ln">${num.n++}</span><span class="doc-lc"></span></div>`);
    }

    // execute block
    ln(`<span class="kw">execute</span>`, 0);

    const triggers = p.triggers || [];
    const conditions = p.conditions || [];
    if (triggers.length || conditions.length || !isSimple) {
      ln(`<span class="kw">only when</span>`, 1);
      triggers.forEach(t => {
        ln(`<span class="doc-bolt">⚡</span> ${_condLine(t)}`, 2, { id: t.id, type: 'trigger' });
      });
      conditions.forEach(c => {
        const bolt = c.is_trigger ? `<span class="doc-bolt">⚡</span> ` : '';
        ln(`${bolt}${_condLine(c)}`, 2, { id: c.id, type: c.is_trigger ? 'trigger' : 'condition' });
      });
      if (!isSimple) gh('· add a new trigger or condition', 'trigger_or_condition', 2);
    }

    const stmtMap = Object.fromEntries((p.statements || []).map(s => [s.id, s]));
    _actionLines((p.statements || []).map(s => s.id), stmtMap, 1, lines, num, gh);

    gh('· add a new statement', 'action', 1);
    ln(`<span class="kw">end execute;</span>`, 0);

    return lines.join('\n');
  }



  // ── Flat action renderer ─────────────────────────────────
  // childIds: array of statement IDs to render at this level
  // stmtMap:  Object.fromEntries of the flat statements array
  function _actionLines(childIds, stmtMap, depth, lines, num, gh) {
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

    (childIds || []).forEach(cid => {
      const node = stmtMap[cid];
      if (!node) return; // dangling reference — skip silently
      const id = node.id || '';
      const t = node.type;

      if (t === 'if') {
        ln(`<span class="kw">if</span>`, pad, { id, type: t });
        (node.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
        gh('· add a new condition', 'if_condition', pad + 1, { 'block-id': id });
        ln(`<span class="kw">then</span>`, pad);
        _actionLines(node.then || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { branch: 'then', 'block-id': id });
        (node.else_ifs || []).forEach(eib => {
          ln(`<span class="kw">else if</span>`, pad);
          (eib.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
          ln(`<span class="kw">then</span>`, pad);
          _actionLines(eib.statements || [], stmtMap, depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { branch: 'else_if', 'block-id': eib.id });
        });
        if (node.else !== undefined && node.else !== null) {
          ln(`<span class="kw">else</span>`, pad);
          _actionLines(node.else || [], stmtMap, depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { branch: 'else', 'block-id': id });
        }
        ln(`<span class="kw">end if;</span>`, pad);

      } else if (t === 'action') {
        ln(`<span class="kw">with</span>`, pad, { id, type: t });
        (node.devices || []).forEach(d => ln(`    ${_dr(d)}`, pad + 1));
        ln(`<span class="kw">do</span>`, pad);
        // tasks are task objects embedded in the action node, not flat stmt IDs
        (node.tasks || []).forEach(task => {
          const params = task.parameters
            ? Object.entries(task.parameters).map(([k,v]) => `<span class="doc-param-k">${_esc(k)}</span>: ${_val(v)}`).join(', ')
            : '';
          ln(`${_esc(task.service || task.command || 'call service')}${params ? ` <span class="doc-params">${params}</span>` : ''};`, pad + 2, { id: task.id, type: 'task' });
        });
        gh('· add a new task', 'task', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end with;</span>`, pad);

      } else if (t === 'for_each') {
        const dv = node.variable ? _dv('$', node.variable) : _dr(node.list_role || '');
        const lv = _dr(node.list_role || '');
        ln(`<span class="kw">for each</span> (${dv} <span class="kw">in</span> ${lv})`, pad, { id, type: t });
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end for each;</span>`, pad);

      } else if (t === 'while') {
        ln(`<span class="kw">while</span>`, pad, { id, type: t });
        (node.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end while;</span>`, pad);

      } else if (t === 'repeat') {
        ln(`<span class="kw">repeat</span>`, pad, { id, type: t });
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">until</span>`, pad);
        (node.until_conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
        ln(`<span class="kw">end repeat;</span>`, pad);

      } else if (t === 'for') {
        const varPart = node.variable ? _dv('$', node.variable) : '<span class="doc-ph">$i</span>';
        const fromPart = node.from !== undefined ? _esc(String(node.from)) : '<span class="doc-ph">from</span>';
        const toPart   = node.to   !== undefined ? _esc(String(node.to))   : '<span class="doc-ph">to</span>';
        const stepPart = node.step !== undefined && node.step !== 1 ? ` step ${_esc(String(node.step))}` : '';
        ln(`<span class="kw">for</span> (${varPart} = ${fromPart} <span class="kw">to</span> ${toPart}${stepPart})`, pad, { id, type: t });
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end for;</span>`, pad);

      } else if (t === 'do') {
        ln(`<span class="kw">do</span>`, pad, { id, type: t });
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end do;</span>`, pad);

      } else if (t === 'switch') {
        const subjPart = node.variable ? _dv('$', node.variable) : (node.role ? _dr(node.role) : '<span class="doc-ph">[subject]</span>');
        ln(`<span class="kw">switch</span> (${subjPart})`, pad, { id, type: t });
        (node.cases || []).forEach(c => {
          ln(`<span class="kw">case</span> ${_esc(String(c.value ?? ''))}<span class="kw">:</span>`, pad + 1);
          _actionLines(c.statements || [], stmtMap, depth + 3, lines, num, gh);
          gh('· add a new statement', 'action', pad + 3, { 'block-id': c.id || id });
        });
        if (node.default_statements !== undefined) {
          ln(`<span class="kw">default:</span>`, pad + 1);
          _actionLines(node.default_statements || [], stmtMap, depth + 3, lines, num, gh);
          gh('· add a new statement', 'action', pad + 3, { branch: 'default', 'block-id': id });
        }
        ln(`<span class="kw">end switch;</span>`, pad);

      } else if (t === 'every') {
        const interval = node.interval !== undefined ? _esc(String(node.interval)) : '<span class="doc-ph">?</span>';
        const unit = _esc(node.interval_unit || '');
        ln(`<span class="kw">every</span> ${interval} ${unit}`, pad, { id, type: t });
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end every;</span>`, pad);

      } else if (t === 'on_event') {
        const evtPart = node.event_name ? _esc(node.event_name) : '<span class="doc-ph">[event]</span>';
        ln(`<span class="kw">on event</span> ${evtPart}`, pad, { id, type: t });
        ln(`<span class="kw">do</span>`, pad);
        _actionLines(node.statements || [], stmtMap, depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        ln(`<span class="kw">end on event;</span>`, pad);

      } else if (t === 'wait') {
        const w = node.wait_type === 'duration'
          ? `<span class="kw">wait</span> ${_esc(String(node.duration||''))} ${_esc(node.duration_unit||node.unit||'')};`
          : node.wait_type === 'time'
          ? `<span class="kw">wait until</span> ${_esc(node.time||'')};`
          : node.wait_type === 'state'
          ? `<span class="kw">wait for state</span> ${_condLine(node.condition || {})};`
          : `<span class="kw">wait</span>;`;
        ln(w, pad, { id, type: t });

      } else if (t === 'wait_for_state') {
        ln(`<span class="kw">wait for state</span> ${_condLine(node.condition || {})};`, pad, { id, type: t });

      } else if (t === 'set_variable') {
        ln(`<span class="kw">set variable</span> ${_dv('$', node.variable || '')} = ${_val(node.value)};`, pad, { id, type: t });

      } else if (t === 'log_message') {
        ln(`<span class="kw">log</span> <span class="doc-str">"${_esc(node.message?.data || node.message || '')}"</span>;`, pad, { id, type: t });

      } else if (t === 'exit') {
        ln(`<span class="kw">exit</span>${node.value !== undefined ? ' ' + _val(node.value) : ''};`, pad, { id, type: t });

      } else if (t === 'break') {
        ln(`<span class="kw">break</span>;`, pad, { id, type: t });

      } else if (t === 'call_piston') {
        ln(`<span class="kw">execute piston</span> ${_esc(node.target_piston_name || node.target_piston_id || '')};`, pad, { id, type: t });

      } else {
        // Unknown type — render a visible error placeholder, never silently skip
        ln(`<span class="doc-err">⚠ Unknown statement type: ${_esc(t || '?')} — ${_esc(id)}</span>`, pad, { id, type: t || 'unknown' });
      }
    });
  }

  // ── Inline helpers ───────────────────────────────────────
  function _condLine(c) {
    if (!c) return '<span class="doc-ph">[condition]</span>';
    const deviceCount = Array.isArray(c.devices) ? c.devices.length : (c.subject ? 1 : 0);
    const agg = c.aggregation && c.aggregation !== 'null' && deviceCount > 1
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
    if (typeof v === 'object' && v.type === 'variable')        return _dv('$', v.name || '');
    if (typeof v === 'object' && v.type === 'global_variable') return _dv('@', v.name || '');
    if (typeof v === 'object' && v.type === 'literal')         return _esc(String(v.data ?? ''));
    if (typeof v === 'object' && v.type === 'system_variable') return _dv('$', v.name || '');
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
    document.getElementById('toggle-simple')?.addEventListener('click', () => {
      App.state.simpleMode = true;
      localStorage.setItem('pc_simpleMode','true');
      render();
    });
    document.getElementById('toggle-adv')?.addEventListener('click', () => {
      App.state.simpleMode = false;
      localStorage.setItem('pc_simpleMode','false');
      render();
    });

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
    if (stmt) {
      _selectStmt(stmt.dataset.id);
      const node = _findAnyNode(stmt.dataset.id);
      if (node) _openWizardForEdit(node);
    }
  }

  function _openWizardForEdit(node) {
    const t = node.type;
    if (t === 'trigger' || t === 'condition' || t === 'restriction') {
      Wizard.open('edit_condition', node, {});
    } else if (t === 'variable') {
      Wizard.open('variable', node, {});
    } else if (t === 'set_variable' || t === 'wait' || t === 'log_message' || t === 'action' || t === 'call_piston') {
      Wizard.open('task', node, {});
    } else if (t === 'if') {
      Wizard.open('if_condition', node.conditions?.[0] || null, { 'block-id': node.id });
    } else {
      Wizard.open(t, node, {});
    }
  }

  // Search triggers, conditions, variables, and the flat statements array.
  // Use this anywhere you need to find a node by ID regardless of which section it lives in.
  function _findAnyNode(id) {
    if (!id) return null;
    const inArr = arr => (arr || []).find(n => n.id === id) || null;
    return inArr(_piston.triggers) ||
           inArr(_piston.conditions) ||
           inArr(_piston.variables) ||
           _findNode(_buildStmtMap(), id);
  }

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
    const node = _findAnyNode(_selectedId);
    if (node) _openWizardForEdit(node);
  }

  function _copySelected() {
    if (!_selectedId) return;
    const node = _findAnyNode(_selectedId);
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
    if (_selectedId) _insertAfter(_selectedId, clone);
    else (_piston.statements = _piston.statements || []).push(clone);
    _cutId = null;
    _markUnsaved(true);
    render();
  }

  function _deleteSelected() {
    if (!_selectedId) return;
    // Also handle triggers/conditions/variables (not in flat statements)
    const tryRemoveFromArr = (arr, id) => {
      if (!arr) return false;
      const i = arr.findIndex(n => n.id === id);
      if (i !== -1) { arr.splice(i, 1); return true; }
      return false;
    };
    if (!tryRemoveFromArr(_piston.triggers, _selectedId) &&
        !tryRemoveFromArr(_piston.conditions, _selectedId) &&
        !tryRemoveFromArr(_piston.variables, _selectedId)) {
      _removeNode(_selectedId);
    }
    _selectedId = null;
    _markUnsaved(true);
    render();
  }

  function _handleCancel() {
    if (_isNew) {
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
    const nameInput = document.getElementById('editor-piston-name');
    if (nameInput) _piston.name = nameInput.value.trim();

    if (!_piston.name) {
      if (nameInput) { nameInput.focus(); nameInput.style.borderColor = 'var(--red)'; }
      _showNotice('Piston name is required.', 'error');
      return false;
    }

    const btn = document.getElementById('btn-save');
    if (btn) { btn.textContent = '💾 Saving...'; btn.disabled = true; }

    // Generate piston_text from render functions — only if render succeeds.
    // If any statement fails to render, preserve the previous value unchanged.
    try {
      _piston.piston_text = _renderDocument(_piston, false);
    } catch(e) {
      // Render threw — preserve existing piston_text, do not overwrite
      console.warn('piston_text generation failed, preserving previous value:', e);
    }

    try {
      const result = await API.savePiston(_piston.id, _piston);
      _piston = result.piston || _piston;
      _isNew = false;
      _markUnsaved(false);

      const warnings = result.compile_check?.warnings || [];
      const errors   = result.compile_check?.errors   || [];

      const needsPy = (result.piston?.compile_target || '').toLowerCase().includes('pyscript');
      const warn = document.getElementById('pyscript-warning');
      if (warn) warn.style.display = needsPy ? '' : 'none';

      if (errors.length || warnings.length) {
        _showNotice([...errors.map(e=>`⚠ ${e}`),...warnings.map(w=>`⚠ ${w}`)].join(' | '), 'warn');
        return true;
      }

      App.navigate('status', { pistonId: _piston.id });
      return true;

    } catch(e) {
      _showNotice(`Save failed — your work is preserved. ${e.message}`, 'error');
      return false;
    } finally {
      if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
    }
  }

  // ── insertStatement — called by wizard ───────────────────
  // Update-vs-insert rule: if statementData.id already exists in the flat
  // statements array, replace in-place. Never append a duplicate.
  function insertStatement(context, statementData) {
    // Bug A fix: if_condition context — route condition to parent if block
    // Wizard sets _blockId on the condition node when adding conditions to an
    // existing if block (e.g. from _commitConditionAndMore).
    if (context === 'if_condition') {
      const blockId = statementData._blockId || null;
      if (blockId) {
        const stmtMap = _buildStmtMap();
        const block = _findNode(stmtMap, blockId);
        if (block) {
          block.conditions = block.conditions || [];
          const ci = block.conditions.findIndex(c => c.id === statementData.id);
          if (ci >= 0) block.conditions[ci] = statementData;
          else block.conditions.push(statementData);
          _markUnsaved(true);
          render();
          return;
        }
      }
      // No blockId or block not found — fall through to statement insert
    }

    if (context === 'trigger' || statementData.type === 'trigger' || statementData.is_trigger) {
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
      _piston.statements = _piston.statements || [];
      // Update-vs-insert: replace in-place if ID already exists
      const existing = _piston.statements.findIndex(s => s.id === statementData.id);
      if (existing >= 0) {
        _piston.statements[existing] = statementData;
      } else if (_selectedId) {
        _insertAfter(_selectedId, statementData);
      } else {
        _piston.statements.push(statementData);
      }
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

  // Flat lookup — stmtMap is built from _piston.statements.
  // For triggers/conditions/variables (not in stmtMap), callers search their
  // own arrays directly before calling this.
  function _findNode(stmtMap, id) {
    if (!stmtMap || !id) return null;
    return stmtMap[id] || null;
  }

  function _buildStmtMap() {
    return Object.fromEntries((_piston.statements || []).map(s => [s.id, s]));
  }

  // Flat removal — removes from statements array and cleans all parent child-ID lists
  function _removeNode(id) {
    const stmts = _piston.statements || [];
    const idx = stmts.findIndex(s => s.id === id);
    if (idx !== -1) stmts.splice(idx, 1);
    const childKeys = ['then', 'else', 'statements', 'tasks'];
    stmts.forEach(s => {
      childKeys.forEach(k => {
        if (Array.isArray(s[k])) s[k] = s[k].filter(cid => cid !== id);
      });
      (s.else_ifs || []).forEach(eib => {
        if (Array.isArray(eib.statements)) eib.statements = eib.statements.filter(cid => cid !== id);
      });
      (s.cases || []).forEach(c => {
        if (Array.isArray(c.statements)) c.statements = c.statements.filter(cid => cid !== id);
      });
      if (Array.isArray(s.default_statements)) s.default_statements = s.default_statements.filter(cid => cid !== id);
    });
  }

  // Flat insertAfter — adds node to statements array after target, and injects
  // new ID into whatever parent child-ID list contains the target ID.
  function _insertAfter(targetId, newNode) {
    const stmts = _piston.statements || [];
    // Push to flat array
    const tIdx = stmts.findIndex(s => s.id === targetId);
    if (tIdx !== -1) stmts.splice(tIdx + 1, 0, newNode);
    else stmts.push(newNode);
    // Inject ID into parent child list after targetId
    const childKeys = ['then', 'else', 'statements', 'tasks'];
    for (const s of stmts) {
      for (const k of childKeys) {
        if (Array.isArray(s[k])) {
          const ci = s[k].indexOf(targetId);
          if (ci !== -1) { s[k].splice(ci + 1, 0, newNode.id); return; }
        }
      }
      for (const eib of (s.else_ifs || [])) {
        if (Array.isArray(eib.statements)) {
          const ci = eib.statements.indexOf(targetId);
          if (ci !== -1) { eib.statements.splice(ci + 1, 0, newNode.id); return; }
        }
      }
      for (const c of (s.cases || [])) {
        if (Array.isArray(c.statements)) {
          const ci = c.statements.indexOf(targetId);
          if (ci !== -1) { c.statements.splice(ci + 1, 0, newNode.id); return; }
        }
      }
      if (Array.isArray(s.default_statements)) {
        const ci = s.default_statements.indexOf(targetId);
        if (ci !== -1) { s.default_statements.splice(ci + 1, 0, newNode.id); return; }
      }
    }
  }

  function _highestStmtId(piston) {
    // Not used for ID generation anymore — kept only to initialize _stmtCounter
    // so paste/duplicate IDs don't accidentally collide with loaded nodes.
    // We just need any non-zero seed; actual IDs are now random hex via _nextStmtId.
    return 0;
  }

  function _nextStmtId() {
    // Spec: stmt_ + 8 char lowercase hex (matches wizard _newId() format)
    return 'stmt_' + Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  }

  return {
    load,
    save,
    insertStatement,
    deleteStatement: _deleteSelected,
    getPistonVariables: () => (_piston?.variables || []),
  };

})();
