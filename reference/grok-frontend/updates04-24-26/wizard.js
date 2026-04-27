// pistoncore/frontend/js/wizard.js
// Critical fix: matches WebCoRE wizard flow from screenshots

const Wizard = (() => {

  // ... existing CAPABILITY_MAP, ACTION_TYPES, BINARY_LABELS, etc. ...

  function open({ context, parentId, branch, index, editNode, onDone }) {
    _callbacks = { onDone };
    _state = { context: context || 'action', step: 0, parentId, branch, index: index ?? 0, editNode: editNode || null, selections: {}, sentence: '' };

    _showModal();

    if (context === 'action') {
      _renderActionTypeStep();                    // Screenshot 28 — full statement picker
    } else if (context === 'condition' || context === 'trigger') {
      _renderConditionOrGroupStep();              // Screenshot 17 — FIRST step
    }
  }

  // ── Condition Flow (now properly ordered) ─────────────────────────────
  function _renderConditionOrGroupStep() {
    _state.step = 0;
    _showBack(false);
    _showDone(false);

    _setBody(`
      <div class="wizard-step-title">What would you like to add?</div>
      <div class="wizard-card-grid">
        <div class="wizard-card" id="card-condition">
          <div class="wizard-card-title">Condition</div>
          <div class="wizard-card-desc">A single comparison...</div>
        </div>
        <div class="wizard-card" id="card-group">...</div>
      </div>
    `);

    // Wire clicks...
    document.getElementById('card-condition')?.addEventListener('click', () => {
      _state.selections.statement_class = 'condition';
      _renderWhatToCompareStep();   // → Screenshot 18/19
    });
  }

  function _renderWhatToCompareStep() {
    _state.step = 1;
    _showBack(true);
    _setBody(`<div class="wizard-step-title">What do you want to compare?</div>`);
    // Device/variable picker (Physical + Local + Global + System vars)
    _renderDevicePicker('compare');   // reuse/enhance existing picker
  }

  // Then chain:
  // _renderAttributeListStep()          → Screenshot 20
  // _renderInteractionStep()            → Screenshot 21 (CRITICAL missing piece)
  // _renderOperatorStep()               → Screenshot 22
  // _renderValueOrDurationStep()        → Screenshots 23-25
  // Final "Add more" option            → Screenshot 26

  function _renderInteractionStep() {
    _state.step = 3;
    _setBody(`
      <div class="wizard-step-title">Which interaction?</div>
      <div class="wizard-options-grid">
        <div class="wizard-card" data-interaction="any">Any</div>
        <div class="wizard-card" data-interaction="physical">Physical</div>
        <div class="wizard-card" data-interaction="programmatic">Programmatic</div>
      </div>
    `);
    // Wire clicks → proceed to operator
  }

  // ... keep your existing _renderActionTypeStep, device picker, etc. ...

  return { open, close /* + other exports */ };
})();