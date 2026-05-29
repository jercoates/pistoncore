# PistonCore — Spec Audit: Rigidity & Pivot Risk

**Date:** May 29, 2026
**Reviewer:** Claude (Opus 4.7), at Jeremy's request
**Scope:** All 11 spec files uploaded — CLAUDE_SESSION_PROMPT.md, COMPILER_SPEC.md, DESIGN.md, FRONTEND_SPEC.md, HA_LIMITATIONS.md, PISTON_FORMAT.md, PYSCRIPT_COMPILER_SPEC.md, STATEMENT_TYPES.md, TASKS.md, TEST_STRATEGY.md, WIZARD_SPEC.md
**Goal:** Find rigid "it is this way" specs that could prevent course-correction when something fails in real testing — not to question Jeremy's design decisions.

---

## How to read this audit

Every finding falls into one of these categories:

- **HARD** — A claim or rule that, if it turns out to be wrong in real HA, will cascade into multiple specs and force a painful rewrite. These need either rationale Claude can fall back on, or an explicit "if this fails, here's the fallback" path.
- **SUBTLE** — A coupling or assumption that isn't called out as a decision, so a future Claude won't know to question it. These tend to show up as silent bugs.
- **STYLE** — Rigid phrasing where the underlying decision is fine, but the words box you in. Soften the language.
- **CONTRADICTION** — Two specs (or two parts of the same spec) that say different things. Pick one.
- **MISSING ESCAPE** — A "must / never / always" rule with no documented fallback if the rule turns out to be impossible to follow in some case.

Findings are sorted by blast radius, not by file. Most-coupled risks first.

---

## Top 10 highest-risk rigid specs

### 1. HARD — "The editor must render from JSON correctly 100% of the time, every time, without fail."

**Where:** PISTON_FORMAT.md line 162, DESIGN.md section 6.1 line 257, STATEMENT_TYPES.md line 30, FRONTEND_SPEC.md (implied by AST/Pure Projection invariant), WIZARD_SPEC.md line 46.

**The risk:** This is the single most-repeated rule in the spec set, and it's stated as an absolute. The actual operational rule you need is *"the editor never silently drops, duplicates, or corrupts user data."* Those are different things.

A 100% render success rate, taken literally, makes the editor responsible for rendering every possible future statement type, every possible malformed import, every possible bug-state JSON — without any failure mode allowed. The corrupt-piston handling in FRONTEND_SPEC.md (line 917: `⚠ Unknown statement [stmt_id] — edit to repair`) *already contradicts* the 100% rule. The placeholder row is a render failure mode — and a correct one.

**What to do:** Reword to something like:

> "The editor must render every well-formed piston JSON correctly. For malformed nodes (missing required fields, unknown type, future logic_version), render a clearly-flagged placeholder row that preserves the node in the JSON and lets the user repair or delete it. The editor must never silently drop, duplicate, or corrupt nodes."

The current phrasing makes Claude (or you) afraid to ship reasonable failure handling because "100%" is the rule.

---

### 2. HARD — "Never resolve tokens inline anywhere else" / "single resolution path" rules

**Where:** CLAUDE_SESSION_PROMPT.md lines 52, 182-183, 196, 197; WIZARD_SPEC.md lines 405-408, 270-272.

**The risk:** Right now `_getFlatEntityIds` and `_getGroupedEntityIdsForTokens` are declared as the only resolution paths. Sessions 65-68 prove the pattern works, so this is correct *for the wizard*. But the spec extends the "single path" rule by implication into:

- Import flow (`_walk_for_entities` in COMPILER_SPEC.md does its own iteration of `entity_ids`)
- Snapshot role mapping (DESIGN.md 6.11 walks the tree to write entity_ids in a non-wizard codepath)
- `_reResolveVariableUses` in editor.js (CLAUDE_SESSION_PROMPT.md line 222 says this walks the tree and re-resolves)
- Background entity validation (DESIGN.md 9.2 walks deployed pistons)

Each of those is a *de facto* second resolution path — they all look at entity_ids on nodes. If they diverge in handling globals/variables (resolution order, dedup, fallback when a global is missing), you'll have a silent inconsistency that's very hard to debug.

