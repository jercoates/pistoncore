// pistoncore/frontend/js/editor.js
//
// Page 3 — Piston Editor
//
// Pure-projection renderer: JSON → display text, one direction only.
// Never reads or parses display text. Never stores display text.
// Every mutation goes through the JSON tree first; render() always follows.
//
// Section order (all always visible — no simple/advanced toggle):
//   Comment header → define (variables) → triggers → conditions →
//   only when (restrictions) → execute (statements) → end execute;
//
// Tree manipulation works directly on the nested object tree.
// Children live inside their parent: then[], else[], statements[], cases[], default[].
// No flat array. No stmtMap. No ID references between parent and child.

const Editor = (() => {

  // ── Module state ─────────────────────────────────────────────────────────
  const container = document.getElementById('page-editor');
  let _piston    = null;
  let _vocab     = null;   // webcore_vocab.json — loaded at editor open
  let _selectedId = null;
  let _cutId      = null;
  let _isNew      = false;

  // ── Load ─────────────────────────────────────────────────────────────────
  async function load(pistonId, opts = {}) {
    if (!container) return;
    _isNew = opts.isNew || false;
    container.innerHTML = `<div class="editor-loading"><div class="spinner"></div> Loading...</div>`;

    try {
      const [piston, vocab, globalsResult, devices] = await Promise.all([
        API.getPiston(pistonId),
        _loadVocab(),
        API.getGlobals().catch(() => ({})),
        API.getDevices().catch(() => []),
      ]);
      _vocab  = vocab;
      _piston = piston;
      _piston._globalsCache = Object.values(globalsResult || {});
      _normalizePiston(_piston);
      _seedWizardCore(devices || []);
      App.state.unsavedChanges = false;
      _selectedId = null;
      _cutId      = null;
      render();
    } catch (e) {
      _piston = {
        id: pistonId, name: 'Unknown',
        statements: [], variables: [], triggers: [], conditions: [], restrictions: [],
        logic_version: 2, ui_version: 1,
      };
      _normalizePiston(_piston);
      _seedWizardCore([]);
      App.state.unsavedChanges = false;
      _selectedId = null;
      _cutId      = null;
      render();
      _showNotice(`Could not load piston: ${e.message}`, 'error');
    }
  }

  async function _loadVocab() {
    if (_vocab) return _vocab;
    try {
      const r = await fetch(window.location.origin + '/frontend/webcore_vocab.json');
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  // ── Seed WizardCore ──────────────────────────────────────────────────────
  // Called after every piston load so all wizard dialogs share the same data.
  // _piston.variables is passed by reference — mutations in either place are shared.
  function _seedWizardCore(devices) {
    if (typeof WizardCore === 'undefined') return;
    WizardCore.setDeviceData(devices);
    WizardCore.setPistonVars(_piston.variables);
    WizardCore.setGlobalsData(_piston._globalsCache || []);
    WizardCore.registerAutoSave(() => _markUnsaved(true));
  }

  // ── Normalize ────────────────────────────────────────────────────────────
  // Per §1.8: never crash on bad input. Flag problems for banner rendering.
  // Corrupt nodes get _corrupt marker so the renderer shows the placeholder row.
  function _normalizePiston(p) {
    if (!p) return;
    const SUPPORTED_LOGIC = 2;
    const SUPPORTED_UI    = 1;

    if ((p.logic_version || 2) > SUPPORTED_LOGIC) p._futureVersion = true;
    if ((p.logic_version || 2) === 1)              p._legacyVersion = true;
    if ((p.ui_version    || 1) > SUPPORTED_UI)     p._futureVersion = true;

    if (!Array.isArray(p.statements))   p.statements   = [];
    if (!Array.isArray(p.triggers))     p.triggers     = [];
    if (!Array.isArray(p.conditions))   p.conditions   = [];
    if (!Array.isArray(p.restrictions)) p.restrictions = [];
    if (!Array.isArray(p.variables))    p.variables    = [];

    // Mark corrupt nodes (missing id or type) instead of removing them.
    // The renderer shows a placeholder row; siblings are unaffected.
    function markCorrupt(nodes) {
      (nodes || []).forEach(n => {
        if (!n || typeof n !== 'object' || !n.id || !n.type) {
          if (n) n._corrupt = true;
          return;
        }
        markCorrupt(n.then        || []);
        markCorrupt(n.else        || []);
        markCorrupt(n.statements  || []);
        markCorrupt(n.default     || []);
        (n.else_ifs || []).forEach(eib => markCorrupt(eib.statements || []));
        (n.cases    || []).forEach(c   => markCorrupt(c.statements   || []));
      });
    }
    markCorrupt(p.statements);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    if (!container || !_piston) return;
    const p   = _piston;
    const isPy = (p.compile_target || '').toLowerCase().includes('pyscript');

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0">

        <div class="editor-toolbar">
          <div class="editor-tb-left">
            <button class="etb-icon" id="btn-editor-cancel" title="Return to status page">✕</button>
          </div>
          <div class="editor-tb-center">
            <input type="text" id="editor-piston-name" class="editor-name-input"
              value="${_esc(p.name || '')}" placeholder="Piston name..." />
            <span class="unsaved-dot" id="unsaved-dot" style="display:none" title="Unsaved changes">●</span>
          </div>
          <div class="editor-tb-right">
            <button class="btn btn-ghost btn-sm" id="btn-snapshot" title="Share-safe export">📷 Snapshot</button>
            <button class="btn btn-ghost btn-sm" id="btn-backup"   title="Full export including device IDs">📷 Backup</button>
            <button class="btn btn-danger btn-sm" id="btn-editor-delete">🗑 Delete</button>
            <button class="btn btn-primary btn-sm" id="btn-save">💾 Save</button>
          </div>
        </div>

        ${isPy ? `
        <div class="pyscript-warning" id="pyscript-warning">
          ⚠ PyScript required — install via HACS before deploying.
          <a href="#" id="pyscript-help-link" class="pyscript-help-link">Learn more →</a>
        </div>` : ''}

        ${p._futureVersion ? `
        <div class="banner banner-error">
          This piston was created with a newer version of PistonCore. Update PistonCore to edit it.
        </div>` : ''}

        ${p._legacyVersion ? `
        <div class="banner banner-warn" id="legacy-banner">
          This piston uses the legacy v1 format.
          <button class="btn btn-sm btn-ghost" id="btn-migrate">Migrate</button>
          <button class="btn btn-sm btn-ghost" id="btn-leave-legacy">Leave as-is</button>
        </div>` : ''}

        <div id="editor-notice"></div>

        <div class="editor-doc" id="editor-doc" style="flex:1;overflow-y:auto;min-height:0">
          ${_renderDocument(p)}
        </div>

      </div>
    `;

    _wireEvents();
    _markUnsaved(false);
    _positionStructureLines();
  }

  // ── Document renderer ─────────────────────────────────────────────────────
  // Builds the full piston document as HTML lines.
  // ln()  — numbered code line (selectable when given an id)
  // gh()  — ghost insertion point (· add a new …)
  // hdr() — section header (▼ SECTION NAME, not numbered)
  // blk() — blank numbered line
  function _renderDocument(p) {
    const lines = [];
    const num   = { n: 1 };

    const ln = (html, indent, opts = {}) => {
      const { id, type } = opts;
      const sel = id && id === _selectedId;
      const cut = id && id === _cutId;
      const cls = ['doc-line',
        id   ? 'doc-stmt'     : '',
        sel  ? 'doc-selected' : '',
        cut  ? 'doc-cut'      : '',
      ].filter(Boolean).join(' ');
      const extraAttrs = Object.entries(opts)
        .filter(([k]) => k !== 'id' && k !== 'type')
        .map(([k, v]) => `data-${k}="${_esc(String(v))}"`)
        .join(' ');
      const attrs = id
        ? `data-id="${_esc(id)}" data-type="${_esc(type || '')}" ${extraAttrs}`
        : '';
      const ind = indent > 0
        ? `style="padding-left:calc(var(--doc-indent)*${indent})"`
        : '';
      lines.push(
        `<div class="${cls}" ${attrs}>`+
        `<span class="doc-ln">${num.n++}</span>`+
        `<span class="doc-lc" ${ind}>${html}</span>`+
        `</div>`
      );
    };

    const gh = (text, ctx, indent, extra = {}) => {
      const attrs = Object.entries(extra)
        .map(([k, v]) => `data-${k}="${_esc(String(v))}"`)
        .join(' ');
      const ind = indent > 0
        ? `style="padding-left:calc(var(--doc-indent)*${indent})"`
        : '';
      lines.push(
        `<div class="doc-line doc-ghost">`+
        `<span class="doc-ln">${num.n++}</span>`+
        `<span class="doc-lc" ${ind}>`+
        `<span class="ghost" data-insert="${_esc(ctx)}" ${attrs}>· ${_esc(text)}</span>`+
        `</span></div>`
      );
    };

    const hdr = (text) => {
      lines.push(
        `<div class="doc-section-hdr"><span class="doc-section-arrow">▼</span> ${_esc(text)}</div>`
      );
    };

    const blk = () => {
      lines.push(
        `<div class="doc-line doc-blank">`+
        `<span class="doc-ln">${num.n++}</span>`+
        `<span class="doc-lc"></span></div>`
      );
    };

    // ── Comment header ──────────────────────────────────────────────────────
    ln(_cm(`************************************************************`), 0);
    ln(_cm(`* ${p.name || 'Untitled'}`), 0);
    ln(_cm(`************************************************************`), 0);
    if (p.author) ln(_cm(`* Author   : ${p.author}`), 0);
    ln(_cm(`* Created  : ${_fmtDate(p.created_at)}`), 0);
    ln(_cm(`* Modified : ${_fmtDate(p.updated_at || p.modified_at)}`), 0);
    ln(_cm(`************************************************************`), 0);
    blk();

    // ── PISTON VARIABLES ────────────────────────────────────────────────────
    ln(`<span class="kw">define</span>`, 0);
    (p.variables || []).forEach(v => {
      if (v._corrupt) {
        ln(`<span class="doc-err">⚠ Unknown variable [${_esc(v.id || '?')}] — edit to repair</span>`,
          1, { id: v.id, type: 'variable' });
        return;
      }
      const typeKw   = _kw(_typeLabel(v.var_type));
      const varName  = `<span class="doc-var">$${_esc(v.name || '')}</span>`;
      let valueStr = '';
      if (v.var_type === 'device' || v.var_type === 'devices') {
        const names = Array.isArray(v.initial_device_names) && v.initial_device_names.length
          ? v.initial_device_names
          : (Array.isArray(v.initial_value) ? v.initial_value : []);
        if (names.length) valueStr = ` = ${_dr(names.join(', '))}`;
      } else if (v.initial_value !== undefined && v.initial_value !== '') {
        valueStr = ` = ${_esc(String(v.initial_value))}`;
      }
      const constKw = v.assignment === 's' ? `${_kw('const')} ` : '';
      ln(`${constKw}${typeKw} ${varName}${valueStr};`, 1, { id: v.id, type: 'variable' });
    });
    gh('+ add a new variable', 'variable', 1);
    ln(`<span class="kw">end define;</span>`, 0);
    blk();

    // ── RESTRICTIONS ────────────────────────────────────────────────────────
    ln(`<span class="kw">only when</span>`, 0);
    (p.restrictions || []).forEach((r, i) => {
      if (i > 0) {
        const op = r.group_operator || 'and';
        ln(`<span class="doc-condop kw">${_esc(op)}</span>`, 1);
      }
      ln(_condLine(r), 1, { id: r.id, type: 'restriction' });
    });
    gh('+ add a new restriction', 'restriction', 1);
    blk();

    // ── EXECUTE ─────────────────────────────────────────────────────────────
    ln(`<span class="kw">execute</span>`, 0);
    _actionLines(p.statements || [], 1, lines, num, gh);
    gh('+ add a new statement', 'action', 1);
    ln(`<span class="kw">end execute;</span>`, 0);

    return lines.join('\n');
  }

  // ── Statement tree renderer ───────────────────────────────────────────────
  // Recurses the nested statement tree. Each node renders its keyword frame and
  // delegates child arrays back to _actionLines.
  // bOpen/bClose wrap block bodies so CSS ::before can draw structure lines.
  function _actionLines(nodes, depth, lines, num, gh) {
    const pad = Math.min(depth, 7);

    const ln = (html, indent, opts = {}) => {
      const { id, type } = opts;
      const sel = id && id === _selectedId;
      const cut = id && id === _cutId;
      const cls = ['doc-line',
        id  ? 'doc-stmt'     : '',
        sel ? 'doc-selected' : '',
        cut ? 'doc-cut'      : '',
      ].filter(Boolean).join(' ');
      const extraAttrs = Object.entries(opts)
        .filter(([k]) => k !== 'id' && k !== 'type')
        .map(([k, v]) => `data-${k}="${_esc(String(v))}"`)
        .join(' ');
      const attrs = id
        ? `data-id="${_esc(id)}" data-type="${_esc(type || '')}" ${extraAttrs}`
        : '';
      const ind = indent > 0
        ? `style="padding-left:calc(var(--doc-indent)*${indent})"`
        : '';
      lines.push(
        `<div class="${cls}" ${attrs}>`+
        `<span class="doc-ln">${num.n++}</span>`+
        `<span class="doc-lc" ${ind}>${html}</span>`+
        `</div>`
      );
    };

    const bOpen  = () => lines.push(`<div class="doc-block-body" data-indent="${pad}">`);
    const bClose = () => lines.push(`</div>`);

    (nodes || []).forEach(node => {
      if (!node || !node.id) return;

      // Corrupt node — render placeholder, skip children
      if (node._corrupt) {
        ln(`<span class="doc-err">⚠ Unknown statement [${_esc(node.id)}] — edit to repair</span>`,
          pad, { id: node.id, type: node.type || 'unknown' });
        return;
      }

      const id = node.id;
      const t  = node.type;

      // ── IF ──────────────────────────────────────────────────────────────
      if (t === 'if') {
        bOpen();
          ln(`<span class="kw">if</span>`, pad, { id, type: t });
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '+ add a condition');
          ln(`<span class="kw">then</span>`, pad);
          _actionLines(node.then || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'then', 'block-id': id });
          (node.else_ifs || []).forEach(eib => {
            ln(`<span class="kw">else if</span>`, pad);
            _renderConditionBlock(eib.conditions, eib.condition_operator, eib.id, pad, ln, gh, '+ add a condition');
            ln(`<span class="kw">then</span>`, pad);
            _actionLines(eib.statements || [], depth + 2, lines, num, gh);
            gh('+ add a new statement', 'action', pad + 2, { branch: 'else_if_statements', 'block-id': eib.id });
          });
          ln(`<span class="kw">else</span>`, pad);
          _actionLines(node.else || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'else', 'block-id': id });
          ln(`<span class="kw">end if;</span>`, pad);
        bClose();

      // ── ACTION (with) ────────────────────────────────────────────────────
      } else if (t === 'action') {
        bOpen();
          ln(`<span class="kw">with</span>`, pad, { id, type: t });
          ln(_renderActionDevices(node), pad + 1);
          ln(`<span class="kw">do</span>`, pad);
          (node.tasks || []).forEach(task => {
            const display = _renderTask(task);
            ln(`<span class="kw">do</span> ${display};`, pad + 2,
              { id: task.id, type: 'task', 'task-owner': id });
          });
          gh('+ add a new task', 'task', pad + 2, { 'block-id': id });
          ln(`<span class="kw">end with;</span>`, pad);
        bClose();

      // ── WHILE ────────────────────────────────────────────────────────────
      } else if (t === 'while') {
        bOpen();
          ln(`<span class="kw">while</span>`, pad, { id, type: t });
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '+ add a condition');
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">end while;</span>`, pad);
        bClose();

      // ── REPEAT (do-until) ────────────────────────────────────────────────
      } else if (t === 'repeat') {
        bOpen();
          ln(`<span class="kw">repeat</span>`, pad, { id, type: t });
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">until</span>`, pad);
          _renderConditionBlock(node.until_conditions, node.condition_operator, id, pad, ln, gh, '+ add a condition');
          ln(`<span class="kw">end repeat;</span>`, pad);
        bClose();

      // ── DO ───────────────────────────────────────────────────────────────
      } else if (t === 'do') {
        bOpen();
          if (node.description) ln(_cm(node.description), pad);
          ln(`<span class="kw">do</span>`, pad, { id, type: t });
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">end do;</span>`, pad);
        bClose();

      // ── ON_EVENT ─────────────────────────────────────────────────────────
      } else if (t === 'on_event') {
        bOpen();
          ln(`<span class="kw">on events from</span>`, pad, { id, type: t });
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '+ add an event');
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">end on;</span>`, pad);
        bClose();

      // ── EVERY (timer) ────────────────────────────────────────────────────
      } else if (t === 'every') {
        const interval = node.interval !== undefined ? _esc(String(node.interval)) : _ph('?');
        const unit     = _esc(node.interval_unit || '');
        const atTime   = node.at_time   ? ` at ${_esc(node.at_time)}` : '';
        const atMin    = node.at_minute !== null && node.at_minute !== undefined
          ? ` at :${_esc(String(node.at_minute))}` : '';
        bOpen();
          ln(`<span class="kw">every</span> ${interval} ${unit}${atMin}${atTime}`, pad, { id, type: t });
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">end every;</span>`, pad);
        bClose();

      // ── SWITCH ───────────────────────────────────────────────────────────
      } else if (t === 'switch') {
        const expr = node.expression ? _val(node.expression) : _ph('[subject]');
        bOpen();
          ln(`<span class="kw">switch</span> (${expr})`, pad, { id, type: t });
          (node.cases || []).forEach(c => {
            bOpen();
              const caseLabel = c.case_type === 'range'
                ? `${_esc(String(c.value_from ?? ''))} <span class="kw">to</span> ${_esc(String(c.value_to ?? ''))}`
                : _esc(String(c.value ?? ''));
              ln(`<span class="kw">case</span> ${caseLabel}<span class="kw">:</span>`,
                pad + 1, { id: c.id, type: 'case' });
              _actionLines(c.statements || [], depth + 3, lines, num, gh);
              gh('+ add a new statement', 'action', pad + 3, { 'block-id': c.id, branch: 'statements' });
            bClose();
          });
          bOpen();
            ln(`<span class="kw">default:</span>`, pad + 1);
            _actionLines(node.default || [], depth + 3, lines, num, gh);
            gh('+ add a new statement', 'action', pad + 3, { branch: 'default', 'block-id': id });
          bClose();
          ln(`<span class="kw">end switch;</span>`, pad);
        bClose();

      // ── FOR ──────────────────────────────────────────────────────────────
      } else if (t === 'for') {
        const cvar = node.counter_variable
          ? `<span class="doc-var">${_esc(node.counter_variable)}</span>`
          : _ph('$i');
        const from = node.start !== undefined ? _esc(String(node.start)) : _ph('from');
        const to   = node.end   !== undefined ? _esc(String(node.end))   : _ph('to');
        const step = node.step !== undefined && node.step !== 1
          ? ` <span class="kw">step</span> ${_esc(String(node.step))}` : '';
        bOpen();
          ln(`<span class="kw">for</span> (${cvar} = ${from} <span class="kw">to</span> ${to}${step})`,
            pad, { id, type: t });
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">end for;</span>`, pad);
        bClose();

      // ── FOR_EACH ─────────────────────────────────────────────────────────
      } else if (t === 'for_each') {
        const cvar = node.variable
          ? `<span class="doc-var">${_esc(node.variable)}</span>`
          : _ph('$device');
        const list = node.role
          ? _dr(node.role)
          : (node.role_tokens && node.role_tokens.length ? _dr(node.role_tokens.join(', ')) : _ph('[device list]'));
        bOpen();
          ln(`<span class="kw">for each</span> (${cvar} <span class="kw">in</span> ${list})`,
            pad, { id, type: t });
          ln(`<span class="kw">do</span>`, pad);
          _actionLines(node.statements || [], depth + 2, lines, num, gh);
          gh('+ add a new statement', 'action', pad + 2, { branch: 'statements', 'block-id': id });
          ln(`<span class="kw">end for each;</span>`, pad);
        bClose();

      // ── BREAK ────────────────────────────────────────────────────────────
      } else if (t === 'break') {
        ln(`<span class="kw">break</span>;`, pad, { id, type: t });

      // ── EXIT ─────────────────────────────────────────────────────────────
      } else if (t === 'exit') {
        const exitVal = node.value !== undefined ? ` ${_val(node.value)}` : '';
        ln(`<span class="kw">exit</span>${exitVal};`, pad, { id, type: t });

      // ── SET_VARIABLE ─────────────────────────────────────────────────────
      } else if (t === 'set_variable') {
        const varName = node.variable
          ? `<span class="doc-var">${_esc(node.variable)}</span>`
          : _ph('$variable');
        ln(`<span class="kw">set variable</span> ${varName} = ${_val(node.value)};`,
          pad, { id, type: t });

      // ── WAIT ─────────────────────────────────────────────────────────────
      } else if (t === 'wait') {
        let waitDisplay;
        if (node.wait_type === 'until') {
          waitDisplay = `<span class="kw">Wait until</span> ${_esc(node.until || '')}`;
        } else if (node.wait_type === 'duration' && node.duration_variable) {
          waitDisplay = `<span class="kw">Wait</span> <span class="doc-var">${_esc(node.duration_variable)}</span>`;
        } else {
          waitDisplay = `<span class="kw">Wait</span> ${_esc(String(node.duration || ''))} ${_esc(node.duration_unit || '')}`;
        }
        ln(`<span class="kw">do</span> ${waitDisplay};`, pad, { id, type: t });

      // ── WAIT_FOR_STATE ───────────────────────────────────────────────────
      } else if (t === 'wait_for_state') {
        bOpen();
          ln(`<span class="kw">wait for state</span>${
            node.timeout_seconds != null ? ` <span class="kw">timeout</span> ${_esc(String(node.timeout_seconds))}s` : ''
          }`, pad, { id, type: t });
          _renderConditionBlock(node.conditions, node.condition_operator, id, pad, ln, gh, '+ add a condition');
          ln(`<span class="kw">end wait;</span>`, pad);
        bClose();

      // ── LOG_MESSAGE ──────────────────────────────────────────────────────
      } else if (t === 'log_message') {
        const lvl = node.level ? `[${_esc(node.level)}] ` : '';
        const msg = node.message
          ? _val(node.message)
          : _ph('[message]');
        ln(`<span class="kw">log</span> ${lvl}${msg};`, pad, { id, type: t });

      // ── CALL_PISTON ──────────────────────────────────────────────────────
      } else if (t === 'call_piston') {
        const name = node.target_piston_name || node.target_piston_id || '';
        ln(`<span class="kw">call piston</span> ${_esc(name)};`, pad, { id, type: t });

      // ── CANCEL_PENDING_TASKS ─────────────────────────────────────────────
      } else if (t === 'cancel_pending_tasks') {
        ln(`<span class="kw">cancel pending tasks</span>;`, pad, { id, type: t });

      // ── UNKNOWN ──────────────────────────────────────────────────────────
      } else {
        ln(`<span class="doc-err">⚠ Unknown statement type: ${_esc(t || '?')} [${_esc(id)}] — edit to repair</span>`,
          pad, { id, type: t || 'unknown' });
      }
    });
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  // Renders conditions inside a block (if / while / repeat / on_event / wait_for_state).
  // Uses the block's condition_operator between conditions (single operator for the whole block).
  function _renderConditionBlock(conditions, blockOp, blockId, pad, ln, gh, ghostText) {
    const op = blockOp || 'and';
    (conditions || []).forEach((c, i) => {
      if (i > 0) {
        ln(`<span class="doc-condop kw" data-condop-block="${_esc(blockId)}">${_esc(op)}</span>`,
          pad + 1, { id: `condop_${_esc(blockId)}_${i}`, type: 'condition_operator' });
      }
      ln(_condLine(c), pad + 1,
        { id: c.id, type: c.is_trigger ? 'trigger' : 'condition', 'parent-block': blockId });
    });
    gh(ghostText, 'if_condition', pad + 1, { 'block-id': blockId });
  }

  // Renders one condition / trigger / restriction line.
  // Reads from the flat PistonCore condition shape (role, attribute, operator, display_value, etc.).
  function _condLine(c) {
    if (!c || typeof c !== 'object') return _ph('[condition]');

    // Group — render as group summary
    if (c.type === 'group' || c.t === 'group' || c.is_group) {
      const op    = _esc(c.group_operator || c.operator || 'and');
      const neg   = c.negated || c.n ? `${_kw('not')} ` : '';
      const count = (c.conditions || []).length;
      return `${neg}${_kw('group')} (${op}, ${count} condition${count !== 1 ? 's' : ''})`;
    }

    // Determine subject type and display label
    let role, attrName, subjType;

    if (c.subject) {
      // Legacy nested format (some imported pistons)
      const s = c.subject;
      subjType = s.type || 'device';
      role     = s.role || s.entity_id || '';
      attrName = s.capability || s.attribute || '';
    } else {
      // Flat format — canonical PistonCore shape
      role     = c.role || '';
      attrName = c.attribute || c.capability || '';
      if      (role === 'time'           || c.subject_type === 'time')     subjType = 'time';
      else if (role === 'date'           || c.subject_type === 'date')     subjType = 'date';
      else if (role === 'mode'           || c.subject_type === 'mode')     subjType = 'mode';
      else if (c.subject_type === 'variable')                              subjType = 'variable';
      else if (role)                                                       subjType = 'device';
      else                                                                 subjType = null;
    }

    if (!subjType) return _ph('[condition]');

    // Aggregation label
    const AGG = { any: 'Any of', all: 'All of', none: 'None of' };
    const agg = subjType === 'device' && c.aggregation && c.aggregation !== 'any'
      ? `${_kw(AGG[c.aggregation] || c.aggregation)} ` : '';

    // Subject rendering
    let subj;
    if      (subjType === 'device')   subj = _dr(role);
    else if (subjType === 'variable') subj = `<span class="doc-var">$${_esc(role)}</span>`;
    else                              subj = _kw(subjType);

    const attr = attrName ? ` <span class="doc-attr">${_esc(attrName)}</span>` : '';
    const op   = c.operator ? ` ${_kw(c.operator)}` : '';

    // Right operand — display_value is the wizard-written friendly label
    const rawVal = c.display_value !== undefined && c.display_value !== null && c.display_value !== ''
      ? String(c.display_value)
      : (c.value !== undefined && c.value !== null ? String(c.value) : '');
    const val = rawVal ? ` ${_esc(rawVal)}` : '';

    // Range second operand
    const val2 = c.value_to !== undefined && c.value_to !== null && c.value_to !== ''
      ? ` ${_kw('and')} ${_esc(String(c.value_to))}` : '';

    // Duration (timed conditions: "for 5 minutes")
    const dur = c.duration
      ? ` ${_kw('for')} ${_esc(String(c.duration))} ${_esc(c.duration_unit || '')}` : '';

    return `${agg}${subj}${attr}${op}${val}${val2}${dur}`;
  }

  // Renders one task's display line.
  // Uses webcore_vocab.json "d" format string with {N} substitution.
  // Falls back to command.n, then snake_case conversion.
  function _renderTask(task) {
    const cmdKey = task.command || task.service || '';
    const params = task.parameters || {};

    if (_vocab && cmdKey) {
      const allCmds = Object.assign({}, _vocab.commands || {}, _vocab.virtualCommands || {});
      const entry   = allCmds[cmdKey];

      if (entry) {
        if (entry.d && entry.p) {
          // Substitute positional {0}, {1}, … from the parameter name list
          let display = entry.d;
          entry.p.forEach((param, i) => {
            const val = params[param.n] !== undefined ? String(params[param.n]) : '';
            if (param.d) {
              // Optional parameter with its own sub-template (e.g. " at volume {v}")
              const subDisplay = val !== '' ? param.d.replace('{v}', _esc(val)) : '';
              display = display.replace(`{${i}}`, subDisplay);
            } else {
              display = display.replace(`{${i}}`, _esc(val));
            }
          });
          // Clear any unreferenced placeholders
          display = display.replace(/\{[0-9]+\}/g, '');
          return display;
        }
        if (entry.d) {
          // Format string but no parameter list
          return _esc(entry.d.replace(/\{[0-9]+\}/g, ''));
        }
        if (entry.n) return _esc(entry.n);
      }
    }

    // Fallback: snake_case → Title Case
    return _esc(_friendlyCmd(cmdKey));
  }

  // Renders the device list for an ACTION node's "with" display line.
  function _renderActionDevices(node) {
    if (node.role) return _dr(node.role);
    if (node.role_tokens && node.role_tokens.length) {
      const labels = node.role_tokens.map(t =>
        t.startsWith('@') ? `<span class="doc-var">@${_esc(t.slice(1))}</span>` : _esc(t)
      ).join(', ');
      return `<span class="doc-dev">{${labels}}</span>`;
    }
    if (node.entity_ids && node.entity_ids.length) return _dr(node.entity_ids[0]);
    return _ph('[no device]');
  }

  // ── Display helpers ────────────────────────────────────────────────────────
  function _dr(label) { return `<span class="doc-dev">{${_esc(label)}}</span>`; }
  function _dv(sig, name) { return `<span class="doc-var">${_esc(sig)}${_esc(name)}</span>`; }
  function _kw(text) { return `<span class="kw">${_esc(text)}</span>`; }
  function _cm(text) { return `<span class="doc-cmt">/* ${_esc(text)} */</span>`; }
  function _ph(text) { return `<span class="doc-ph">${_esc(text)}</span>`; }

  function _val(v) {
    if (v === null || v === undefined) return _ph('?');
    if (typeof v === 'object') {
      if (v.type === 'variable')        return _dv('$', v.name || '');
      if (v.type === 'global_variable') return _dv('@', v.name || '');
      if (v.type === 'system_variable') return _dv('$', v.name || '');
      if (v.type === 'literal')         return _esc(String(v.data ?? ''));
      if (v.type === 'expression')      return `<span class="doc-expr">${_esc(v.expression || '')}</span>`;
    }
    return _esc(String(v));
  }

  function _typeLabel(t) {
    return {
      string:'string', boolean:'boolean', integer:'number (integer)',
      decimal:'number (decimal)', long:'large number', datetime:'date and time',
      date:'date', time:'time', device:'device', devices:'devices', dynamic:'dynamic',
    }[t] || t || 'dynamic';
  }

  // snake_case → "Title case" fallback for commands without a vocab entry
  function _friendlyCmd(cmd) {
    if (!cmd) return 'call service';
    const bare   = cmd.includes('.') ? cmd.split('.').slice(1).join('.') : cmd;
    const spaced = bare.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }

  function _nextStmtId() {
    return 'stmt_' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Structure lines positioning ───────────────────────────────────────────
  // Measures the gutter and indent to set --block-left on .doc-block-body elements
  // so the CSS ::before line lands at the correct horizontal position.
  function _positionStructureLines() {
    requestAnimationFrame(() => {
      const lnEl = document.querySelector('.doc-ln');
      if (!lnEl) return;
      const gutterW = lnEl.getBoundingClientRect().width;
      let indentPx = 32;
      const lcEl = document.querySelector('.doc-lc[style*="padding-left"]');
      if (lcEl) {
        const m = lcEl.style.paddingLeft.match(/calc\(var\(--doc-indent\)\s*\*\s*(\d+)\)/);
        if (m) {
          const level    = parseInt(m[1]);
          const computed = parseFloat(getComputedStyle(lcEl).paddingLeft);
          if (level > 0) indentPx = computed / level;
        }
      }
      document.querySelectorAll('.doc-block-body').forEach(el => {
        const indent = parseInt(el.dataset.indent || '0');
        el.style.setProperty('--block-left', `${gutterW + indent * indentPx - 6}px`);
      });
    });
  }

  // ── Event wiring ──────────────────────────────────────────────────────────
  function _wireEvents() {
    document.getElementById('btn-editor-cancel')?.addEventListener('click', _handleCancel);
    document.getElementById('btn-save')?.addEventListener('click', () => save());
    document.getElementById('btn-editor-delete')?.addEventListener('click', _handleDelete);
    document.getElementById('pyscript-help-link')?.addEventListener('click', e => {
      e.preventDefault();
      if (typeof App !== 'undefined' && App.openHelp) App.openHelp('pyscript');
    });
    document.getElementById('btn-migrate')?.addEventListener('click', () => {
      if (_piston) { _piston.logic_version = 2; delete _piston._legacyVersion; }
      _markUnsaved(true);
      render();
    });
    document.getElementById('btn-leave-legacy')?.addEventListener('click', () => {
      const el = document.getElementById('legacy-banner');
      if (el) el.style.display = 'none';
    });
    document.getElementById('btn-snapshot')?.addEventListener('click', async () => {
      try {
        const url = `${window.location.origin}/api/pistons/${_piston.id}/snapshot`;
        const a   = Object.assign(document.createElement('a'), { href: url, download: '' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch(e) { _showNotice(`Snapshot failed: ${e.message}`, 'error'); }
    });
    document.getElementById('btn-backup')?.addEventListener('click', async () => {
      try {
        const url = `${window.location.origin}/api/pistons/${_piston.id}/backup`;
        const a   = Object.assign(document.createElement('a'), { href: url, download: '' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch(e) { _showNotice(`Backup failed: ${e.message}`, 'error'); }
    });

    document.getElementById('editor-piston-name')?.addEventListener('input', () => _markUnsaved(true));

    const doc = document.getElementById('editor-doc');
    if (doc) {
      doc.addEventListener('click',       _handleDocClick);
      doc.addEventListener('contextmenu', _handleContextMenu);
    }
  }

  function _handleDocClick(e) {
    // Ghost insertion point clicked
    const ghost = e.target.closest('.ghost');
    if (ghost) {
      const ctx   = ghost.dataset.insert;
      const extra = {};
      for (const k of Object.keys(ghost.dataset)) {
        if (k === 'insert') continue;
        const hyphenKey = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        extra[hyphenKey] = ghost.dataset[k];
      }
      Wizard.open(ctx, null, extra);
      return;
    }

    // Condition operator (and/or) line — toggle inline, no wizard popup
    const condop = e.target.closest('.doc-condop');
    if (condop) {
      const blockId = condop.dataset.condopBlock;
      if (blockId && blockId !== 'root') {
        const block = _findNode(blockId) || _findElseIf(blockId);
        if (block) {
          block.condition_operator = block.condition_operator === 'or' ? 'and' : 'or';
          _markUnsaved(true);
          render();
        }
      }
      return;
    }

    // Statement line clicked — select and open wizard
    const stmt = e.target.closest('.doc-stmt');
    if (!stmt) return;
    if (stmt.dataset.type === 'condition_operator') return;

    _selectStmt(stmt.dataset.id);

    // Task line: the owner action node is stamped on data-task-owner
    if (stmt.dataset.type === 'task') {
      const ownerId = stmt.dataset['taskOwner'] || stmt.dataset['task-owner'] || null;
      const taskId  = stmt.dataset.id;
      const owner   = ownerId ? _findAnyNode(ownerId) : null;
      if (owner) Wizard.open('task', owner, { 'task-id': taskId });
      return;
    }

    const node        = _findAnyNode(stmt.dataset.id);
    const parentBlock = stmt.dataset['parentBlock'] || stmt.dataset['parent-block'] || null;
    const rendType    = stmt.dataset.type || null;
    if (node) _openWizardForEdit(node, parentBlock, rendType);
  }

  function _openWizardForEdit(node, parentBlockId, renderedType) {
    const t = node.type || renderedType || '';

    if (t === 'trigger') {
      Wizard.open('trigger', node, {});
    } else if (t === 'condition') {
      parentBlockId
        ? Wizard.open('if_condition', node, { 'block-id': parentBlockId })
        : Wizard.open('edit_condition', node, {});
    } else if (t === 'restriction') {
      Wizard.open('edit_restriction', node, {});
    } else if (t === 'variable') {
      Wizard.open('variable', node, {});
    } else if (t === 'action') {
      Wizard.open('action', node, { 'block-id': node.id });
    } else if (t === 'if') {
      Wizard.open('if', node, { 'block-id': node.id });
    } else {
      Wizard.open(t, node, {});
    }
  }

  function _handleContextMenu(e) {
    const stmt = e.target.closest('.doc-stmt');
    if (!stmt) return;
    e.preventDefault();
    _selectStmt(stmt.dataset.id);
    App.showContextMenu(e.clientX, e.clientY, [
      { label: 'Edit',                          action: () => _editSelected() },
      { label: 'Copy selected statement',       action: () => _copySelected() },
      { label: 'Duplicate selected statement',  action: () => _duplicateSelected() },
      { separator: true },
      { label: 'Cut selected statement',        action: () => _cutSelected() },
      { label: 'Paste after selected',          action: () => _pasteSelected(),
        disabled: !App.state.clipboard },
      { separator: true },
      { label: 'Delete selected statement',     action: () => _deleteSelected(), danger: true },
      { separator: true },
      { label: 'Clear clipboard',               action: () => { App.state.clipboard = null; } },
    ]);
  }

  function _selectStmt(id) {
    _selectedId = id;
    document.querySelectorAll('.doc-stmt').forEach(el => {
      el.classList.toggle('doc-selected', el.dataset.id === id);
    });
  }

  // ── Selection actions ──────────────────────────────────────────────────────
  function _editSelected() {
    if (!_selectedId) return;
    const node = _findAnyNode(_selectedId);
    if (node) _openWizardForEdit(node, null, null);
  }

  function _copySelected() {
    if (!_selectedId) return;
    const node = _findAnyNode(_selectedId);
    if (node) App.state.clipboard = JSON.parse(JSON.stringify(node));
  }

  function _cutSelected() {
    _copySelected();
    _cutId = _selectedId;
    document.querySelectorAll('.doc-stmt').forEach(el => {
      el.classList.toggle('doc-cut', el.dataset.id === _cutId);
    });
  }

  function _duplicateSelected() { _copySelected(); _pasteSelected(); }

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

  function _deleteSelected() {
    if (!_selectedId) return;
    const id = _selectedId;
    if (!_removeFromArr(_piston.triggers, id) &&
        !_removeFromArr(_piston.conditions, id) &&
        !_removeFromArr(_piston.restrictions, id) &&
        !_removeFromArr(_piston.variables, id) &&
        !_removeConditionNode(id)) {
      _removeNode(id);
    }
    _selectedId = null;
    _markUnsaved(true);
    render();
  }

  // Regenerates every id in a cloned subtree so no UUID appears twice.
  function _deepReId(node) {
    if (!node || typeof node !== 'object') return;
    if (node.id) node.id = _nextStmtId();
    (node.then       || []).forEach(n => _deepReId(n));
    (node.else       || []).forEach(n => _deepReId(n));
    (node.statements || []).forEach(n => _deepReId(n));
    (node.default    || []).forEach(n => _deepReId(n));
    (node.else_ifs   || []).forEach(eib => {
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

  // ── Tree manipulation ──────────────────────────────────────────────────────

  // Finds a statement node by id anywhere in the nested tree.
  // Does NOT search triggers / conditions / variables — use _findAnyNode for those.
  function _findNode(id, nodes) {
    if (!id) return null;
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (const node of nodes) {
      if (!node) continue;
      if (node.id === id) return node;
      let found =
        _findNode(id, node.then       || []) ||
        _findNode(id, node.else       || []) ||
        _findNode(id, node.statements || []) ||
        _findNode(id, node.default    || []);
      if (found) return found;
      for (const eib of (node.else_ifs || [])) {
        found = _findNode(id, eib.statements || []);
        if (found) return found;
      }
      for (const c of (node.cases || [])) {
        if (c.id === id) return c;
        found = _findNode(id, c.statements || []);
        if (found) return found;
      }
    }
    return null;
  }

  // Finds a condition node by id in conditions / until_conditions anywhere in the tree.
  function _findCondition(id, nodes) {
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (const node of nodes) {
      if (!node) continue;
      for (const arr of [node.conditions || [], node.until_conditions || []]) {
        const hit = arr.find(c => c?.id === id);
        if (hit) return hit;
      }
      for (const eib of (node.else_ifs || [])) {
        const hit = (eib.conditions || []).find(c => c?.id === id);
        if (hit) return hit;
        const deep = _findCondition(id, eib.statements || []);
        if (deep) return deep;
      }
      const found =
        _findCondition(id, node.then       || []) ||
        _findCondition(id, node.else       || []) ||
        _findCondition(id, node.statements || []) ||
        _findCondition(id, node.default    || []);
      if (found) return found;
    }
    return null;
  }

  // Finds an else_if block by id inside any if node's else_ifs array.
  function _findElseIf(eibId, nodes) {
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (const node of nodes) {
      if (!node) continue;
      for (const eib of (node.else_ifs || [])) {
        if (eib.id === eibId) return eib;
      }
      const found =
        _findElseIf(eibId, node.then       || []) ||
        _findElseIf(eibId, node.else       || []) ||
        _findElseIf(eibId, node.statements || []);
      if (found) return found;
    }
    return null;
  }

  // Searches triggers, conditions, restrictions, variables, then the statement tree.
  function _findAnyNode(id) {
    if (!id || !_piston) return null;
    const inArr = arr => (arr || []).find(n => n?.id === id) || null;
    return inArr(_piston.triggers)    ||
           inArr(_piston.conditions)  ||
           inArr(_piston.restrictions)||
           inArr(_piston.variables)   ||
           _findNode(id)              ||
           _findCondition(id);
  }

  // Removes the node with the given id from the statement tree (not conditions).
  function _removeNode(id, nodes) {
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i]?.id === id) { nodes.splice(i, 1); return true; }
      const node = nodes[i];
      if (!node) continue;
      if (_removeNode(id, node.then       || [])) return true;
      if (_removeNode(id, node.else       || [])) return true;
      if (_removeNode(id, node.statements || [])) return true;
      if (_removeNode(id, node.default    || [])) return true;
      for (const eib of (node.else_ifs || [])) {
        if (_removeNode(id, eib.statements || [])) return true;
      }
      for (const c of (node.cases || [])) {
        if (_removeNode(id, c.statements || [])) return true;
      }
    }
    return false;
  }

  // Removes a condition node from conditions / until_conditions arrays in the tree.
  function _removeConditionNode(id, nodes) {
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (const node of nodes) {
      if (!node) continue;
      for (const arr of [node.conditions || [], node.until_conditions || []]) {
        const i = arr.findIndex(c => c?.id === id);
        if (i !== -1) { arr.splice(i, 1); return true; }
      }
      for (const eib of (node.else_ifs || [])) {
        const arr = eib.conditions || [];
        const i   = arr.findIndex(c => c?.id === id);
        if (i !== -1) { arr.splice(i, 1); return true; }
        if (_removeConditionNode(id, eib.statements || [])) return true;
      }
      if (_removeConditionNode(id, node.then       || [])) return true;
      if (_removeConditionNode(id, node.else       || [])) return true;
      if (_removeConditionNode(id, node.statements || [])) return true;
      if (_removeConditionNode(id, node.default    || [])) return true;
    }
    return false;
  }

  // Removes id from a flat array. Returns true if found.
  function _removeFromArr(arr, id) {
    if (!arr) return false;
    const i = arr.findIndex(n => n?.id === id);
    if (i !== -1) { arr.splice(i, 1); return true; }
    return false;
  }

  // Splices newNode immediately after targetId anywhere in the tree.
  function _insertAfter(targetId, newNode) {
    function spliceInto(nodes) {
      if (!nodes) return false;
      const i = nodes.findIndex(n => n?.id === targetId);
      if (i !== -1) { nodes.splice(i + 1, 0, newNode); return true; }
      for (const node of nodes) {
        if (!node) continue;
        if (spliceInto(node.then))       return true;
        if (spliceInto(node.else))       return true;
        if (spliceInto(node.statements)) return true;
        if (spliceInto(node.default))    return true;
        for (const eib of (node.else_ifs || [])) {
          if (spliceInto(eib.statements)) return true;
        }
        for (const c of (node.cases || [])) {
          if (spliceInto(c.statements)) return true;
        }
      }
      return false;
    }
    if (!spliceInto(_piston.statements || [])) {
      console.warn('PistonCore: _insertAfter target not found, appending to top level', targetId);
      (_piston.statements = _piston.statements || []).push(newNode);
    }
  }

  // Replaces the node with statementData.id in-place anywhere in the statement tree.
  function _replaceNode(statementData, nodes) {
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i]?.id === statementData.id) { nodes[i] = statementData; return true; }
      const node = nodes[i];
      if (!node) continue;
      if (_replaceNode(statementData, node.then       || [])) return true;
      if (_replaceNode(statementData, node.else       || [])) return true;
      if (_replaceNode(statementData, node.statements || [])) return true;
      if (_replaceNode(statementData, node.default    || [])) return true;
      for (const eib of (node.else_ifs || [])) {
        if (_replaceNode(statementData, eib.statements || [])) return true;
      }
      for (const c of (node.cases || [])) {
        if (_replaceNode(statementData, c.statements || [])) return true;
      }
    }
    return false;
  }

  // Replaces a condition in conditions / until_conditions arrays anywhere in the tree.
  function _replaceCondition(statementData, nodes) {
    nodes = nodes !== undefined ? nodes : (_piston?.statements || []);
    for (const node of nodes) {
      if (!node) continue;
      for (const arr of [node.conditions || [], node.until_conditions || []]) {
        const i = arr.findIndex(c => c?.id === statementData.id);
        if (i !== -1) { arr[i] = statementData; return true; }
      }
      for (const eib of (node.else_ifs || [])) {
        const arr = eib.conditions || [];
        const i   = arr.findIndex(c => c?.id === statementData.id);
        if (i !== -1) { arr[i] = statementData; return true; }
        if (_replaceCondition(statementData, eib.statements || [])) return true;
      }
      if (_replaceCondition(statementData, node.then       || [])) return true;
      if (_replaceCondition(statementData, node.else       || [])) return true;
      if (_replaceCondition(statementData, node.statements || [])) return true;
      if (_replaceCondition(statementData, node.default    || [])) return true;
    }
    return false;
  }

  // ── insertStatement — called by wizard on commit ───────────────────────────
  // Routes based on context so each section receives its own node type correctly.
  //
  // Context routing:
  //   trigger           → piston.triggers[]
  //   condition         → piston.conditions[]
  //   restriction       → piston.restrictions[]
  //   variable          → piston.variables[]
  //   if_condition      → block.conditions[] identified by meta.blockId
  //   trigger_or_cond.  → same as if_condition when meta.blockId present
  //   task              → action.tasks[] identified by meta.blockId
  //   action+branch     → block[branch][] (then / else / statements / default)
  //   else              → statement replace-or-insert in the statement tree
  function insertStatement(context, statementData, meta) {
    // ── Conditions inside a block ─────────────────────────────────────────
    if (context === 'if_condition' ||
        (context === 'trigger_or_condition' && meta?.blockId)) {
      const blockId = meta?.blockId;
      if (blockId) {
        const block = _findNode(blockId);
        if (block) {
          block.conditions = block.conditions || [];
          const ci = block.conditions.findIndex(c => c.id === statementData.id);
          if (ci >= 0) block.conditions[ci] = statementData;
          else block.conditions.push(statementData);
          if (meta?.conditionOperator) block.condition_operator = meta.conditionOperator;
          _markUnsaved(true); render(); return;
        }
        // Block not found — may be an edit; try replacing wherever the condition lives
        if (_replaceCondition(statementData)) {
          _markUnsaved(true); render(); return;
        }
        console.warn('PistonCore: insertStatement — block not found for id:', blockId);
        _showNotice('Could not find the target block — condition not inserted.', 'warn');
        return;
      }
      // No blockId — fall through to root-level condition handling below
    }

    // ── Tasks inside an action block ──────────────────────────────────────
    if (context === 'task' && meta?.blockId && !meta?.branch) {
      const action = _findNode(meta.blockId);
      if (action && action.type === 'action') {
        if (!statementData.id) statementData.id = _nextStmtId();
        action.tasks = action.tasks || [];
        const ti = action.tasks.findIndex(t => t.id === statementData.id);
        if (ti >= 0) action.tasks[ti] = statementData;
        else action.tasks.push(statementData);
        _markUnsaved(true); render(); return;
      }
    }

    // ── Branch insertion (then / else / statements / default) ─────────────
    if (meta?.blockId && meta?.branch) {
      if (!statementData.id) statementData.id = _nextStmtId();
      if (_replaceNode(statementData)) { _markUnsaved(true); render(); return; }

      if (meta.branch === 'else_if_statements') {
        const eib = _findElseIf(meta.blockId);
        if (eib) {
          eib.statements = eib.statements || [];
          eib.statements.push(statementData);
          _markUnsaved(true); render(); return;
        }
      }

      const block = _findNode(meta.blockId);
      if (block) {
        block[meta.branch] = block[meta.branch] || [];
        block[meta.branch].push(statementData);
        _markUnsaved(true); render(); return;
      }
    }

    // ── Root-level arrays ─────────────────────────────────────────────────
    if (context === 'trigger' || statementData.is_trigger) {
      _piston.triggers = _piston.triggers || [];
      const i = _piston.triggers.findIndex(t => t.id === statementData.id);
      if (i >= 0) _piston.triggers[i] = statementData;
      else _piston.triggers.push(statementData);

    } else if (context === 'condition' || statementData.type === 'condition') {
      _piston.conditions = _piston.conditions || [];
      const i = _piston.conditions.findIndex(c => c.id === statementData.id);
      if (i >= 0) _piston.conditions[i] = statementData;
      else _piston.conditions.push(statementData);

    } else if (context === 'restriction' || statementData.type === 'restriction') {
      _piston.restrictions = _piston.restrictions || [];
      const i = _piston.restrictions.findIndex(r => r.id === statementData.id);
      if (i >= 0) _piston.restrictions[i] = statementData;
      else _piston.restrictions.push(statementData);

    } else if (context === 'variable') {
      _piston.variables = _piston.variables || [];
      const i = _piston.variables.findIndex(v => v.id === statementData.id);
      if (i >= 0) _piston.variables[i] = statementData;
      else _piston.variables.push(statementData);
      if ((statementData.var_type === 'device' || statementData.var_type === 'devices') &&
          statementData.name) {
        _reResolveVariableUses(statementData.name, statementData.initial_value || []);
      }

    } else {
      // Statement — replace in-place (edit) or insert after selection (new)
      if (!statementData.id) statementData.id = _nextStmtId();
      if (!_replaceNode(statementData)) {
        if (_selectedId) _insertAfter(_selectedId, statementData);
        else (_piston.statements = _piston.statements || []).push(statementData);
      }
    }

    _markUnsaved(true);
    render();

    // §7.4 chaining — after committing IF/ACTION etc., auto-open the next wizard
    if (meta?.chain && statementData.id) {
      setTimeout(() => _chainToNextWizard(statementData, meta.chain, meta.chainSubtype || null), 50);
    }
  }

  // Called by wizard with a specific id — does not require _selectedId.
  function deleteStatement(id) {
    if (!id) return;
    if (!_removeFromArr(_piston.triggers,     id) &&
        !_removeFromArr(_piston.conditions,   id) &&
        !_removeFromArr(_piston.restrictions, id) &&
        !_removeFromArr(_piston.variables,    id) &&
        !_removeConditionNode(id)) {
      _removeNode(id);
    }
    if (_selectedId === id) _selectedId = null;
    _markUnsaved(true);
    render();
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function _markUnsaved(has) {
    App.state.unsavedChanges = has;
    const dot = document.getElementById('unsaved-dot');
    if (dot) dot.style.display = has ? 'inline' : 'none';
  }

  function _showNotice(msg, type) {
    const el = document.getElementById('editor-notice');
    if (!el) return;
    const cls = type === 'error' ? 'banner-error' : type === 'warn' ? 'banner-warn' : 'banner-info';
    el.innerHTML = `<div class="banner ${cls} editor-notice-bar">${_esc(msg)}</div>`;
    if (type === 'info') setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
  }

  function _handleCancel() {
    if (_isNew) {
      App.confirm({
        title: 'Discard new piston?',
        message: 'This piston has never been saved. Discard it and return to the list?',
        confirmLabel: 'Discard',
        cancelLabel:  'Keep editing',
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
        cancelLabel:  'Stay',
        danger: true,
        onConfirm: () => App.navigate('status', { pistonId: _piston.id }),
      });
    } else {
      App.navigate('status', { pistonId: _piston.id });
    }
  }

  function _handleDelete() {
    App.confirm({
      title: `Delete "${_piston.name || 'this piston'}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try { await API.deletePiston(_piston.id); App.navigate('list'); }
        catch(e) { _showNotice(`Delete failed: ${e.message}`, 'error'); }
      },
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
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

    try {
      const { _globalsCache, ...pistonToSave } = _piston;
      const result = await API.savePiston(_piston.id, pistonToSave);
      _piston = result.piston || _piston;
      if (_globalsCache) _piston._globalsCache = _globalsCache;
      _normalizePiston(_piston);
      // Re-sync WizardCore vars in case the editor stays open (e.g. save with warnings).
      if (typeof WizardCore !== 'undefined') {
        WizardCore.setPistonVars(_piston.variables);
        WizardCore.setGlobalsData(_piston._globalsCache || []);
      }
      _isNew = false;
      _markUnsaved(false);

      // Reconcile used_by on globals after a successful save — fire and forget.
      _reconcileGlobalUsedBy(_piston).catch(() => {});

      App.navigate('status');
      return true;

    } catch(e) {
      _showNotice(`Save failed — your work is preserved. ${e.message}`, 'error');
      return false;

    } finally {
      if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
    }
  }

  // ── Variable re-resolution ────────────────────────────────────────────────
  // After a device variable is saved, re-resolve entity_ids on every node
  // whose role_tokens references that variable name.
  function _reResolveVariableUses(varName, newEntityIds) {
    if (!varName || !_piston || typeof WizardCore === 'undefined' || !WizardCore._getFlatEntityIds) return;

    function patchNode(node) {
      if (!node || typeof node !== 'object') return;
      if (!(node.role_tokens || []).includes(varName)) return;
      if (!WizardCore.deviceData) return;
      node.entity_ids = WizardCore._getFlatEntityIds(node.role_tokens);
    }

    function walkStatements(nodes) {
      (nodes || []).forEach(node => {
        if (!node) return;
        if (node.type === 'action') patchNode(node);
        patchConditions(node.conditions       || []);
        patchConditions(node.until_conditions || []);
        (node.else_ifs || []).forEach(eib => {
          patchConditions(eib.conditions || []);
          walkStatements(eib.statements  || []);
        });
        walkStatements(node.then       || []);
        walkStatements(node.else       || []);
        walkStatements(node.statements || []);
        walkStatements(node.default    || []);
        (node.cases || []).forEach(c => walkStatements(c.statements || []));
      });
    }

    function patchConditions(conditions) {
      (conditions || []).forEach(c => patchNode(c));
    }

    walkStatements(_piston.statements    || []);
    patchConditions(_piston.triggers     || []);
    patchConditions(_piston.conditions   || []);
    patchConditions(_piston.restrictions || []);
  }

  // ── Global used_by reconciliation ─────────────────────────────────────────
  // Called after every successful piston save. Walks the saved piston to find
  // every @GlobalName reference in role_tokens, then ensures each referenced
  // global lists this piston in its used_by — and removes this piston from any
  // global it no longer references. Never blocks the save; errors are swallowed.
  async function _reconcileGlobalUsedBy(piston) {
    if (!piston || !piston.id) return;

    // Collect every @GlobalName token referenced anywhere in this piston
    const referenced = new Set();

    function scanTokens(tokens) {
      (tokens || []).forEach(t => {
        if (typeof t === 'string' && t.startsWith('@')) referenced.add(t.slice(1));
      });
    }

    function scanConditions(conditions) {
      (conditions || []).forEach(c => scanTokens(c.role_tokens));
    }

    function scanStatements(nodes) {
      (nodes || []).forEach(node => {
        if (!node || typeof node !== 'object') return;
        scanTokens(node.role_tokens);
        scanConditions(node.conditions       || []);
        scanConditions(node.until_conditions || []);
        (node.else_ifs || []).forEach(ei => {
          scanConditions(ei.conditions || []);
          scanStatements(ei.statements || []);
        });
        scanStatements(node.then       || []);
        scanStatements(node.else       || []);
        scanStatements(node.statements || []);
        scanStatements(node.default    || []);
        (node.cases || []).forEach(c => scanStatements(c.statements || []));
      });
    }

    scanConditions(piston.triggers     || []);
    scanConditions(piston.conditions   || []);
    scanConditions(piston.restrictions || []);
    scanStatements(piston.statements   || []);

    // Load current globals from API to get fresh used_by arrays
    let globals = [];
    try {
      const raw = await API.getGlobals();
      globals = Object.values(raw || {});
    } catch { return; }

    const pistonEntry = { uuid: piston.id, name: piston.name || 'Unnamed' };

    // For each global: add or remove this piston from used_by as needed
    const updates = globals.filter(g => {
      const isReferenced   = referenced.has(g.name);
      const usedBy         = Array.isArray(g.used_by) ? g.used_by : [];
      const alreadyListed  = usedBy.some(e => e.uuid === piston.id);
      return isReferenced !== alreadyListed; // only update if something changed
    });

    for (const g of updates) {
      const usedBy = Array.isArray(g.used_by) ? [...g.used_by] : [];
      if (referenced.has(g.name)) {
        usedBy.push(pistonEntry);
      } else {
        const idx = usedBy.findIndex(e => e.uuid === piston.id);
        if (idx >= 0) usedBy.splice(idx, 1);
      }
      try {
        await API.updateGlobal(g.id, { used_by: usedBy });
      } catch { /* best-effort */ }
    }
  }

  // ── Wizard dispatch — routes Wizard.open(ctx, node, extra) to the right module ──
  //
  // The editor renders "+" ghost links and clickable statement rows that all call
  // Wizard.open(). This object is the single routing table that maps each context
  // string to the correct WizardXxx module function.
  //
  // Ghost clicks (node=null) → openAdd functions
  // Statement clicks (node=object) → openEdit functions
  // 'action' ghost ctx = "add new statement" (not specifically an action type)
  const Wizard = {
    open(ctx, node, extra = {}) {
      const blockId = extra['block-id']  || null;
      const branch  = extra['branch']    || null;
      const taskId  = extra['task-id']   || null;

      if (!node) {
        // ── Add mode — ghost "+" link clicked ───────────────────────────────
        switch (ctx) {
          case 'variable':
            if (typeof WizardVariable !== 'undefined')
              WizardVariable.openAdd('variable');
            break;

          case 'trigger':
            _piston.triggers = _piston.triggers || [];
            if (typeof WizardCondition !== 'undefined')
              WizardCondition.openAdd(_piston.triggers, 'trigger', 'trigger');
            break;

          case 'condition':
            _piston.conditions = _piston.conditions || [];
            if (typeof WizardCondition !== 'undefined')
              WizardCondition.openAdd(_piston.conditions, 'condition', 'condition');
            break;

          case 'restriction':
            _piston.restrictions = _piston.restrictions || [];
            if (typeof WizardCondition !== 'undefined')
              WizardCondition.openAdd(_piston.restrictions, 'restriction', 'restriction');
            break;

          case 'action': {
            // 'action' ghost = "add a new statement" in a branch or top-level
            // Pass {type, blockId, branch} so the wizard can relay blockId/branch
            // into insertStatement's meta parameter for correct tree placement.
            const insertCtx = { type: 'action', blockId, branch };
            if (typeof WizardStatement !== 'undefined')
              WizardStatement.openAdd(insertCtx);
            break;
          }

          case 'task': {
            const actionNode = blockId ? _findAnyNode(blockId) : null;
            if (actionNode && typeof WizardAction !== 'undefined')
              WizardAction.openAddTask(actionNode, 'task');
            break;
          }

          case 'if_condition': {
            const block = blockId ? (_findNode(blockId) || _findElseIf(blockId)) : null;
            if (block) {
              block.conditions = block.conditions || [];
              if (typeof WizardCondition !== 'undefined')
                WizardCondition.openAdd(block.conditions, 'if_condition', 'condition');
            }
            break;
          }
        }
        return;
      }

      // ── Edit mode — existing node clicked ─────────────────────────────────
      switch (ctx) {
        case 'trigger':
          _piston.triggers = _piston.triggers || [];
          if (typeof WizardCondition !== 'undefined')
            WizardCondition.openEdit(node, _piston.triggers, 'trigger', 'trigger');
          break;

        case 'condition':
        case 'edit_condition':
          _piston.conditions = _piston.conditions || [];
          if (typeof WizardCondition !== 'undefined')
            WizardCondition.openEdit(node, _piston.conditions, 'condition', 'condition');
          break;

        case 'edit_restriction':
          _piston.restrictions = _piston.restrictions || [];
          if (typeof WizardCondition !== 'undefined')
            WizardCondition.openEdit(node, _piston.restrictions, 'restriction', 'restriction');
          break;

        case 'if_condition': {
          const block      = blockId ? (_findNode(blockId) || _findElseIf(blockId)) : null;
          const conditions = block ? (block.conditions || (block.conditions = [])) : (_piston.conditions || []);
          if (typeof WizardCondition !== 'undefined')
            WizardCondition.openEdit(node, conditions, 'if_condition', 'condition');
          break;
        }

        case 'variable':
          if (typeof WizardVariable !== 'undefined')
            WizardVariable.openEdit(node, 'variable');
          break;

        case 'task': {
          // node = action owner; taskId picks the specific task to edit
          const taskNode = taskId ? (node.tasks || []).find(t => t.id === taskId) : null;
          if (taskNode && typeof WizardAction !== 'undefined')
            WizardAction.openEditTask(taskNode, node, 'task');
          break;
        }

        case 'action':
          // Clicking the ACTION statement header — edit which device it targets
          if (typeof WizardStatement !== 'undefined')
            WizardStatement.openEdit(node, 'action');
          break;

        case 'condition_operator':
          // Handled inline by the editor — no wizard popup
          break;

        default:
          // All other statement types: if, for, while, repeat, every, switch, etc.
          if (typeof WizardStatement !== 'undefined')
            WizardStatement.openEdit(node, ctx);
          break;
      }
    }
  };

  // Resolve which array and parent block a "add new statement" ghost targets.
  function _resolveStatementParent(branch, blockId) {
    if (!blockId) {
      return { array: (_piston.statements = _piston.statements || []), blockId: null, branch: null };
    }
    if (branch === 'else_if_statements') {
      const eib = _findElseIf(blockId);
      if (eib) {
        eib.statements = eib.statements || [];
        return { array: eib.statements, blockId, branch };
      }
    }
    const block = _findAnyNode(blockId);
    if (!block) {
      return { array: (_piston.statements = _piston.statements || []), blockId: null, branch: null };
    }
    block[branch] = block[branch] || [];
    return { array: block[branch], blockId, branch };
  }

  // Called after insertStatement when meta.chain is set — auto-opens the next wizard.
  // §7.4: IF/WHILE/REPEAT/ON_EVENT/WAIT_FOR_STATE → chain:'condition'
  //        ACTION → chain:'task'
  function _chainToNextWizard(node, chainType, chainSubtype) {
    if (chainType === 'condition') {
      node.conditions = node.conditions || [];
      if (typeof WizardCondition !== 'undefined')
        WizardCondition.openAdd(node.conditions, 'if_condition', 'condition', chainSubtype);
    } else if (chainType === 'task') {
      if (typeof WizardAction !== 'undefined')
        WizardAction.openAddTask(node, 'task');
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    load,
    save,
    insertStatement,
    deleteStatement,
    getPistonVariables:  () => _piston?.variables     || [],
    getGlobalsCache:     () => _piston?._globalsCache || [],
    getDeviceMap:        () => _piston?.device_map    || {},
    // Called by wizard modules after they write directly to a node (edit path).
    // Marks the piston unsaved and re-renders the display.
    refreshDisplay(_context) {
      _markUnsaved(true);
      render();
    },

    updateConditionOperator(blockId, operator) {
      const block = _findNode(blockId) || _findElseIf(blockId);
      if (block) {
        block.condition_operator = operator;
        _markUnsaved(true);
        render();
      }
    },
  };

})();
