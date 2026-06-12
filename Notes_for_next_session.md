Yes — some prior projects have relevant code, but limited for your specific needs. Here's a focused breakdown:
Most Relevant Projects & Code Value

Shortumation (asosnovsky/Shortumation) — The closest prior attempt.
Relevance: It was a visual automation UI for HA with some block-style elements inspired by Node-RED. The repo has frontend code for visualization, automation management, and HA integration.
What you can learn: How it handled device/service discovery, YAML generation, and add-on packaging. Look at its visualization and editing components.
Limitations: Abandoned, node/flow-oriented rather than true WebCoRE piston style (no deep nested with/do tasks, no structured JSON wizard model like yours). Not a direct template for your editor architecture. Useful for add-on/Docker patterns and HA client integration, but not for the core editor logic you're building.

Home Assistant Editor (saihgupr/HomeAssistantEditor) — Currently the most active visual tool.
Relevance: Three-column visual workspace for automations/scripts, version history, cleaner UI than core HA. JavaScript frontend.
What you can learn: UI layout patterns, version control integration, how it parses/edits large HA YAML structures, and add-on setup. Good reference for HA entity/service handling and rendering complex automations.
Limitations: It's an enhanced view on HA's native automation model (not a WebCoRE-style piston builder with wizards, tasks inside with blocks, role-based sharing, etc.). Less relevant for your structured JSON + pure-projection + wizard-driven approach.


Overall:

Some utility for HA integration patterns, device pickers, add-on structure, and YAML output — but none replicate your core architecture (structured piston JSON, wizard-only mutations, pure rendering from nested tree, with-block task framework, role_tokens/entity_ids discipline).
You won't find a drop-in solution for the tricky parts you're solving (multi-task interleaving, edit-by-id hydration, etc.). Your approach is genuinely more ambitious and closer to true WebCoRE fidelity than what existed before. That's why it feels harder.


Yes — pulling relevant code from these projects for Claude to analyze is a smart acceleration move. Here's a targeted summary you can feed directly into your next Claude session, including why I suggest them and specific use cases for PistonCore's backend/integration.
1. Shortumation (asosnovsky/Shortumation) — Most Relevant for Add-on / Backend Patterns
Repo: https://github.com/asosnovsky/Shortumation
Status: Not maintained / deprecated, but the code is still public and readable.
Why relevant for your backend:

It was a full Home Assistant add-on for visual automation management.
Strong focus on HA integration, device/service discovery, visualization of automations, and YAML handling.
Good reference for add-on architecture, Docker setup, and how to interact with HA's API / states / services from a custom tool.

Specific things to pull / study:

