// pistoncore/frontend/js/wizard-statement.js
// Statement type picker — "Add a new statement" first screen.
// Depends on: wizard-core.js (WizardCore must be loaded first)
//
// Functions defined here are top-level (not inside an IIFE) so they are
// accessible from wizard-core.js's _route() function.

function _goStatementTypePicker() {
  const { _esc, _render, _pushStep, STATEMENT_TYPES } = WizardCore;
  WizardCore.step = 'stmt_type';
  _pushStep(_goStatementTypePicker);

  const cardSection = (types) => types.map(t => `
    <div class="wiz-stmt-card" data-stype="${_esc(t.type)}">
      <div class="wiz-stmt-name">${_esc(t.label)}</div>
      <div class="wiz-stmt-desc">${_esc(t.desc)}</div>
      <button class="btn ${_esc(t.cls)} btn-sm wiz-stmt-btn">${_esc(t.btn)}</button>
    </div>`).join('');

  _render(
    'Add a new statement',
    `<div class="wiz-stmt-section-label">Basic statements</div>
     <div class="wiz-stmt-cards">${cardSection(STATEMENT_TYPES.basic)}</div>
     <div class="wiz-stmt-section-label" style="margin-top:14px">Advanced statements</div>
     <div class="wiz-stmt-cards">${cardSection(STATEMENT_TYPES.advanced)}</div>`,
    `<button class="btn btn-ghost btn-sm" id="wiz-stmt-cancel">Cancel</button>`
  );

  document.getElementById('wiz-stmt-cancel')?.addEventListener('click', WizardCore.close);
  document.querySelectorAll('.wiz-stmt-card').forEach(card => {
    card.addEventListener('click', () => _handleStatementType(card.dataset.stype));
  });
}

function _handleStatementType(type) {
  const { _newId, _render, _pushStep, close } = WizardCore;
  const ctx      = WizardCore.context;
  const blockId  = WizardCore.extra?.['block-id'];
  const branch   = WizardCore.extra?.['branch'] || 'then';
  const meta     = blockId ? { blockId, branch } : undefined;

  if (type === 'if_block') {
    const id = _newId();
    const node = {
      type:'if', id, async:false,
      conditions:[], condition_operator:'and',
      then:[], else_ifs:[], else:[],
      description:null, disabled:false,
    };
    Editor.insertStatement(ctx, node, meta);
    if (blockId) {
      // Already scoped inside a block — stay in the wizard after inserting.
      // Scope into the new if block's then branch.
      WizardCore.context   = 'statement';
      WizardCore.extra     = { 'block-id': node.id, 'branch': 'then' };
      WizardCore.editNode  = null;
      WizardCore.sel       = {};
      WizardCore.stepStack = [];
      _goStatementTypePicker();
    } else {
      close();
    }

  } else if (type === 'action') {
    _goActionDevicePicker();

  } else if (type === 'timer') {
    WizardCore.sel = {};
    _goTimerPicker();

  } else if (type === 'switch') {
    WizardCore.sel = { switch_expression: null, switch_ctp: 'safe' };
    _goSwitchPicker();

  } else if (type === 'do_block') {
    const node = { type:'do', id:_newId(), async:false, statements:[], description:null, disabled:false };
    _goBlockConfirm({
      title:   'Add a do block',
      desc:    'A DO block groups several statements into a single block. Add statements inside it after inserting.',
      warning: null,
      btnLabel:'Add a statement',
      node, ctx, meta,
      branch:  'statements',
    });

  } else if (type === 'on_event') {
    const node = { type:'on_event', id:_newId(), async:false, conditions:[], condition_operator:'and', statements:[], description:null, disabled:false };
    _goBlockConfirm({
      title:   'Add an on event block',
      desc:    'An ON EVENT block executes its statements only when certain events happen.',
      warning: null,
      btnLabel:'Add a statement',
      node, ctx, meta,
      branch:  'statements',
    });

  } else if (type === 'for_loop') {
    WizardCore.sel = { for_start:1, for_end:10, for_step:1, for_counter:'' };
    _goForPicker();

  } else if (type === 'for_each') {
    WizardCore.sel = { variable:'$device', list_role:'' };
    _goForEachPicker();

  } else if (type === 'while_loop') {
    const node = { type:'while', id:_newId(), async:false, conditions:[], condition_operator:'and', statements:[], description:null, disabled:false };
    _goBlockConfirm({
      title:   'Add a while loop',
      desc:    'A WHILE loop executes its statements while a condition is true.',
      warning: 'Make sure to add an until condition to this loop — without one it will run forever.',
      btnLabel:'Add a statement',
      node, ctx, meta,
      branch:  'statements',
    });

  } else if (type === 'repeat_loop') {
    const node = { type:'repeat', id:_newId(), async:false, statements:[], until_conditions:[], condition_operator:'and', description:null, disabled:false };
    _goBlockConfirm({
      title:   'Add a repeat loop',
      desc:    'A REPEAT loop executes its statements, then checks a condition and repeats if that condition is true.',
      warning: 'Make sure to add an until condition to this loop — without one it will run forever.',
      btnLabel:'Add a statement',
      node, ctx, meta,
      branch:  'statements',
    });

  } else if (type === 'break') {
    const node = { type:'break', id:_newId(), description:null, disabled:false };
    close();
    Editor.insertStatement(ctx, node, meta);

  } else if (type === 'exit') {
    WizardCore.sel = {};
    _goExitPicker();
  }
}

// ── Block confirm screen ──────────────────────────────────────────────────────
// Shared by do_block, on_event, while_loop, repeat_loop.
// Shows description + optional warning, then inserts the node and transitions
// the wizard directly into the new block's statement list — no close/reopen.

function _goBlockConfirm({ title, desc, warning, btnLabel, node, ctx, meta, branch }) {
  const { _esc, _render, _pushStep } = WizardCore;
  WizardCore.step = 'block_confirm';
  _pushStep(() => _goBlockConfirm({ title, desc, warning, btnLabel, node, ctx, meta, branch }));

  const warningHtml = warning
    ? `<div class="wiz-block-warning">⚠ ${_esc(warning)}</div>`
    : '';

  _render(title,
    `<div class="wiz-desc">${_esc(desc)}</div>
     ${warningHtml}`,
    `<button class="btn btn-ghost btn-sm" id="wiz-bc-back">← Back</button>
     <div class="wiz-footer-right">
       <button class="btn btn-primary btn-sm" id="wiz-bc-add">${_esc(btnLabel)}</button>
     </div>`
  );

  document.getElementById('wiz-bc-back')?.addEventListener('click', _goStatementTypePicker);
  document.getElementById('wiz-bc-add')?.addEventListener('click', () => {
    // Insert the block node into the piston
    Editor.insertStatement(ctx, node, meta);
    // Scope the wizard into the new block without closing — no flicker, no dump-out
    WizardCore.context   = 'statement';
    WizardCore.extra     = { 'block-id': node.id, 'branch': branch };
    WizardCore.editNode  = null;
    WizardCore.sel       = {};
    WizardCore.stepStack = [];
    _goStatementTypePicker();
  });
}
