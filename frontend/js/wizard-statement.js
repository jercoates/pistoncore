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
    // Stay in wizard — open condition picker scoped to the new if block
    WizardCore.context   = 'trigger_or_condition';
    WizardCore.extra     = { 'block-id': node.id };
    WizardCore.editNode  = null;
    WizardCore.sel       = { statement_class: 'condition' };
    WizardCore.stepStack = [];
    _goConditionOrGroup();

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
      btnLabel:'Add a condition',
      node, ctx, meta,
      branch:  'conditions',
      nextContext: 'trigger_or_condition',
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
      warning: 'Make sure to add a condition to this loop — without one it will run forever.',
      btnLabel:'Add a condition',
      node, ctx, meta,
      branch:  'conditions',
      nextContext: 'trigger_or_condition',
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

function _goBlockConfirm({ title, desc, warning, btnLabel, node, ctx, meta, branch, nextContext }) {
  const { _esc, _render, _pushStep } = WizardCore;
  WizardCore.step = 'block_confirm';
  _pushStep(() => _goBlockConfirm({ title, desc, warning, btnLabel, node, ctx, meta, branch, nextContext }));

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
    WizardCore.context   = nextContext || 'statement';
    WizardCore.extra     = { 'block-id': node.id, 'branch': branch };
    WizardCore.editNode  = null;
    WizardCore.sel       = nextContext === 'trigger_or_condition' ? { statement_class: 'condition' } : {};
    WizardCore.stepStack = [];
    if (nextContext === 'trigger_or_condition') {
      _goConditionOrGroup();
    } else {
      _goStatementTypePicker();
    }
  });
}

// ── Edit if block screen ─────────────────────────────────────────────────────
// WebCoRE style: shows description, Condition/Group cards, and Delete button.
// Clicking Condition or Group scopes the wizard into the block to add to it.
// Clicking Delete removes the entire if block.

function _goIfBlockEdit() {
  const { _esc, _render, _pushStep, _deleteEditNode, close } = WizardCore;
  WizardCore.step = 'if_edit';
  _pushStep(_goIfBlockEdit);
  const node = WizardCore.editNode;

  _render('Edit if',
    `<div class="wiz-desc">An IF block is the simplest decisional block available. It allows you to execute different actions depending on conditions you set.</div>
     <div class="wiz-two-cards">
       <div class="wiz-card-option" id="wiz-if-add-cond">
         <div class="wiz-card-option-title" style="color:var(--teal)">Condition</div>
         <div class="wiz-card-option-desc">A condition is a single comparison between two or more operands, the basic building block of a decisional statement</div>
         <button class="btn btn-primary btn-sm wiz-card-btn">Add a condition</button>
       </div>
       <div class="wiz-card-option" id="wiz-if-add-group">
         <div class="wiz-card-option-title" style="color:var(--orange)">Group</div>
         <div class="wiz-card-option-desc">A group is a collection of conditions, with a logical operator between them, allowing for complex decisional statements</div>
         <button class="btn btn-orange btn-sm wiz-card-btn">Add a group</button>
       </div>
     </div>`,
    `<div class="wiz-footer-left">
       <button class="btn btn-ghost btn-sm" id="wiz-if-cancel">Cancel</button>
       <button class="btn btn-danger btn-sm" id="wiz-if-delete">Delete</button>
     </div>`
  );

  document.getElementById('wiz-if-cancel')?.addEventListener('click', close);
  document.getElementById('wiz-if-delete')?.addEventListener('click', _deleteEditNode);

  document.getElementById('wiz-if-add-cond')?.addEventListener('click', () => {
    WizardCore.context      = 'if_condition';
    WizardCore.extra        = { 'block-id': node.id };
    WizardCore.editNode     = null;
    WizardCore.sel          = { statement_class: 'condition' };
    WizardCore.stepStack    = [];
    _goConditionBuilder();
  });

  document.getElementById('wiz-if-add-group')?.addEventListener('click', () => {
    WizardCore.context      = 'if_condition';
    WizardCore.extra        = { 'block-id': node.id };
    WizardCore.editNode     = null;
    WizardCore.sel          = { statement_class: 'group' };
    WizardCore.stepStack    = [];
    _goGroupBuilder();
  });
}
