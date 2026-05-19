// pistoncore/frontend/js/editor.js
//
// Page 3 — Piston Editor
// Continuous document renderer — WebCoRE style.
// No boxes or section headers. Line numbers, teal keywords,
// ghost text insertion points, right-click context menu.
// Save → navigates to status page.
//
// Session 36 — Nested Tree Migration (S-NESTED Session B)
// All statement tree operations now work directly on the nested object tree.
// No flat statements array. No stmtMap. No ID references between statements.
// Children live inside their parent nodes in then/else/statements/cases/default arrays.
// _findNode, _removeNode, _replaceNode, _insertAfter all recurse the tree directly.
//
// Session 43 (W-S5) — Editor rendering fixes
// _condLine: flat-field normalization (imported pistons use role/attribute directly,
//   not inside subject object). Group condition guard added.
// _subj: null-safe fallback to placeholder.
// if renderer: reverted when true/when false → then/else (matches WebCoRE + spec).
//
// Session 45 (W-S6) — Rendering audit fixes
// _friendlyCmd(): new helper — converts snake_case command names to Title Case
//   so task lines render "Turn on" not "turn_on", matching WebCoRE and STATEMENT_TYPES.md.
// log_message: "log" → "do Log message" per STATEMENT_TYPES.md Section 16.
// wait (duration): "wait N unit" → "do Wait N unit" per Section 14.
// wait (until): "wait until" → "do Wait until" per Section 15.
// call_piston: "execute piston" → "do Execute piston" per Section 17.
// cancel_pending_tasks: "cancel all pending tasks" → "do Cancel all pending tasks" per Section 18.
//
// Session 47 (W-S7) — Vertical structure lines
// bOpen/bClose helpers push a wrapper div around each block's child content.
// border-left on .doc-block-body produces a continuous solid vertical line matching
// WebCoRE's sidebar connector lines. Indent offset ensures the line sits in the gutter
// left of the text, not inside it. Applied to all block types: if/then/else,
// while, repeat, for, for each, every, do, switch cases/default, on_event, action/with.

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
      _normalizePiston(_piston);
      _stmtCounter = 0; // _highestStmtId no longer needed; IDs are random hex
      App.state.unsavedChanges = false;
      _selectedId = null;
      _cutId = null;
      render();
    } catch (e) {
      container.innerHTML = `<div class="banner banner-error">Could not load piston: ${_esc(e.message)}</div>`;
    }
  }

  // ── Normalize / integrity check on load ──────────────────
  // Checks logic_version and ui_version against known supported values.
  // Removes any statement node missing id or type — these cannot render safely.
  // Recurses the full nested tree. Warns to console for every removal.
  // Per PISTON_FORMAT.md: if version is from the future, warn and refuse to load.
  function _normalizePiston(p) {
    if (!p) return;

    const SUPPORTED_LOGIC_VERSION = 1;
    const SUPPORTED_UI_VERSION    = 1;

    if (p.logic_version !== undefined && p.logic_version > SUPPORTED_LOGIC_VERSION) {
      throw new Error(
        `Piston uses logic_version ${p.logic_version} but this PistonCore only supports up to ${SUPPORTED_LOGIC_VERSION}. ` +
        `Please upgrade PistonCore before opening this piston.`
      );
    }
    if (p.ui_version !== undefined && p.ui_version > SUPPORTED_UI_VERSION) {
      throw new Error(
        `Piston uses ui_version ${p.ui_version} but this PistonCore only supports up to ${SUPPORTED_UI_VERSION}. ` +
        `Please upgrade PistonCore before opening this piston.`
      );
    }

    if (!Array.isArray(p.statements)) { p.statements = []; return; }

    function checkNodes(nodes) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (!n || typeof n !== 'object' || !n.id || !n.type) {
          console.warn('PistonCore: removing malformed statement node at index', i, n);
          nodes.splice(i, 1);
          continue;
        }
        checkNodes(n.then        || []);
        checkNodes(n.else        || []);
        checkNodes(n.statements  || []);
        (n.else_ifs || []).forEach(eib => checkNodes(eib.statements || []));
        (n.cases    || []).forEach(c   => checkNodes(c.statements   || []));
        checkNodes(n.default || []);
      }
    }
    checkNodes(p.statements);
  }

  // ── Render ───────────────────────────────────────────────
  function render() {
    if (!container || !_piston) return;
    const p = _piston;
    const isSimple = App.state.simpleMode;
    const isPy = (p.compile_target || '').toLowerCase().includes('pyscript');

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0">
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

      <div class="editor-doc" id="editor-doc" style="flex:1;overflow-y:auto;min-height:0">
        ${_renderDocument(p, isSimple)}
      </div>
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
      lines.push(`<div class="${cls}" ${attrs}><span class="doc-ln">${num.n++}</span><span class="doc-lc" ${ind}>${html}</span></div>`);
    };

    const gh = (text, ctx, indent, extra = {}) => {
      const attrs = Object.entries(extra).map(([k,v]) => `data-${k}="${_esc(String(v))}"`).join(' ');
      const ind = indent > 0 ? `style="padding-left:calc(var(--doc-indent)*${indent})"` : '';
      lines.push(`<div class="doc-line doc-ghost"><span class="doc-ln">${num.n++}</span><span class="doc-lc" ${ind}><span class="ghost" data-insert="${_esc(ctx)}" ${attrs}>· ${_esc(text)}</span></span></div>`);
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
      if (v.var_type !== 'device' && v.initial_value !== undefined && v.initial_value !== '') {
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

    // Nested tree — pass statement objects directly, no stmtMap
    _actionLines(p.statements || [], 1, lines, num, gh);

    gh('· add a new statement', 'action', 1);
    ln(`<span class="kw">end execute;</span>`, 0);

    return lines.join('\n');
  }


  // ── Nested tree renderer ─────────────────────────────────
  // childNodes: array of statement objects at this level (NOT IDs)
  // depth:      nesting depth for indentation
  // All recursive calls pass child object arrays directly from the node.
  function _actionLines(childNodes, depth, lines, num, gh) {
    const pad = Math.min(depth, 7);

    const ln = (html, indent, opts = {}) => {
      const { id, type } = opts;
      const sel = id && id === _selectedId;
      const cut = id && id === _cutId;
      const cls = ['doc-line', id ? 'doc-stmt' : '', sel ? 'doc-selected' : '', cut ? 'doc-cut' : ''].filter(Boolean).join(' ');
      const attrs = id ? `data-id="${_esc(id)}" data-type="${_esc(type||'')}"` : '';
      const ind = indent > 0 ? `style="padding-left:calc(var(--doc-indent)*${indent})"` : '';
      lines.push(`<div class="${cls}" ${attrs}><span class="doc-ln">${num.n++}</span><span class="doc-lc" ${ind}>${html}</span></div>`);
    };

    // Block body wrappers — produce a solid continuous border-left connector line
    // matching WebCoRE's vertical sidebar lines.
    // Position: 44px (doc-ln gutter) + N * 2rem (doc-indent per level).
    // This lands the line exactly at the left edge of the indented child text.
    // border-left is applied via .doc-block-body in style.css; only margin-left varies.
    const bOpen = (indentLevel) => {
      const offset = `calc(44px + var(--doc-indent) * ${indentLevel})`;
      lines.push(`<div class="doc-block-body" style="margin-left:${offset}">`);
    };
    const bClose = () => { lines.push(`</div>`); };

    (childNodes || []).forEach(node => {
      if (!node || !node.id) return; // guard against malformed nodes
      const id = node.id;
      const t = node.type;

      if (t === 'if') {
        ln(`<span class="kw">if</span>`, pad, { id, type: t });
        bOpen(pad);
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '· add a new condition');
          ln(`<span class="kw">then</span>`, pad);
          _actionLines(node.then || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { branch: 'then', 'block-id': id });
          (node.else_ifs || []).forEach(eib => {
            ln(`<span class="kw">else if</span>`, pad);
            _renderConditionBlock(eib.conditions, eib.condition_operator, eib.id, pad, ln, gh, '· add a new condition');
            ln(`<span class="kw">then</span>`, pad);
            _actionLines(eib.statements || [], depth + 2, lines, num, gh);
            gh('· add a new statement', 'action', pad + 2, { branch: 'else_if_statements', 'block-id': eib.id });
          });
          // Always render else so users can add statements to the else branch.
          ln(`<span class="kw">else</span>`, pad);
          _actionLines(node.else || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { branch: 'else', 'block-id': id });
        bClose();
        ln(`<span class="kw">end if;</span>`, pad);

      } else if (t === 'action') {
        ln(`<span class="kw">with</span>`, pad, { id, type: t });
        bOpen(pad);
          (node.devices || []).forEach(d => ln(`    ${_dr(d)}`, pad + 1));
          ln(`<span class="kw">do</span>`, pad);
          // tasks are embedded objects inside the action node — not child statements
          (node.tasks || []).forEach(task => {
            const cmdLabel = _friendlyCmd(task.service || task.command || 'call service');
            const params = task.parameters
              ? Object.entries(task.parameters).map(([k,v]) => `<span class="doc-param-k">${_esc(k)}</span>: ${_val(v)}`).join(', ')
              : '';
            ln(`${_esc(cmdLabel)}${params ? ` <span class="doc-params">${params}</span>` : ''};`, pad + 2, { id: task.id, type: 'task' });
          });
          gh('· add a new task', 'task', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end with;</span>`, pad);

      } else if (t === 'for_each') {
        const lv = _dr(node.list_role || '');
        // node.variable already contains $ prefix (e.g. "$device") per STATEMENT_TYPES.md
        const dvSpan = node.variable
          ? `<span class="doc-var">${_esc(node.variable)}</span>`
          : _dr(node.list_role || '');
        ln(`<span class="kw">for each</span> (${dvSpan} <span class="kw">in</span> ${lv})`, pad, { id, type: t });
        bOpen(pad);
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end for each;</span>`, pad);

      } else if (t === 'while') {
        ln(`<span class="kw">while</span>`, pad, { id, type: t });
        bOpen(pad);
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '· add a new condition');
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end while;</span>`, pad);

      } else if (t === 'repeat') {
        ln(`<span class="kw">repeat</span>`, pad, { id, type: t });
        bOpen(pad);
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
          ln(`<span class="kw">until</span>`, pad);
          _renderConditionBlock(node.until_conditions, node.condition_operator, id, pad, ln, gh, '· add a new condition');
        bClose();
        ln(`<span class="kw">end repeat;</span>`, pad);

      } else if (t === 'for') {
        // GAP-S27-4 fix: field names from STATEMENT_TYPES.md are start/end/step/counter_variable.
        // counter_variable is stored with $ prefix already (e.g. "$count") or null.
        const varPart = node.counter_variable
          ? `<span class="doc-var">${_esc(node.counter_variable)}</span>`
          : '<span class="doc-ph">$i</span>';
        const fromPart = node.start !== undefined ? _esc(String(node.start)) : '<span class="doc-ph">from</span>';
        const toPart   = node.end   !== undefined ? _esc(String(node.end))   : '<span class="doc-ph">to</span>';
        const stepPart = node.step !== undefined && node.step !== 1 ? ` step ${_esc(String(node.step))}` : '';
        ln(`<span class="kw">for</span> (${varPart} = ${fromPart} <span class="kw">to</span> ${toPart}${stepPart})`, pad, { id, type: t });
        bOpen(pad);
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end for;</span>`, pad);

      } else if (t === 'do') {
        ln(`<span class="kw">do</span>`, pad, { id, type: t });
        bOpen(pad);
        _actionLines(node.statements || [], depth + 2, lines, num, gh);
        gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end do;</span>`, pad);

      } else if (t === 'switch') {
        // node.expression is an operand object per STATEMENT_TYPES.md (type/name/data).
        // node.default is the default branch array (not node.default_statements).
        const subjPart = node.expression ? _val(node.expression) : '<span class="doc-ph">[subject]</span>';
        ln(`<span class="kw">switch</span> (${subjPart})`, pad, { id, type: t });
        bOpen(pad);
        (node.cases || []).forEach(c => {
          ln(`<span class="kw">case</span> ${_esc(String(c.value ?? ''))}<span class="kw">:</span>`, pad + 1);
          bOpen(pad + 1);
          _actionLines(c.statements || [], depth + 3, lines, num, gh);
          gh('· add a new statement', 'action', pad + 3, { 'block-id': c.id || id });
          bClose();
        });
        // node.default is [] when no default, undefined means not present at all
        if (node.default !== undefined) {
          ln(`<span class="kw">default:</span>`, pad + 1);
          bOpen(pad + 1);
          _actionLines(node.default || [], depth + 3, lines, num, gh);
          gh('· add a new statement', 'action', pad + 3, { branch: 'default', 'block-id': id });
          bClose();
        }
        bClose();
        ln(`<span class="kw">end switch;</span>`, pad);

      } else if (t === 'every') {
        const interval = node.interval !== undefined ? _esc(String(node.interval)) : '<span class="doc-ph">?</span>';
        const unit = _esc(node.interval_unit || '');
        ln(`<span class="kw">every</span> ${interval} ${unit}`, pad, { id, type: t });
        bOpen(pad);
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end every;</span>`, pad);

      } else if (t === 'on_event') {
        // on_event has conditions[] (triggers), not event_name — per STATEMENT_TYPES.md
        ln(`<span class="kw">on events</span>`, pad, { id, type: t });
        bOpen(pad);
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '· add a new event condition');
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('· add a new statement', 'action', pad + 2, { 'block-id': id });
        bClose();
        ln(`<span class="kw">end on;</span>`, pad);

      } else if (t === 'wait') {
        // All wait variants prefix with "do" per STATEMENT_TYPES.md Sections 14 and 15.
        const w = node.wait_type === 'duration'
          ? `<span class="kw">do</span> <span class="kw">Wait</span> ${_esc(String(node.duration||''))} ${_esc(node.duration_unit||node.unit||'')};`
          : node.wait_type === 'until'
          ? `<span class="kw">do</span> <span class="kw">Wait until</span> ${_esc(node.until||'')};`
          : node.wait_type === 'state'
          ? `<span class="kw">do</span> <span class="kw">Wait for state</span> ${_condLine(node.condition || {})};`
          : `<span class="kw">do</span> <span class="kw">Wait</span>;`;
        ln(w, pad, { id, type: t });

      } else if (t === 'wait_for_state') {
        // wait_for_state has a conditions array + optional timeout, not a single condition object.
        // Renders as a multi-line block per STATEMENT_TYPES.md Section 15b.
        ln(`<span class="kw">do</span> <span class="kw">Wait for state</span>`, pad, { id, type: t });
        (node.conditions || []).forEach(c => ln(`    ${_condLine(c)}`, pad + 1));
        if (node.timeout_seconds !== undefined && node.timeout_seconds !== null) {
          const secs = node.timeout_seconds;
          const mins = Math.round(secs / 60);
          const timeoutStr = mins > 0 && secs % 60 === 0
            ? `${mins} minute${mins !== 1 ? 's' : ''}`
            : `${secs}s`;
          ln(`    <span class="kw">timeout:</span> ${_esc(timeoutStr)};`, pad + 1);
        }

      } else if (t === 'set_variable') {
        // node.variable stored as-is from wizard (user types name without $).
        // _dv prepends $ for display. If user already typed $, renders $$name — GAP-S45-1.
        ln(`<span class="kw">set variable</span> ${_dv('$', node.variable || '')} = ${_val(node.value)};`, pad, { id, type: t });

      } else if (t === 'log_message') {
        // "do Log message" per STATEMENT_TYPES.md Section 16.
        ln(`<span class="kw">do</span> <span class="kw">Log message</span> <span class="doc-str">{"${_esc(node.message?.data || node.message || '')}"}</span>;`, pad, { id, type: t });

      } else if (t === 'exit') {
        ln(`<span class="kw">exit</span>${node.value !== undefined ? ' ' + _val(node.value) : ''};`, pad, { id, type: t });

      } else if (t === 'break') {
        ln(`<span class="kw">break</span>;`, pad, { id, type: t });

      } else if (t === 'call_piston') {
        // "do Execute piston" per STATEMENT_TYPES.md Section 17.
        ln(`<span class="kw">do</span> <span class="kw">Execute piston</span> ${_esc(node.target_piston_name || node.target_piston_id || '')};`, pad, { id, type: t });

      } else if (t === 'cancel_pending_tasks') {
        // "do Cancel all pending tasks" per STATEMENT_TYPES.md Section 18.
        ln(`<span class="kw">do</span> <span class="kw">Cancel all pending tasks</span>;`, pad, { id, type: t });

      } else {
        // Unknown type — render a visible error placeholder, never silently skip
        ln(`<span class="doc-err">⚠ Unknown statement type: ${_esc(t || '?')} — ${_esc(id)}</span>`, pad, { id, type: t || 'unknown' });
      }
    });
  }

  // ── Inline helpers ───────────────────────────────────────

  // Converts a snake_case command name to Title Case for display.
  // "turn_on" → "Turn on", "set_volume_level" → "Set volume level"
  // "light.turn_on" → "Turn on" (strips domain prefix if present)
  // If the command is already human-readable (no underscores), returns as-is capitalized.
  function _friendlyCmd(cmd) {
    if (!cmd) return 'call service';
    // Strip domain prefix (e.g. "light.turn_on" → "turn_on")
    const bare = cmd.includes('.') ? cmd.split('.').slice(1).join('.') : cmd;
    // Replace underscores with spaces, capitalize first word only
    const spaced = bare.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function _condLine(c) {
    if (!c) return '<span class="doc-ph">[condition]</span>';

    // Group object — render as group summary, not a condition line
    if (c.type === 'group') {
      const op = c.operator || 'and';
      const neg = c.negated ? '<span class="kw">not</span> ' : '';
      const count = (c.conditions || []).length;
      const gop = c.group_operator ? ` <span class="kw doc-gop">${_esc(c.group_operator)}</span>` : '';
      return `${neg}<span class="kw">group</span> (${_esc(op)}, ${count} condition${count !== 1 ? 's' : ''})${gop}`;
    }

    // Flat-field normalization — imported pistons store role/attribute directly on the
    // condition object instead of inside a subject sub-object. Build a synthetic subject
    // so the rest of this function works identically for both formats.
    let subject = c.subject;
    if (!subject) {
      if (c.role === 'time' || c.subject_type === 'time') {
        subject = { type: 'time' };
      } else if (c.role === 'date' || c.subject_type === 'date') {
        subject = { type: 'date' };
      } else if (c.role === 'mode' || c.subject_type === 'mode') {
        subject = { type: 'mode' };
      } else if (c.role) {
        subject = {
          type: 'device',
          role: c.role,
          entity_id: c.entity_id || c.role,
          capability: c.attribute || c.capability || '',
          attribute_type: c.attribute_type || '',
          device_class: c.device_class || null,
        };
      } else {
        // No subject info at all — render placeholder
        subject = null;
      }
    }

    // aggregation is always shown for device conditions — device count is unknowable at render time
    const AGG_LABELS = { any: 'Any of', all: 'All of', none: 'None of' };
    const isDeviceSubj = subject?.type === 'device';
    const agg = c.aggregation && c.aggregation !== 'null' && (isDeviceSubj || c.aggregation !== 'any')
      ? `<span class="kw">${_esc(AGG_LABELS[c.aggregation] || c.aggregation)}</span> `
      : '';
    const subj = _subj(subject);
    const attr = subject?.capability ? ` <span class="doc-attr">${_esc(subject.capability)}</span>` : '';
    const op   = c.operator ? ` <span class="kw">${_esc(c.operator)}</span>` : '';
    // display_value is the wizard-written friendly value; fall back to value/value_from
    const rawVal = c.display_value !== undefined && c.display_value !== ''
      ? String(c.display_value)
      : (c.value !== undefined ? String(c.value) : (c.value_from !== undefined ? String(c.value_from) : ''));
    const val  = rawVal ? ` ${_esc(rawVal)}` : '';
    const val2 = c.value_to !== undefined && c.value_to !== '' ? ` <span class="kw">and</span> ${_esc(String(c.value_to))}` : '';
    const dur  = c.duration ? ` <span class="kw">for</span> ${_esc(String(c.duration))} ${_esc(c.duration_unit||'')}` : '';
    return `${agg}${subj}${attr}${op}${val}${val2}${dur}`;
  }

  function _subj(s) {
    if (!s) return '<span class="doc-ph">[device]</span>';
    if (s.type === 'device')   return _dr(s.role || s.entity_id || 'device');
    if (s.type === 'variable') return _dv('$', s.name || '');
    if (s.type === 'global')   return _dv('@', s.name || '');
    // time/date/mode/expression — show the type as a keyword; value comes from _condLine's val part
    return `<span class="kw">${_esc(s.type || '')}</span>`;
  }

  // Renders a conditions array with the block's condition_operator shown as a
  // separate clickable line between each condition. Used by if, while, repeat,
  // on_event, else_if blocks. blockId is the parent block's id.
  function _renderConditionBlock(conditions, conditionOperator, blockId, pad, ln, gh, addGhostText) {
    const op = conditionOperator || 'and';
    const ind = pad > 0 ? `style="padding-left:calc(var(--doc-indent)*${pad + 1})"` : '';
    (conditions || []).forEach((c, i) => {
      ln(`    ${_condLine(c)}`, pad + 1, { id: c.id, type: c.is_trigger ? 'trigger' : 'condition', 'parent-block': blockId });
      // Between conditions: render clickable and/or operator line (not a doc-stmt)
      if (i < conditions.length - 1) {
        ln(`<span class="doc-condop" data-condop-block="${_esc(blockId)}">${_esc(op)}</span>`, pad + 1, { id: `condop_${_esc(blockId)}_${i}`, type: 'condition_operator' });
      }
    });
    gh(addGhostText, 'if_condition', pad + 1, { 'block-id': blockId });
  }

  function _val(v) {
    if (v === null || v === undefined) return '<span class="doc-ph">?</span>';
    if (typeof v === 'object' && v.type === 'variable')        return _dv('$', v.name || '');
    if (typeof v === 'object' && v.type === 'global_variable') return _dv('@', v.name || '');
    if (typeof v === 'object' && v.type === 'literal')         return _esc(String(v.data ?? ''));
    if (typeof v === 'object' && v.type === 'system_variable') return _dv('$', v.name || '');
    if (typeof v === 'object' && v.type === 'expression')      return `<span class="doc-expr">${_esc(v.expression || '')}</span>`;
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
    // Condition operator (and/or) line click — open operator editor dialog
    const condop = e.target.closest('.doc-condop');
    if (condop) {
      const blockId = condop.dataset.condopBlock;
      if (blockId) {
        const block = _findNode(blockId) || _findElseIf(blockId);
        const currentOp = block?.condition_operator || 'and';
        Wizard.open('condition_operator', null, { 'block-id': blockId, 'condition-operator': currentOp });
      }
      return;
    }
    const stmt = e.target.closest('.doc-stmt');
    if (stmt) {
      // Skip condition_operator pseudo-statements — handled above
      if (stmt.dataset.type === 'condition_operator') return;
      _selectStmt(stmt.dataset.id);
      const node = _findAnyNode(stmt.dataset.id);
      const parentBlock = stmt.dataset['parentBlock'] || stmt.dataset['parent-block'] || null;
      const renderedType = stmt.dataset.type || null;
      if (node) _openWizardForEdit(node, parentBlock, renderedType);
    }
  }

  function _openWizardForEdit(node, parentBlockId, renderedType) {
    // Use node.type if present; fall back to the data-type the renderer stamped on the element.
    // Imported condition nodes have no type field — the renderer sets data-type="condition"/"trigger".
    const t = node.type || renderedType || '';
    if (t === 'trigger' || t === 'condition' || t === 'restriction') {
      // If condition lives inside a block, pass block-id so wizard saves back to it
      if (parentBlockId) {
        Wizard.open('if_condition', node, { 'block-id': parentBlockId });
      } else {
        Wizard.open('edit_condition', node, {});
      }
    } else if (t === 'variable') {
      Wizard.open('variable', node, {});
    } else if (t === 'set_variable' || t === 'wait' || t === 'log_message' || t === 'action' || t === 'call_piston') {
      Wizard.open('task', node, {});
    } else if (t === 'if') {
      // Clicking the 'if' keyword opens the condition/group picker to add a condition.
      Wizard.open('if_condition', null, { 'block-id': node.id });
    } else {
      Wizard.open(t, node, {});
    }
  }

  // ── Tree search helpers ──────────────────────────────────

  // Recursive tree walk — finds any statement node by ID anywhere in the nested tree.
  // Searches top-level statements and all child arrays recursively.
  // Does NOT search triggers/conditions/variables — callers search those arrays directly.
  // Called with no second argument to search from root: _findNode(id)
  function _findNode(id, nodes) {
    if (!id) return null;
    nodes = nodes !== undefined ? nodes : ((_piston && _piston.statements) || []);
    for (const node of nodes) {
      if (!node) continue;
      if (node.id === id) return node;
      let found =
        _findNode(id, node.then       || []) ||
        _findNode(id, node.else       || []) ||
        _findNode(id, node.statements || []);
      if (found) return found;
      for (const eib of (node.else_ifs || [])) {
        found = _findNode(id, eib.statements || []);
        if (found) return found;
      }
      for (const c of (node.cases || [])) {
        found = _findNode(id, c.statements || []);
        if (found) return found;
      }
      found = _findNode(id, node.default || []);
      if (found) return found;
    }
    return null;
  }

  // Finds a condition node by id anywhere in the nested statement tree.
  // Searches node.conditions[], node.until_conditions[], and all child arrays recursively.
  function _findCondition(id, nodes) {
    nodes = nodes !== undefined ? nodes : ((_piston && _piston.statements) || []);
    for (const node of nodes) {
      if (!node) continue;
      for (const arr of [node.conditions || [], node.until_conditions || []]) {
        const hit = arr.find(c => c && c.id === id);
        if (hit) return hit;
      }
      for (const eib of (node.else_ifs || [])) {
        const hit = (eib.conditions || []).find(c => c && c.id === id);
        if (hit) return hit;
        const deep = _findCondition(id, eib.statements || []);
        if (deep) return deep;
      }
      const found = _findCondition(id, node.then || []) ||
                    _findCondition(id, node.else || []) ||
                    _findCondition(id, node.statements || []) ||
                    _findCondition(id, node.default || []);
      if (found) return found;
    }
    return null;
  }

  // Finds an else_if block by its id, searching all if nodes in the tree.
  function _findElseIf(eibId, nodes) {
    nodes = nodes !== undefined ? nodes : ((_piston && _piston.statements) || []);
    for (const node of nodes) {
      if (!node) continue;
      for (const eib of (node.else_ifs || [])) {
        if (eib.id === eibId) return eib;
      }
      const found = _findElseIf(eibId, node.then || []) ||
                    _findElseIf(eibId, node.else || []) ||
                    _findElseIf(eibId, node.statements || []);
      if (found) return found;
    }
    return null;
  }

  // Search triggers, conditions, variables, then the nested statement tree.
  // Use this anywhere you need to find a node by ID regardless of which section it lives in.
  function _findAnyNode(id) {
    if (!id) return null;
    const inArr = arr => (arr || []).find(n => n.id === id) || null;
    return inArr(_piston.triggers) ||
           inArr(_piston.conditions) ||
           inArr(_piston.variables) ||
           _findNode(id) ||
           _findCondition(id);
  }

  // Recursive tree splice — removes the node with the given ID from wherever it
  // lives in the nested tree. Returns true if found and removed.
  // Called with no second argument to search from root: _removeNode(id)
  function _removeNode(id, nodes) {
    nodes = nodes !== undefined ? nodes : ((_piston && _piston.statements) || []);
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].id === id) { nodes.splice(i, 1); return true; }
      const node = nodes[i];
      if (!node) continue;
      if (_removeNode(id, node.then       || [])) return true;
      if (_removeNode(id, node.else       || [])) return true;
      if (_removeNode(id, node.statements || [])) return true;
      for (const eib of (node.else_ifs || [])) {
        if (_removeNode(id, eib.statements || [])) return true;
      }
      for (const c of (node.cases || [])) {
        if (_removeNode(id, c.statements || [])) return true;
      }
      if (_removeNode(id, node.default || [])) return true;
    }
    return false;
  }

  // Finds the array that owns targetId (anywhere in the nested tree) and splices
  // newNode in immediately after the target. Falls back to push at top level.
  function _insertAfter(targetId, newNode) {
    function spliceInto(nodes) {
      if (!nodes) return false;
      const i = nodes.findIndex(n => n && n.id === targetId);
      if (i !== -1) { nodes.splice(i + 1, 0, newNode); return true; }
      for (const node of nodes) {
        if (!node) continue;
        if (spliceInto(node.then))       return true;
        if (spliceInto(node.else))       return true;
        if (spliceInto(node.statements)) return true;
        for (const eib of (node.else_ifs || [])) {
          if (spliceInto(eib.statements)) return true;
        }
        for (const c of (node.cases || [])) {
          if (spliceInto(c.statements)) return true;
        }
        if (spliceInto(node.default)) return true;
      }
      return false;
    }
    if (!spliceInto(_piston.statements || [])) {
      console.warn('PistonCore: _insertAfter target not found, appending to top level', targetId);
      _showNotice('Statement inserted at top level — target position not found.', 'warn');
      (_piston.statements = _piston.statements || []).push(newNode);
    }
  }

  // Finds the node with statementData.id anywhere in the nested tree and replaces
  // it in-place in its owning array. Returns true if found and replaced.
  function _replaceNode(statementData, nodes) {
    nodes = nodes !== undefined ? nodes : ((_piston && _piston.statements) || []);
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].id === statementData.id) { nodes[i] = statementData; return true; }
      const node = nodes[i];
      if (!node) continue;
      if (_replaceNode(statementData, node.then       || [])) return true;
      if (_replaceNode(statementData, node.else       || [])) return true;
      if (_replaceNode(statementData, node.statements || [])) return true;
      for (const eib of (node.else_ifs || [])) {
        if (_replaceNode(statementData, eib.statements || [])) return true;
      }
      for (const c of (node.cases || [])) {
        if (_replaceNode(statementData, c.statements || [])) return true;
      }
      if (_replaceNode(statementData, node.default || [])) return true;
    }
    return false;
  }

  // ── Context menu ─────────────────────────────────────────
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
    _deepReId(clone);
    if (_selectedId) _insertAfter(_selectedId, clone);
    else (_piston.statements = _piston.statements || []).push(clone);
    _cutId = null;
    _markUnsaved(true);
    render();
  }

  // Assigns a fresh ID to every node in a cloned subtree recursively.
  // Covers statement nodes, else_if blocks, case blocks, condition nodes, and task nodes.
  // Called on paste/duplicate to prevent duplicate IDs in the tree.
  // GAP-S36-2 resolved: Session C.
  function _deepReId(node) {
    if (!node || typeof node !== 'object') return;
    if (node.id) node.id = _nextStmtId();
    (node.then        || []).forEach(n => _deepReId(n));
    (node.else        || []).forEach(n => _deepReId(n));
    (node.statements  || []).forEach(n => _deepReId(n));
    (node.default     || []).forEach(n => _deepReId(n));
    (node.else_ifs    || []).forEach(eib => {
      if (eib.id) eib.id = _nextStmtId();
      (eib.statements || []).forEach(n => _deepReId(n));
    });
    (node.cases || []).forEach(c => {
      if (c.id) c.id = _nextStmtId();
      (c.statements || []).forEach(n => _deepReId(n));
    });
    (node.conditions || []).forEach(c => { if (c.id) c.id = _nextStmtId(); });
    (node.tasks      || []).forEach(t => { if (t.id) t.id = _nextStmtId(); });
  }

  function _deleteSelected() {
    if (!_selectedId) return;
    // Check triggers/conditions/variables first — they are not in the statement tree
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

  // ── insertStatement — called by wizard ───────────────────
  // Update-vs-insert rule:
  //   If statementData.id already exists anywhere in the nested tree → replace in-place.
  //   If not found → insert after _selectedId, or append to top level.
  //
  // if_condition context: wizard passes blockId in meta. Editor finds the if block
  // and upserts the condition into its conditions array.
  //
  // branch context: wizard passes blockId + branch in meta when inserting a statement
  // into a specific branch of a control flow node (then/else/statements).
  function insertStatement(context, statementData, meta) {
    if (context === 'if_condition') {
      const blockId = (meta && meta.blockId) || null;
      if (blockId) {
        const block = _findNode(blockId);
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

    // Branch insertion: meta.blockId + meta.branch — insert into a specific child array
    if (meta && meta.blockId && meta.branch) {
      if (!statementData.id) statementData.id = _nextStmtId();
      // Check replace first — if this is an edit, it's already in the tree
      const replaced = _replaceNode(statementData);
      if (replaced) { _markUnsaved(true); render(); return; }
      // else_if_statements: blockId is an else_if object id, not a statement id
      // We need to find the else_if inside any if node's else_ifs array
      if (meta.branch === 'else_if_statements') {
        const eib = _findElseIf(meta.blockId);
        if (eib) {
          eib.statements = eib.statements || [];
          eib.statements.push(statementData);
          _markUnsaved(true); render(); return;
        }
      }
      // Standard branch: then / else / statements / default
      const block = _findNode(meta.blockId);
      if (block) {
        const branch = meta.branch;
        block[branch] = block[branch] || [];
        block[branch].push(statementData);
        _markUnsaved(true);
        render();
        return;
      }
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
      // Update-vs-insert: try to replace in-place anywhere in the nested tree first
      const replaced = _replaceNode(statementData);
      if (!replaced) {
        // New node — insert after selection, or append to top level
        if (_selectedId) {
          _insertAfter(_selectedId, statementData);
        } else {
          (_piston.statements = _piston.statements || []).push(statementData);
        }
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

  function _nextStmtId() {
    // Spec: stmt_ + 8 char lowercase hex. Uses crypto to match wizard _newId().
    return 'stmt_' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
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

    // piston_text field removed in Session 35 (PISTON_FORMAT.md v2.0).
    // Snapshot JSON is generated on export, not on save. Do not generate it here.

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

  function deleteStatement(id) {
    // Called by wizard with the specific node id — does not require _selectedId
    if (!id) return;
    const tryRemoveFromArr = (arr, id) => {
      if (!arr) return false;
      const i = arr.findIndex(n => n.id === id);
      if (i !== -1) { arr.splice(i, 1); return true; }
      return false;
    };
    if (!tryRemoveFromArr(_piston.triggers, id) &&
        !tryRemoveFromArr(_piston.conditions, id) &&
        !tryRemoveFromArr(_piston.variables, id)) {
      _removeNode(id);
    }
    if (_selectedId === id) _selectedId = null;
    _markUnsaved(true);
    render();
  }


  return {
    load,
    save,
    insertStatement,
    deleteStatement,
    getPistonVariables: () => (_piston?.variables || []),
    getDeviceMap: () => (_piston?.device_map || {}),
    updateConditionOperator(blockId, operator) {
      // Find the block (if, while, repeat, on_event, else_if) and update its condition_operator
      const block = _findNode(blockId) || _findElseIf(blockId);
      if (block) {
        block.condition_operator = operator;
        _markUnsaved(true);
        render();
      }
    },
  };

})();