**What to do:**
- Restate the rule as: *"Token-to-entity-id resolution at wizard commit time goes through `_getFlatEntityIds` only. Read-side walks of `entity_ids` on already-committed nodes do not re-resolve — they trust what's on the node."*
- Add one sentence: *"If you find yourself wanting to resolve tokens in a read-side walk, that's a sign a previous commit didn't fully resolve. Fix the commit, not the walk."*

That preserves the actual invariant (one writer) without trapping future Claude into thinking _every_ entity_ids access has to call a wizard function.

---

### 3. HARD — "device_map is ELIMINATED"

**Where:** CLAUDE_SESSION_PROMPT.md line 177, DESIGN.md section 6.4, PISTON_FORMAT.md line 74, COMPILER_SPEC.md throughout, WIZARD_SPEC.md line 73, STATEMENT_TYPES.md, every spec file.

**The risk:** Mostly fine — this was a real architectural fix. But the phrasing in `CLAUDE_SESSION_PROMPT.md` ("device_map ELIMINATED — entity_ids stored directly on condition, action, for_each nodes") leaves no room to think about what *was* good about device_map.

The thing device_map *did well* was: when a global or local variable changed, you updated one place and every node that referenced it picked up the change automatically. Now you have `_reResolveVariableUses` and `globals_index.json` doing that work in two different places (editor.js for live edits, backend for stale-flag tracking on globals).

If a future test shows that "edit global → walk piston index → re-resolve in all affected pistons" is slow at 100+ pistons or has correctness bugs, the spec doesn't acknowledge that a hybrid approach is possible (e.g., entity_ids baked at deploy time, but variable_refs kept on nodes for in-PistonCore rebuilds — what device_map was approximating).

**What to do:** Add to DESIGN.md, probably in section 6.1 or 7.1:

> "**What changed and why:** Earlier versions stored `device_map` on the piston wrapper, mapping role names to entity_ids. Compiler and editor both looked up roles in the map. This made stale-flag tracking and global propagation cheap, but introduced an entire class of orphaned-reference bugs (a node references a role that doesn't exist in the map). Logic version 2 eliminates the map and stores entity_ids directly on every condition, action, and for_each node. The tradeoff: stale-flag tracking is now backend bookkeeping (`globals_index.json` + `_reResolveVariableUses`) rather than a free side-effect of the data model. **If that bookkeeping turns out to be unreliable or slow at scale, the path back is to add a `variable_refs: [...]` field alongside `entity_ids` on nodes, capturing what variable each entity_id came from — NOT to reintroduce device_map.** The map is rejected because it allowed orphaned references; an additive ref list does not."

This gives the next Claude a real escape route that doesn't undo the win.

---

### 4. HARD — "Compile target is always compiler-owned — never user-controlled"

**Where:** DESIGN.md 3.1 line 170, COMPILER_SPEC.md section 2 ("The user never chooses manually."), PYSCRIPT_COMPILER_SPEC.md 1.1.

**The risk:** This is asserted as inviolable, but the actual user scenarios where it bites you aren't covered:

