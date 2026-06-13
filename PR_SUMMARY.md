PR / Commit summary for `fix/GAP-S74-2-action-domain`

Title: Fix action node domain selection to match selected command (GAP-S74-2)

Summary (plain English):
- Problem: When saving an action node, the UI previously used the first resolved entity to pick the service domain. On devices with multiple domains, this could store an incorrect `domain` and unrelated `entity_ids` in the saved piston JSON.
- Fix: The action save now checks the selected command against the services available for each device and chooses the correct domain for that command. It writes `domain`, `ha_service`, and a filtered `entity_ids` (one per device) that belong to that domain.

What to test (non-technical):
1. Edit or create an action that targets a multi-domain device. Pick a command (e.g., `play_media`) and save.
2. Export the piston and confirm the action node's `domain` and `entity_ids` match the chosen command.

Files changed:
- `frontend/js/wizard-action.js` (core change: domain selection when saving actions)

Notes:
- This is a focused UI change. It does not change backend APIs or the server runtime.
- Deploy and verify using the Deploy & Verify checklist (CHECKLIST_DEPLOY_VERIFY.md).

Prepared by assistant — paste this into GitHub Desktop or the PR description.
