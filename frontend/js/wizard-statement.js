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
    close();
    Editor.insertStatement(ctx, node, meta);

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
    close();
    Editor.insertStatement(ctx, node, meta);

  } else if (type === 'on_event') {
    const node = { type:'on_event', id:_newId(), async:false, conditions:[], condition_operator:'and', statements:[], description:null, disabled:false };
    close();
    Editor.insertStatement(ctx, node, meta);

  } else if (type === 'for_loop') {
    WizardCore.sel = { for_start:1, for_end:10, for_step:1, for_counter:'' };
    _goForPicker();

  } else if (type === 'for_each') {
    WizardCore.sel = { variable:'$device', list_role:'' };
    _goForEachPicker();

  } else if (type === 'while_loop') {
    const node = { type:'while', id:_newId(), async:false, conditions:[], condition_operator:'and', statements:[], description:null, disabled:false };
    close();
    Editor.insertStatement(ctx, node, meta);

  } else if (type === 'repeat_loop') {
    const node = { type:'repeat', id:_newId(), async:false, statements:[], until_conditions:[], condition_operator:'and', description:null, disabled:false };
    close();
    Editor.insertStatement(ctx, node, meta);

  } else if (type === 'break') {
    const node = { type:'break', id:_newId(), description:null, disabled:false };
    close();
    Editor.insertStatement(ctx, node, meta);

  } else if (type === 'exit') {
    WizardCore.sel = {};
    _goExitPicker();
  }
}