- User builds a piston, gets it working, runs it on PyScript. HA adds native support for `break` (you've documented this as a real future event in `ha_version_added_native`). Next save, compiler re-scans, switches to native_script. The PyScript file is now orphaned in `/pyscript/pistoncore/`. Who cleans it up? COMPILER_SPEC says compiler doesn't write/delete files (Section 19), and you have no spec for "compile target changed since last deploy — clean up old artifact."
- User on Docker with `runtime_mode: "native"` (future, Section 16) writes a piston that uses `break`. The routing in `select_output_target` returns `"native"` because `is_complex && deployment == "docker" && runtime_mode == "native"` — but native Docker runtime won't exist for years. Right now this returns a target with no implementation behind it. There's no fallback to PyScript declared.
- User has a piston compiled to PyScript. They edit it. It happens to remove the only `break` statement. Compiler re-scans, switches to native_script. But the user is on Docker and intentionally wanted PyScript (it's permanent for Docker). Now they get a different runtime than they expected without being told.

**What to do:** Soften the rule from *"compile target is never user-controlled"* to *"compile target is auto-detected by default, but the user can pin it."* Then:

- Add a `compile_target_lock: null | "native_script" | "pyscript"` field to the piston wrapper. Default null = auto-detect. Non-null = compiler must use this target or surface an error explaining why it can't.
- Add a spec section for "previous compile target differs from current detection" — the deploy step must clean up the orphaned compiled file in the now-unused output directory.

This is one of the rules that *sounds* clean (no user override = no user error) but actually shifts every edge case to the user in the form of "your piston got moved to a different runtime silently."

---

### 5. HARD — "Match WebCoRE exactly. Deviation requires a specific documented reason."

**Where:** WIZARD_SPEC.md line 24, FRONTEND_SPEC.md line 10.

**The risk:** WebCoRE was a SmartThings/Hubitat product. Its UI conventions assumed:
- A hub that owned the device model (HA owns its model differently)
- Static `app.js` running in a known WebView
- A capability model where one device = one set of capabilities (HA breaks this — one device, many entities, many overlapping capabilities)
- No async runtime concerns (HA scripts have automation modes)

You've already documented deviations: globals editable from any screen, main screen layout, debug/log screen, multi-entity HA-native trigger handling. You also (correctly) split the device picker by `device_id` rather than mirroring WebCoRE's flat list. None of these are flagged as deviations in WIZARD_SPEC's "Intentional PistonCore differences from WebCoRE" list.

**The deeper issue:** "Match WebCoRE exactly" is asserted as the guiding rule, but the actual rule in practice is "Match WebCoRE for *interaction patterns*; let HA reality drive *data model and rendering*." That's a much more useful rule for the next Claude than "match exactly + document deviations" — because the deviations list is incomplete and will keep growing.

**What to do:** Replace the WebCoRE invocation with:

> "WebCoRE's interaction patterns and terminology (piston, with/do, ghost text, condition/trigger distinction, plain English sentence building) are the source of truth for *how the wizard feels to use*. WebCoRE's data model and rendering are NOT inherited — PistonCore's data model is shaped by Home Assistant's entity/device model and Jinja2/PyScript output requirements. When in doubt: WebCoRE wins on UX, HA wins on data."

---

### 6. SUBTLE — Entity IDs captured "at wizard commit time, never at runtime"

**Where:** WIZARD_SPEC.md ("entity_ids captured from live HA device picker at wizard commit time — never at runtime"), CLAUDE_SESSION_PROMPT.md line 179, PISTON_FORMAT.md, DESIGN.md 7.1 device globals, throughout.

**The risk:** This is correct for the wizard, but the spec doesn't acknowledge **three actual non-commit-time entity_id mutation points** that exist in the design:

1. **`_reResolveVariableUses` in editor.js** — when a variable is saved (not when a *node* is committed), it mutates `entity_ids` on nodes that referenced the variable. That's *not* commit time for those nodes.
2. **Snapshot import (DESIGN.md 6.11 Step 4)** — writes entity_ids to nodes based on the role-mapping dialog. That's import time, not wizard commit time.
3. **Global device variable edit → Redeploy All flow (DESIGN.md 7.1)** — when the user accepts the redeploy prompt, the compiled YAML gets new entity_ids baked in. The piston JSON entity_ids on the *node* don't update unless you also rerun `_reResolveVariableUses`. Worth checking — if you only update at deploy time and not at edit time, the editor will show stale entity_ids until the user clicks deploy.

**What to do:** Don't drop the rule, but make it specific. Restate as:

> "Entity IDs on a node are always real HA entity IDs (never role names, variable names, or runtime-resolved references). They are written or rewritten at exactly four times:
> 1. Wizard commit on a new or edited node.
> 2. `_reResolveVariableUses` when a referenced local variable is saved.
> 3. Snapshot import role mapping completion.
> 4. Redeploy All on a global device variable change (must also propagate to node JSON, not just compiled YAML).
> No other code may write to `entity_ids` on a node."

That's the rule that's actually true. The current rule is wishful.

---

### 7. SUBTLE — "Do not re-open" / "Locked decision" / "Do not relitigate" markers

**Where:** DESIGN.md 3.1 line 168 ("Do not re-open the question"), 7.1 line 529 ("Do not relitigate"), 8 line 917 ("This is a locked compilation decision. Do not reopen."), 27 line 1896 ("Do not re-open this question."), and the CLAUDE_SESSION_PROMPT "Locked Decisions" list.

**The risk:** These markers do a real job — they prevent thrash. But they also prevent the natural feedback loop where *real testing surfaces a problem the spec didn't anticipate*. Specifically:

- **"AppDaemon is ruled out"** (DESIGN.md 27) — sound rationale, but the v2 native runtime has not been built or even prototyped. If the 2-4 week estimate turns out to be 6 months and AppDaemon could deliver 80% of the value in a week, "do not re-open" prevents the obvious recovery move.
- **"Hybrid output model — permanent"** (DESIGN.md 3.1) — fine for simple pistons. But the line *"User feedback may influence roadmap priorities — it will not change this decision"* is a hostile attitude toward your future self. Real user testing of a v1 might reveal that the boundary between simple and complex is in the wrong place — and being unable to revisit that is bad.
- **"Multi-entity compilation — locked"** (DESIGN.md 8) — locked against what? You've already documented edge cases (`all` and `none` on triggers require template triggers, conditions have no native multi-entity support). The "locked" label suggests there's no remaining uncertainty, when in fact there's lots.

**What to do:** Replace "do not re-open" with **"re-open only if these conditions are met."** For example:

- AppDaemon: "Re-open if v2 native runtime construction is blocking ship dates AND a 1-week spike confirms AppDaemon can deliver observability acceptable for users."
- Hybrid output: "Re-open if v1 user testing shows the simple/complex boundary causes confusion or breakage. The shape of the answer might shift; the decision to keep simple pistons on native YAML stays."
- Multi-entity: "Re-open only if HA changes its multi-entity behavior in a future version."

This gives the next Claude a concrete test for whether the lock should hold, instead of a flat "don't ask."

---

### 8. CONTRADICTION — Variable scope warning state

**Where:** HA_LIMITATIONS.md "Variable scoping fix (HA 2025.3)" (says general scoping fixed, compiler warning can be downgraded/removed for most patterns, `loop_string_accumulation` PyScript fallback remains correct), versus COMPILER_SPEC.md 13 (CompilerWarning still defines `VARIABLE_SCOPE_WARNING` as a current warning), versus PYSCRIPT_COMPILER_SPEC.md 1.1 (`loop_string_accumulation` still in PyScript-forcing patterns table — correct).

**The risk:** Three files give three different impressions of what the variable-scope situation is. A new Claude reading COMPILER_SPEC.md alone will emit the warning aggressively. A Claude reading HA_LIMITATIONS.md alone will remove it. The correct state (per HA_LIMITATIONS.md) is "scoping fixed in HA 2025.3, but `loop_string_accumulation` is still flaky enough to force PyScript" — but that's spread across two files and never restated in COMPILER_SPEC.

**What to do:** Update COMPILER_SPEC.md Section 13's `VARIABLE_SCOPE_WARNING` to:

- Note that it applies only when piston targets HA <2025.3 (which it won't if you raise the minimum, as HA_LIMITATIONS.md suggests).
- Cross-reference `loop_string_accumulation` as the only currently-relevant case.
- Be removable once minimum HA is raised to 2025.3.

Also: TASKS.md and HA_LIMITATIONS.md both suggest raising minimum HA to 2025.3 before v1. Make this an actual decision item, not a perpetual "consider raising."

---

### 9. SUBTLE — TASKS.md "The goal before everything else"

**Where:** TASKS.md line 14-17.

> "Get to a clean round-trip on a simple piston: wizard writes JSON → backend saves it → compiler reads it → frontend renders it correctly. Blocking the round-trip: W-S9 picker gaps, B-1 backend compiler update, G-3 globals import."

**The risk:** This is *the* anchoring goal of the project and it's stated as one line. The danger is that "round-trip on a simple piston" hides a lot of unstated assumptions:

- Which simple piston? SAMPLE_PISTONS.md has three; only one is the "smoke test" piston in TEST_STRATEGY.md.
- Round-trip success = renders correctly? Or also compiles to expected YAML? Or also deploys to HA and triggers correctly?
- Does the round-trip have to survive edit + re-save? Or only the first save after wizard commit?

TEST_STRATEGY.md is short and doesn't fill this in either — it lists 5 steps but mixes verification levels (renders, deploys, triggers, log shows sequence, YAML matches).

**What to do:** Define "S3-1 done" as a precise checklist. Something like:

> S3-1 PASSES when, for the first piston in SAMPLE_PISTONS.md:
> 1. Wizard builds it from scratch with no manual JSON edits.
> 2. Save round-trips: close editor, reopen, every node renders identically.
> 3. Edit one node (e.g., change an entity). Save. Round-trip again. Identical except the changed field.
> 4. Compile target detected correctly as `native_script`.
> 5. Test Compile output matches the hand-verified YAML in COMPILER_SPEC.md Section 18.
> 6. Deploy succeeds. Trigger manually. PISTONCORE_RUN_COMPLETE event received.

Without this, "round-trip works" becomes a moving target and you'll declare victory too early.

---

### 10. MISSING ESCAPE — "PistonCore never auto-deletes" rules

**Where:** DESIGN.md 9.1 Step 3 ("Orphaned compiled files are NEVER auto-deleted"), 16 ("HARD RULE — PistonCore never auto-deletes compiled HA files it discovers are orphaned"), 9.1 Step 4 ("Do NOT auto-revert"), 9.1 Step 5 ("informational only — the piston keeps running in HA").

**The risk:** Correct as default, but no documented exception for the case where *PistonCore knows it created the file and the user explicitly deleted the piston*. The PistonCore → HA delete flow (Section 16) does delete files — that's fine. But the spec frames "never auto-deletes" as absolute, and:

- The `pending_cleanup.json` queue is only populated by explicit user action (correct).
- But Section 9.1 Step 3 scans for orphans — files with PistonCore signatures whose UUID isn't in the index — and the rule says never delete them.

That means: if a user wipes their PistonCore volume, restores from a backup, and the backup doesn't have a piston they recently created, the orphaned compiled file lives in HA forever and the user has to manually decide what to do for each one. For someone with 50 pistons after a partial restore, that's a real problem.

**What to do:** Don't change the default, but add an escape. Something like:

> "Bulk-orphan recovery: if the orphan scan finds more than 5 orphaned files (suggesting a partial restore or volume wipe), surface a one-time recovery dialog. User options: (1) re-import each as a backup, (2) mark all as user-managed (PistonCore stops tracking), (3) delete all (PistonCore removes them from HA via the normal delete flow). No auto-decision."

This preserves the "never silently delete" rule while giving the user a path that isn't "click 50 times."

---

## Eight more findings (lower blast radius, still worth knowing)

### 11. STYLE — "ONE QUOTE PER SOURCE" / "Specs are authoritative over code" pattern

**Where:** Multiple CLAUDE_SESSION_PROMPT.md rules.

These are good rules for a session. But every spec also contains lines like *"Spec says handled — code does not enforce it."* (HA_LIMITATIONS.md section 9, multiple bullets). When the code-of-record disagrees with the spec-of-record, having "specs are authoritative" as the rule means you spec things that aren't true.

A better framing: "specs are authoritative for design decisions, code is authoritative for what currently exists. Discrepancies are gaps, not bugs in either." HA_LIMITATIONS section 9 is actually doing this correctly — flagging known divergences as work items. Make this an explicit pattern.

---

### 12. HARD — "compile_target": "native_script" or "pyscript" is in PISTON_FORMAT but always set by compiler

**Where:** PISTON_FORMAT.md line 68.

This field is in the JSON, gets saved with the piston, but the compiler recomputes it on every save. So what's it doing in the format? Two possibilities:

- **A:** It's a cache of the last compile target so the UI can render the indicator without recompiling. Then say so.
- **B:** It's a hint to the compiler about expected target. But the spec elsewhere says the compiler ignores user preference, so this can't be it.

If A: cache it, but treat the JSON value as stale on read. Don't make import/export include it (Section 6.4 says it's preserved across Snapshot/Backup, which is wrong if it's a cache — Snapshot should rebuild it from the statement scan, not trust the source piston's value).

---

### 13. SUBTLE — `role_tokens` lifecycle isn't fully nailed down

**Where:** WIZARD_SPEC.md 2.4 guardrail, CLAUDE_SESSION_PROMPT.md line 199, PISTON_FORMAT.md (doesn't include role_tokens in the field reference — GAP-S64-1 is open).

GAP-S64-1 is correctly logged for D-S5. But this rule has a subtle problem already: **the compiler ignores role_tokens, but Snapshot export does what?** If role_tokens is preserved in Snapshots, then community-shared pistons leak the original user's variable names and global names (e.g., `"@MyHouseLights"` shows up in your shared piston). If role_tokens is stripped on Snapshot export, that's another field to maintain alongside the entity_ids stripping rule (DESIGN.md 6.10).

The current spec is silent on this. When Jeremy writes D-S5, the spec should say: **Snapshot export strips role_tokens to `[]` or removes the field entirely, treating it as private edit-tracking data not meant for sharing.**

---

### 14. CONTRADICTION — Snapshot wrapper preserves vs replaces `id`

**Where:** DESIGN.md 6.10 says "A new `id` is assigned on import (not preserved from the Snapshot)" and shows `"id": "00000000"` in the example. DESIGN.md 6.4 says `"id"` is "new on import" for Snapshots — consistent. Section 6.11 Step 5 says "Generate new UUID for the piston (Snapshots never preserve the original ID)" — consistent.

But the example wrapper in 6.10 shows `"id": "00000000"`. If you Snapshot-export a piston, what `id` does the exported file have? Should be obvious — the exporter has the real id — but the example shows a placeholder, which is ambiguous. Pick one: either Snapshot exports use a fixed `"00000000"` placeholder (cleaner — emphasizes "not a real piston, must be imported") or they carry the source `id` and the importer ignores it.

Recommend: placeholder. Then state the rule explicitly.

---

### 15. SUBTLE — "Test button always executes real actions"

**Where:** HA_LIMITATIONS.md section 7, FRONTEND_SPEC.md (Test — Live Fire Flow).

This is documented as a danger but presented as inviolable. The actual right answer for a v2 is a dry-run mode. The spec correctly says "Consider a global Test Mode toggle for v2 that logs instead of fires" — good. But there's a v1 mitigation that isn't proposed: **per-piston test scope.** A user could check a box on a specific piston saying "test runs are no-op in HA but log what would have happened." That's much smaller than a global dry-run mode, and it would protect against the actual case the user fears: pressing Test on a piston that turns on the alarm at 3 AM.

This is the kind of thing where the spec's "v1 has no dry-run, period" stance prevents incremental improvement. Reframe to: "v1 ships without dry-run. If user testing shows Test-button damage is a real problem, add per-piston test scope as a v1.1 fix before adding global Test Mode for v2."

---

### 16. MISSING ESCAPE — Capability data from HA being wrong

**Where:** DESIGN.md 8 Capability Data Quality and Graceful Degradation, WIZARD_SPEC.md.

The current rule is "if HA returns no usable capability data → Unknown Device Fallback." Good. But what about: HA returns *plausible-looking but wrong* capability data? (Zigbee2MQTT often returns a generic switch profile for devices that actually support color and brightness.) The wizard would happily show only `turn_on`/`turn_off` for what's actually an RGB bulb.

No spec covers this. The Unknown Device Fallback only triggers when caps are *empty*, not when they're *wrong*. There's no user-facing "this device's capabilities look incomplete — define manually" prompt.

This is the kind of thing that real user testing will surface in the form of "why can't I set my light's brightness?" and the answer will be "because Z2M reported it as a switch." The spec doesn't acknowledge this case exists.

**What to add:** A "manual capability override" path that exists alongside the Unknown Device Fallback. Same UI (Define this device), but reachable from any device's wizard, not only from devices with zero caps.

---

### 17. STYLE — "Read-only this indicator is" / "This is correct and must never be changed"

**Where:** WIZARD_SPEC.md guardrail section, CLAUDE_SESSION_PROMPT.md.

These markers exist because past sessions kept regressing on the right behavior. That's a valid pain point. But the *content* of the guardrails is sometimes incomplete. For example, WIZARD_SPEC.md line 218 says:

> "If only `primary_entity_id` were stored: when a multi-entity device like 'Outdoor Motion' is selected alongside another device, `_getGroupedEntityIdsForTokens` would only find the group via the one stored primary."

This is the rationale for storing all entity_ids. Good. But there's a *follow-up consequence not documented*: a device whose entity list changes after commit (e.g., user adds a new entity to the device in HA — temperature sensor added via reconfigure) will have `sel.tokens` referencing only the original entity_ids. The group still resolves correctly because any old entity_id finds the group. But the new entity won't be in the action's `entity_ids` until the user re-edits the node.

That's a subtle correctness question — and it interacts with the entity validation in DESIGN.md 9.2. Worth a paragraph in the guardrail about what happens when the *device's entity set* changes between commit and runtime.

---

### 18. MISSING ESCAPE — Compiled YAML doesn't match expectations in real HA

**Where:** COMPILER_SPEC.md Section 18 "Hand-Written Verification Example."

The hand-verified example is great. But the entire compiler spec is verified against documentation, not against running HA. DESIGN.md 33 explicitly says: "Any new technical approach... must be validated against real HA behavior BEFORE it is written into a spec or implemented in code." But the compiler spec hasn't been validated end-to-end against running HA — only the multi-entity HA-native behavior was verified (May 2026, per HA_LIMITATIONS.md).

When B-1 ships and someone deploys a real piston, you will find compiler bugs the spec doesn't anticipate. The spec has no "discrepancy log" section — there's no obvious place in COMPILER_SPEC.md to write down "when HA actually does X instead of Y, the compiler must Z." That history will end up scattered across TASKS.md GAP entries and HA_LIMITATIONS.md.

**What to add:** A "Section 21 — Compiler Reality Discrepancies" stub at the end of COMPILER_SPEC.md, with a single example entry pre-filled (e.g., the trigger:/platform: distinction documented in Section 19 line 916). New entries get added here as real testing reveals divergences. This gives discoveries a home before they're spread across three files.

---

## Two pattern-level observations

### A. The spec set is over-confident about decisions that haven't been tested end-to-end yet.

Lots of "permanent," "locked," "do not re-open" markers. The actual project status is: backend compiler not rewritten yet, S3-1 smoke test never run, real HA deploy never verified for the new architecture. The right confidence level is "we've thought hard about this and have rationale, but the real test is S3-1 and we'll learn things."

This isn't bad in itself — it prevents thrash. But pair it with a different rule: **"a locked decision can be re-opened by a successful unit/integration test that contradicts it, but not by argument."** That gives Claude a clean criterion: don't waste time relitigating; do find a test that proves it.

### B. The "must read DESIGN.md before this document" cascade is fragile.

Every spec opens with "read X first." DESIGN.md is 2160 lines, and several of its sections (6.2, 6.3) are superseded with new sections later in the file (6.10, 6.11). A new Claude reading top-to-bottom will absorb the superseded content as authoritative for a while before reaching the corrections.

Section 6.2 (line 265) does say "Snapshot format is defined in DESIGN.md Section 6.10 (added Session 57). See that section for the full spec." That's good. But it doesn't *replace* the section — section 6.2 still exists as a stub. Better: move the supersession marker to the *top* of the document (a "What's authoritative in this document" preamble), and make 6.2 a one-liner that *only* says "see 6.10." Same for 6.3 → 6.11. Right now the bridges between superseded and current content rely on the reader noticing them.

---

## What I'd do first if I were Jeremy

1. **The CLAUDE_SESSION_PROMPT.md is the most-loaded file every session, and it has the most boxes-Claude-in style assertions.** Of all the files, this is the one where small wording changes have the biggest leverage. Specifically: the "Locked Decisions" list (lines 169-183) should be reframed as "Decisions With Rationale" — each line gets a one-line "why" attached, so Claude can think with the rationale rather than just enforce the rule.

2. **Add to PISTON_FORMAT.md a single "Field Lifecycle Rules" section** describing exactly when each field on a node is written/read/cleared. role, role_tokens, entity_ids, device_label, compiled_value, display_value, aggregation — each one should have one line saying when it's written, when it's read, when it's stripped on Snapshot. This will surface the contradictions in #6, #13, and #14 above.

3. **Run S3-1 sooner than the current task ordering implies.** TASKS.md has W-S9, B-1, G-3 blocking the round-trip. That's all coding. But you also have at least three weeks of spec drift since the last verified run. The longer you wait, the more "locked decisions" turn into "untested decisions."

4. **For the next 3-5 sessions, keep this audit file in the chat upload list.** When you start a session, ask Claude to scan the relevant section first. If a spec rule comes up that contradicts the audit, pause and decide before writing code.

---

*This audit is opinionated. Some findings reflect genuine ambiguity in the specs; others reflect a difference in taste between Jeremy's preferred rigid-rule style and a more "documented decision with escape hatch" style. The rule of thumb I used: if a rule, taken literally, prevents Claude from doing the obvious right thing when reality contradicts the spec, that rule is a candidate for softening.*