Add-on structure (config.yaml, Dockerfile, backend services) — Excellent template for your own PistonCore addon (ingress support, supervisor API calls, volume mounting for pistons).
HA client / integration code — How it fetched devices, entities, services, and states. Look for any ha_client or API wrappers — this can speed up your backend device resolution and live data fetching.
Automation/YAML handling — Parsing, visualization, and generation logic (even if it's more Node-RED inspired).
Installation / packaging examples — Docker compose and add-on repo setup.

Use case for PistonCore: Backend HA communication layer, add-on packaging, and any file writing / reload patterns. Even though the visual style differs, the plumbing for talking to HA is worth mining.
2. HomeAssistantEditor (saihgupr/HomeAssistantEditor) — Best Current Reference
Repo: https://github.com/saihgupr/HomeAssistantEditor
Related: Paired with HomeAssistantVersionControl / TimeMachine by the same author.
Why relevant:

Modern, actively maintained (as of 2026) visual editor add-on for HA automations and scripts.
Focuses on clean UI for large/complex automations, version history, and direct editing of HA YAML.
Excellent real-world example of a production-grade HA add-on with deep integration.

Specific things to pull / study:

Add-on architecture and HA integration (how it talks to core, handles automations/scripts, version control).
Frontend-backend communication patterns (especially if it has a FastAPI / Python backend like yours).
Entity / service discovery and rendering logic for large configs.
Versioning / backup patterns (via the paired TimeMachine repo) — useful for your piston save/export/snapshots.
Docker / add-on packaging setup.

Use case for PistonCore: Current best-practices for HA add-on development, integration stability, and handling real-world HA automations at scale. Great for your backend (FastAPI endpoints, HA client, file I/O with signatures, reload validation).
Other Minor Mentions

Studio Code Server (hassio-addons/addon-vscode) — Not a visual builder, but the gold standard for how a robust HA add-on with web UI is built. Pull its structure for your addon packaging.
No other strong WebCoRE-style piston editors exist with open code.

How to Use This with Claude
Feed Claude something like:
"Analyze these two repos for PistonCore backend / integration code:
https://github.com/asosnovsky/Shortumation — focus on add-on structure, HA API client, automation handling.
https://github.com/saihgupr/HomeAssistantEditor — focus on modern add-on patterns, entity/service integration, versioning.
Extract relevant patterns for: HA device/service discovery, file writing with safety (signatures), reload mechanisms, FastAPI-style backend structure, and add-on packaging. Highlight what can accelerate the PistonCore backend while preserving our structured JSON + independence philosophy."

This should give you concrete code snippets, architecture ideas, and integration patterns that speed up your work without derailing your core vision.
Your plan (finish your own pistons end-to-end + templates for compiler maintenance) remains solid. These repos are helpful for the "plumbing" (backend + addon) rather than the editor core you're wrestling with now.
If you want me to refine the prompt for Claude further or review any specific files from those repos (I can open them if needed), just let me know. Keep grinding on the with-block tasks — that's still the highest-

new sectoin
Catalogued eighteen structural inconsistencies, staleness issues, and contradictions across specifications
Catalogued eighteen structural inconsistencies, staleness issues, and contradictions across specifications
Read all 18 files. Overall the Session 73 docs (framework, holding doc, action spec ledgers, HA_LIMITATIONS §10) are in good shape — the problems are mostly contradiction clusters between files that were updated and files that weren't, plus two structural landmines in the authoritative format docs. Here's what I found, roughly by severity.

Structural problems
1. SAMPLE_PISTONS.md is in the retired format but still labeled "Authoritative — Required reference for compiler smoke testing." All three sample pistons use the old model: triggers as is_trigger: true conditions nested inside if blocks, no top-level triggers/conditions/restrictions arrays, and no role_tokens (a required field per PISTON_FORMAT's Field Lifecycle Rules). They carry logic_version: 2, so the backend would accept them — and then the compiler, which "reads _piston.triggers directly and does NOT walk statements for is_trigger nodes," would produce an automation with zero triggers. This is worse than obviously-broken: it's a valid-looking file that compiles to nothing. And S3-1's success checklist item 1 says the smoke test verifies against "the first piston in SAMPLE_PISTONS.md." Your smoke-test target is currently a piston that can't pass your own model. It needs either a FROZEN/STALE notice like the compiler specs got, or regeneration against PISTON_FORMAT v2.4 (probably at D-S6 alongside the compiler rewrite).

2. PISTON_FORMAT.md's own "Complete Minimal Example" contradicts its own Trigger/Condition/Restriction Storage section. The example near the bottom omits the top-level triggers/conditions/restrictions arrays (which the Wrapper Field Reference marks Required) and puts the sunset trigger inside statements[0].conditions with is_trigger: true — the exact pattern the doc explicitly says the compiler ignores. This is in the single-source-of-truth document, the one place an example absolutely must match the rules above it. A future session diffing against this example would faithfully reproduce the retired model.

3. S3-1 checklist item 5 references the frozen compiler spec as ground truth. "Test Compile output matches hand-verified YAML in COMPILER_SPEC.md" — but COMPILER_SPEC is FROZEN/STALE by your own decision, and its examples were written against the moving format. The success criterion points at an artifact the project says not to trust. Reword to something like "matches YAML hand-verified at D-S6," or S3-1 will pass/fail against stale output.

Contradiction clusters (same fact, different answers in different files)
4. Command classification: PENDING vs COMPLETE — five files disagree.

Says COMPLETE: HA_LIMITATIONS §10.4, TASKS.md D-S5c ("§10 status: research is COMPLETE — no open items"), framework §6 item 6, COMPILER_DECISIONS_HOLDING §D.
Says PENDING: CLAUDE_SESSION_PROMPT.md (twice — line 528 and the spec-versions block), TASKS.md's own spec-versions block at line 452 ("command classification still PENDING"), framework §4 heading ("classification PENDING"), §5.4 blockquote, §7, and §8.
TASKS.md contradicts itself internally, and WITH_BLOCK_TASK_FRAMEWORK.md was patched mid-document (§4 body and §6 got the COMPLETE update; the §4 heading, §5.4 note, §7, and §8 summary didn't). The truth is COMPLETE-for-non-device-commands per §10; one sweep should align all of them, leaving only target-boundary.json verification as genuinely open.

5. Session 73 review status: CLAUDE_SESSION_PROMPT says the outputs "want a review pass before being treated as authoritative" (two places); TASKS.md says "Review COMPLETE... safe to treat as reference." The session prompt — the first file every session reads — wasn't updated after the review happened. Next session will burn time re-reviewing or distrusting reconciled specs.

6. D-S5c lists Finding 7 and Pattern B as "not yet applied," but DESIGN.md v1.8's header says both were done in Session 69c ("Finding 7 — four 'do not re-open' markers given reopen criteria; Pattern B — authoritative preamble added to Section 6, 6.2/6.3 confirmed as pointers"). One of these is wrong. If the DESIGN header is accurate, those two D-S5c items are already closed and should move to history.

Stale-but-authoritative docs
7. FRONTEND_SPEC.md v1.5 has drifted and carries no staleness notice.

It still shows the compile-target badge in the editor layout ("Compile target: [Native HA Script] ← updates live") — PROGRESS_TRACKER discrepancy #1 says that was removed and replaced with the PyScript warning bar.
Its editor layout has no RESTRICTIONS section (TRIGGERS → CONDITIONS → ACTIONS only; "restriction" appears once in the whole file, as ghost text). Meanwhile PISTON_FORMAT explicitly cites "the editor's TRIGGERS / CONDITIONS / RESTRICTIONS section layout (FRONTEND_SPEC.md)" — a dangling cross-reference to a layout FRONTEND_SPEC doesn't contain.
It predates the entire Session 73 task model (task-owner threading, per-task click targets, virtual tasks in device blocks) with no pointer to WITH_BLOCK_TASK_FRAMEWORK.md.
The Deploy-button placement should be re-checked against discrepancy #2.
It doesn't need a rewrite now, but it needs either a header note ("task rendering and editor sections: see WITH_BLOCK_TASK_FRAMEWORK.md / current code") or the same intentionally-stale treatment, because right now it says "Authoritative" and isn't.

8. PROGRESS_TRACKER.md is a Session-12 fossil that actively contradicts the present. It says the wizard is "❌ Not started — wrong pattern, needs full rewrite," lists a visual checklist keyed to screenshots, and was last touched 60+ sessions ago. If it's in the upload set, a session could read it as current state. Either retire it to /reference, delete it, or repurpose the one part that still has value (the deploy-time visual checklist) into a current doc. Everything else it tracks is now tracked better by TASKS.md.

9. COMPILER_SPEC_STALE_NOTICE.md is done and now redundant. I verified the notice block is pasted at the top of both compiler specs. The instruction file ("PASTE THIS BLOCK...") can be deleted — leaving it around invites a future session to paste it again or wonder if it was applied. Small nit inside it: it points to PISTON_FORMAT's "Data Preservation Invariant," a section name that doesn't exist (it's the Load-Bearing Rule / Field Lifecycle Rules).

Format drift seeds (the exact bug class that's bitten you before)
10. duration_unit vocabulary is inconsistent — including within one section. STATEMENT_TYPES §14 declares the allowed values as "ms"/"s"/"m"/"h"/"d"/"w", then its own JSON example four lines above uses "minutes". The condition schema uses "seconds"/"minutes"/"hours". PISTON_FORMAT's virtual-task example and the W-S17 wait JSON use "minutes". This is precisely the wizard-writes-X / compiler-expects-Y mismatch class (like the trigger-operator-format gap already on your backend list). Worth pinning one canonical unit vocab in PISTON_FORMAT before D-S6 reads any of these.

11. Stale version pointers in living docs. WIZARD_SPEC v2.7's header still cites "PISTON_FORMAT.md v2.2, STATEMENT_TYPES.md v2.2" (current: 2.4/2.3). TASKS B-1 cites "PISTON_FORMAT.md v2.3, STATEMENT_TYPES.md v2.2." CLAUDE_SESSION_PROMPT cites "WIZARD_SPEC.md v2.4 guardrail section... lines 200-272" — version-pinned and line-number-pinned references rot every time the file is edited; section-name anchors would be safer.

Smaller items
12. Framework §6 item 6 has a garbled editing artifact: "classify the full command classify each by the reproduce-cleanly test" — duplicated words mid-sentence.

13. STATEMENT_TYPES has two sections numbered 15 ("15. wait (until time)" and "15b. wait_for_state") — cosmetic, but it makes "§15" ambiguous as a reference.

14. TASKS.md line 104 has a broken bold marker ("- ** SPEAK_ACTION_SPEC.md holds...") — renders wrong in markdown.

15. target-boundary.json is correctly flagged UNVERIFIED in the framework, holding doc, and HA_LIMITATIONS §1 — but STATEMENT_TYPES §10's compiler-output section still states it as flat fact ("Forces PyScript compilation via target-boundary.json"). It sits under the "compiler outputs not actively maintained" umbrella, so it's low-risk, but if you're sweeping anyway, a one-word "(UNVERIFIED)" there closes the last assertive reference.

16. One substantive question, not a defect: §10.2 cuts "Pause piston / Resume piston" as having no HA analog. But §10.1 maps "Execute piston" to automation.trigger / script.turn_on — meaning the compiled piston is an addressable HA entity. automation.turn_off / turn_on against that entity arguably reproduces pause/resume cleanly by your own reproduce-the-result test (it stops the piston from firing, reversibly). The semantics aren't identical to WebCoRE's mid-run pause, so maybe the cut stands — but it's worth a deliberate look rather than letting it ride as HIGH-confidence, since it's the only §10.2 entry where HA plausibly has the lever.

The fastest cleanup path: one short housekeeping spec session that (a) sweeps the PENDING→COMPLETE and review-status contradictions across CLAUDE_SESSION_PROMPT / TASKS / framework, (b) slaps stale notices on SAMPLE_PISTONS and FRONTEND_SPEC, (c) fixes or removes PISTON_FORMAT's minimal example, and (d) retires PROGRESS_TRACKER and the stale-notice file. Items 1–3 are the ones I'd not let reach D-S6 unfixed, since that session will read those exact artifacts as reference. Per your rules I haven't written anything — want me to draft the corrected text blocks for any of these?


app.js
js


editor.js
js


globals.js
js


list.js
js


status.js
js


wizard-action.js
js


wizard-condition.js
js


wizard-core.js
js


wizard-loops.js
js


wizard-variable.js
js


api.js
172 lines

js


wizard-statement.js
228 lines

js

im having problems with assumptions ending up in specs and not catching them because i do not code.  it was worth the tokens to use you during the free period to go over this verry large context.  there might be more files i did not send.   here is my code for the front end. a lot is working but might not be in the specs correctly

12:05 PM

Excavated specification-code misalignments across wizard architecture and data models
Excavated specification-code misalignments across wizard architecture and data models
Read all 12 files end to end and traced the spec claims against them. The good news first, briefly: the Session 73 fix is real and coherent in the code (task-owner attr → task-id threading in _route → append/replace-by-id in _saveDeviceCmd, Add-more re-targets the same block), the _globalsCache strip/restore is in save(), the sel.tokens all-entity-ids guardrail and union-then-intersect (including per-field intersection) are implemented exactly as specced, and the operator lists / LOCATION_COMMANDS / statement-type cards match the framework's §5 vocabularies verbatim. Those VERIFIED claims hold.

Now the problems, biggest first.

A. The top-level triggers/conditions/restrictions seam is broken — the spec's "confirmed against editor.js" claim is half true
The spec model (PISTON_FORMAT, DESIGN 10.3, "Researched" in CLAUDE_SESSION_PROMPT) says triggers/conditions/restrictions live in top-level wrapper arrays and the compiler reads _piston.triggers directly. The editor renders those arrays (editor.js 264–287) and insertStatement has routing for them (1179–1187). But the wizard never drives that routing:

The "only when" ghost passes context 'trigger_or_condition' with no block-id (line 286); the restrictions ghost passes 'restriction' (line 268).
_commitCondition (wizard-condition.js 769–792) only handles if_condition and trigger_or_condition+blockId. Everything else falls into the else branch, which wraps the condition in a brand-new if node and inserts it as a statement. That if-node has no is_trigger and its context matches no array branch, so it lands in _piston.statements. Adding a trigger from the top-level section therefore creates an if-block in the action tree, puts nothing in _piston.triggers, and the new trigger doesn't even appear in the "only when" section it was added from.
insertStatement has no 'restriction' branch at all — nothing in the codebase ever writes _piston.restrictions.
Editing a top-level trigger/condition is worse: _openWizardForEdit opens context 'edit_condition', and _commitCondition's else branch wraps the edited condition in a new if-block with a freshly generated id — so the edit appears as a duplicate if-block in statements while the original trigger sits unchanged in the array. This is very plausibly the real face of GAP-S69-2 ("editing certain nodes fails to update").
Net effect: the compiler model can't compile any wizard-built piston's triggers, because the wizard cannot put anything into the array the compiler reads. The "confirmed against editor.js" research checked that the storage routing exists, not that the wizard ever reaches it. This deserves its own HIGH gap, probably blocking S3-1 ahead of everything except GAP-S73-2.

B. Open gaps I can now answer from the code
GAP-S71-3 (import role-map dialog never fires) — root cause found. list.js's entire import step 2 still runs on device_map: it detects unmapped roles from saved.device_map (line 325), which the Session 71 backend no longer returns, so unmapped is always empty and the dialog can never fire. And if it did fire, the Continue handler writes device_map back onto the piston via savePiston (396–404) — re-introducing the retired field. The whole flow needs rebuilding against role/role_tokens/empty-entity_ids per DESIGN 6.11.

GAP-S73-1 (can't remove a missing global device) — hypothesis confirmed, with line numbers. In globals.js, rows are rendered only from live-resolved HA groups (_filteredDevices, 376–384), so a stored name with no live match has no row to click. And "Deselect All" (292–297) deletes only visible devices from the selection set — visible.forEach(d => selected.delete(d.friendly_name)) — so the unresolvable entry survives it. That's exactly the observed behavior. Bonus wrinkle: the legacy entity-id conversion (242–253) silently drops unresolvable entries from the selection while leaving them in the stored value, so old-format globals show a misleading count.

GAP-S71-2 (variable dialog shows "Dynamic") — one-line cause. wizard-variable.js VAR_TYPE_DISPLAY (20–28) has 'device' but no 'devices' entry, so a devices-typed variable fails to normalize and the select falls back to the first option. Related and bigger: the 'devices' plural type is a blind spot everywhere — both resolvers filter v.var_type === 'device' exactly (wizard-core 301, 361), as do the action, condition, and for_each pickers. A devices-typed variable resolves to nothing, which produces exactly the "No devices could be resolved" message — worth checking as a GAP-S73-2 contributor before the live-HA debug session. PISTON_FORMAT documents device/devices as both valid; the code only implements singular. Pick one and make spec and code agree.

GAP-S70-1 (_reResolveVariableUses verification) — answered: it will break the load-bearing rule. The function (editor.js 1352–1402) re-resolves via attribute-blind _getFlatEntityIds(tokens), writing the entire entity cluster back onto condition nodes whose entity_ids were carefully filtered to the attribute-bearing entity at commit. Edit a device variable once and every illuminance condition using it regresses to the pre-W-S11 state. The node's attribute field is sitting right there and is never consulted. Also: the documented newEntityIds parameter is never used in the body, and the trigger at insertStatement line 1196 only fires for var_type === 'device' (the plural blind spot again).

C. The spec claims W-S11 covers actions — the code says only conditions
CLAUDE_SESSION_PROMPT states "Code now obeys this rule for conditions/actions/for_each (W-S11 closed)." Conditions: true, via _capEntityMap. Actions: false. _saveDeviceCmd resolves _getFlatEntityIds(_sel.tokens) with no command/domain filter and writes ALL entity_ids to the node — the function's own comments contradict each other (line 748–749 claims "only ids whose domain can perform this service," lines 761–764 say "No domain filtering here," and the code does the latter). Worse, task.domain is derived from finalIds[0].split('.')[0] — whichever entity happens to come first — so a multi-entity device (Sonos = media_player + battery sensor) can produce domain: 'sensor' and ha_service: 'sensor.volume_set'. That's a real compile-time landmine, not just spec drift. The spec's claim should be corrected to conditions-only, and the action-side fix logged (filter to entities whose domain matches the chosen service, derive domain from the service intersection rather than from finalIds[0]).

D. Shapes the spec describes that the wizard never writes
Time conditions are a three-way disagreement. Spec: subject: "time", value_from/value_to, preset objects. Code commit (_buildConditionNode): role: 'time', no subject field at all, start time in display_value/compiled_value, end in value_to. And _route's edit branch (wizard-core 561–567) expects subject to be an object (subject.type, subject.entity_id) — a shape matching neither. Editing a spec-shaped time condition (your imported faithful alarm piston, the SAMPLE pistons) mis-hydrates as a device condition. Also the time-subject input wiz-subj-time is collected but never written to the node — vestigial.
Location-command action nodes violate PISTON_FORMAT's required fields. _saveLocationCmd produces devices: ['Location'] with no role, role_tokens, or entity_ids — three fields the Action Node table marks Required — and devices is documented nowhere except the framework (which describes it honestly). PISTON_FORMAT needs to document this shape or the virtual-task work replaces it.
list_role is alive and undocumented. for_each commit writes both role and list_role (wizard-loops 145–146); the editor render (390–393), status.js (201), and edit hydrate (wizard-core 684) all read list_role; wizard-statement seeds it. STATEMENT_TYPES §6 omits it entirely, and B-2/GAP-S69-7 treat it as retired v1. It isn't retired — decide: document it, or migrate render/hydrate to role and drop it.
wait duration_unit: code writes full words (milliseconds/seconds/minutes/hours); spec §14 declares ms/s/m/h/d/w. Code is also missing days/weeks. Pin the full-word vocabulary (it's what every builder uses) and fix §14.
only_on_days is internally inconsistent: the condition builder writes ISO 1–7 (wizard-condition 76 — matches spec), but the timer/every builder writes 0–6 Monday-first (wizard-loops 352, value="${i}"). A compiler will get two different encodings for the same concept.
log_message message is an operand object {type:'literal', data} in code; the framework/PISTON_FORMAT shorthand says {message, level} as if it's a string.
p.updated_at vs modified_at: editor.js 229 reads updated_at; the wrapper field is modified_at. The "Modified" comment line renders blank.
Small ones: task render reads undocumented task.service first (379); the define render reads initial_device_names first with a comment calling it the model (244–249) — backwards per PISTON_FORMAT, which says initial_value is the model and initial_device_names is never written.
E. v1 residue is a frontend problem too — B-2 should not be backend-only
Beyond list.js import: status.js Snapshot export is fully v1 — it anonymizes device_map (495–499) and strips nothing else, so "snapshots" today ship with role_tokens, entity_ids, and compiled_value intact, directly contradicting the Field Lifecycle table's "Stripped on Snapshot export" rows. Snapshots are currently just backups with a label. And there's a cluster of stale comments asserting the opposite of the load-bearing rule, which is dangerous given how you work (Claude reads comments as truth): api.js says global device value "is an array of entity ID strings" (twice) and references device_map on import; globals.js header says the same (lines 8–9, 233); wizard-variable.js header says "Device initial value stores array of entity_id strings"; wizard-action.js header says physical rows store primary_entity_id — contradicting a hard guardrail in its own file. I'd add a "B-2f: frontend v1-residue + stale-comment sweep" item covering list.js, status.js, api.js comments, globals.js header, wizard-action.js header, getDeviceMap, and the list_role decision.

Where this leaves the specs
The pattern across all of this: the specs' claims about what the code does are the assumption-leak point — "confirmed against editor.js," "W-S11 closed for actions," the Field Lifecycle "Stripped" column, the time-condition schema. The framework's VERIFIED-with-line-numbers discipline is the cure, and notably everything it marked VERIFIED checked out. The fix isn't rewriting specs wholesale; it's logging A–D as gaps (A and the action-domain bug in C are the HIGH ones — A blocks compilation of wizard-built pistons entirely, C produces wrong service calls) and downgrading the affected spec claims from "confirmed" to "render-side only" until the seams are wired.

Per your rules I haven't touched anything. Want me to draft the TASKS.md gap entries (suggested numbering GAP-S74-1 through -N, slotted into W-S15/W-S12/W-S14/B-2) and the spec correction list as text for your approval?