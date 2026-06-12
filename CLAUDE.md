# CLAUDE.md — PistonCore

Open-source WebCoRE-style visual automation builder for Home Assistant.
Stack: Python/FastAPI backend, vanilla JS/HTML/CSS frontend (no framework, no build
step), Jinja2 templates, JSON storage, Docker on Unraid at port 7777.

**About Jeremy (the project director):** no programming background. He directs, you
implement. He verifies behaviorally — deploy, click through, watch what happens — not by
reading code. **He cannot read code or diffs.** His only way to catch a wrong turn is your
plain-English narration of what you're doing and why, described as behavior, not as code
edits. Narrating intent in plain language is therefore mandatory and load-bearing, not
optional — see "Verification & Narration" below. Your explanations ARE his code review.

---

## ⭐ THE LOAD-BEARING RULE — Device → Entity Resolution

If this breaks, nothing works — the editor shows pretty text that compiles to nothing.

1. **Variables and globals store device NAMES (friendly names). NEVER entity IDs.**
   The friendly name is the lookup key for pulling current entity IDs live from HA.
2. **Nodes (condition / action / for_each / trigger) store entity IDs** — the
   attribute-bearing entity, one per physical device, for the chosen function.
3. **Resolution happens at the node, at commit time**, because the same variable feeds
   different attributes in different statements.
4. **Only nodes hold entity IDs. Variables and globals never do. No exceptions.**

Authoritative: PISTON_FORMAT.md "⭐ THE LOAD-BEARING RULE". Diff anchor:
REFERENCE_PISTON_V2.json.

⚠ Several code comments still assert the OLD model ("value is an array of entity ID
strings" in api.js, globals.js, wizard-variable.js headers). They are wrong — GAP-S74-8.
Never trust a comment over this rule or over PISTON_FORMAT.md.

---

## Workflow Rules

1. **Plan first, always.** Before editing any file: state what the problem is, what the
   spec says, what the code actually does, which files you will touch, and what you will
   change. Wait for approval. Plan mode is the default for anything non-trivial.
2. **Read before writing.** Read every file you intend to modify, plus the relevant spec
   sections, before proposing changes. Do not code from memory of a previous session.
3. **One PLANNED task per session — with a triage protocol for discoveries** (see below).
4. **Small, labeled commits.** One commit per fix, message referencing the GAP number
   (e.g. `GAP-S74-3: support 'devices' plural in resolvers`). Detours get their OWN
   commit, never folded into the main task's commit.
5. **Every problem found gets a GAP-SXX-N entry in TASKS.md before the session ends** —
   assigned to a session bundle. No orphan discoveries.
6. **No scope creep.** Fix exactly what was agreed. Do not "improve" adjacent code,
   rename things, reformat, or remove code you think is dead without asking. Dead-code
   removal is its own task.
7. **Check for stale comments in any file you touch** — update comments that contradict
   the current model while you're there (this is in-scope, not creep).
8. **Specs before code.** Spec sessions produce no code. Coding sessions follow specs;
   if a spec is wrong, say so and propose the spec fix — don't silently code around it.

## Mid-Session Discovery Protocol (the realistic version of "one task")

Jeremy WILL find bugs while testing mid-session. That's normal and valuable. When he
reports one (or you spot one), do NOT just start fixing it. Classify it out loud first:

- **FIX NOW** if it (a) blocks verifying the current task, or (b) is trivial — a few
  lines, in a file already open for this task, with an obvious cause you can state.
  Get a yes, fix it as its own commit, log it in TASKS.md as found-and-fixed.
- **LOG AND CONTINUE** for everything else — anything needing investigation, touching
  unopened files, or whose cause you'd be guessing at. Write the GAP entry with what was
  observed and the suspected area, then return to the planned task.
- **SWAP** only if Jeremy explicitly says the discovery is now the session's task. Then
  the original task rolls forward in TASKS.md — never half-done in both.

The rule being protected is **never detour silently** — every deviation is classified,
approved, committed separately, and logged. End-of-session summary must list: planned
task status, every detour taken, every gap filed.

## Decision Confidence Levels

- **Hard guardrails** (below) — scar tissue from multi-session bugs. If one seems wrong,
  YOU are most likely wrong. Never unwind without explicit conversation.
- **Researched decisions** — locked with rationale. Re-open only with new evidence.
- **Working assumptions** — anything else in the specs. If reality contradicts one,
  propose the spec update; don't contort the code. Jeremy decides.

## Hard Guardrails — DO NOT UNWIND

- **⭐ THE PICKER → NODE RESOLUTION PROCESS — the most-broken, most-load-bearing rule.**
  This is a SINGLE process with two DIFFERENT scopes at two DIFFERENT moments. Collapsing
  them is THE bug (GAP-S69-9; the thing W-S11 was supposed to fix). The full sequence,
  do not abbreviate:
  1. Use the **friendly names** (from the variable/global) to pull device IDs from HA.
  2. Load **ALL entity IDs linked to each device** (every entity the physical device
     exposes — NOT just the primary). This is the sel.tokens "store all entity_ids" rule.
  3. If **multiple devices**, pull the attributes for each device and show in the picker
     **ONLY the options that are the same across all selected devices** (union within a
     device, intersect across devices).
  4. When an attribute is chosen, write into the JSON **ONLY the entity IDs for that
     attribute — one per device.** Nothing else.

  The key that keeps getting dropped: **steps 2–3 load everything FOR THE PICKER (to decide
  what to offer); step 4 stores ONLY ONE attribute-bearing entity per device on the node.**
  The picker SEES all entities; the node STORES one-per-device for the chosen attribute.
  Loading-everything and writing-one are deliberately different scopes — that is what lets
  one variable feed an illuminance condition and a battery condition with different resolved
  entities. **If the node ends up with the whole entity cluster, the rule is broken** —
  that is the exact regression to watch for.

  Code: built/fixed in W-S11 (Session 70) via `_capEntityMap` (`_loadCapsIntoSelect` builds
  attribute→one-entity-per-device; `_buildConditionNode` reads it at commit).
  `_getGroupedEntityIdsForTokens` does the step-3 union-then-intersect.
  ⚠ W-S11 (Session 70) was verified WORKING — Jeremy confirmed by reading the saved JSON 
  that the node held one entity per device for the chosen attribute. A LATER session then 
  regressed it, dumping the full entity cluster back into the JSON. The lesson is NOT
  "W-S11 never worked" — it's that a downstream change silently broke a confirmed-good 
  behavior. Therefore: any change that touches the picker, the commit path, _capEntityMap,
  or _getFlatEntityIds MUST be re-verified by reading a freshly-saved multi-attribute
  piston's JSON and confirming one-entity-per-device. A passing checkmark upstream does
  not survive a later edit. Re-read the JSON after every change in this area.
  (The wizard-action.js header comment saying rows store "primary_entity_id" is STALE —
  ignore it; step 2 says ALL entity_ids.)
- **Nested tree model** — children embedded directly on parent nodes. No ID references
  between statements anywhere.
- **Editor never reads display text** — rendering is a pure projection from JSON;
  display text is never stored or parsed.
- **UI/Data separation** — `role`/`device_label` are always friendly names;
  `entity_ids` are always real HA entity IDs; `role_tokens` is edit-round-trip only and
  the compiler ignores it. If these mix anywhere, that is a bug.
- **Compiler is read-only** — it never mutates piston JSON. Errors go to the debug page.
- **All HA YAML values go through Jinja2 templates** — never inline YAML in Python.

## ⛔ FROZEN ON PURPOSE — Do NOT flag, log, or "fix" these

These are parked by deliberate decision, NOT neglect. They are stale BECAUSE the piston
JSON format is not final yet, and updating them against a moving format is wasted work
(that is the whole reason they're frozen). Their out-of-date state, legacy `device_map` /
role→entity residue, and old-model examples are KNOWN. When you scan the codebase, treat
these as off-limits:

- **compiler.py and the PyScript compiler** — frozen until the JSON is final (D-S6). The
  `device_map` lookups, `_resolve_role_entities`, `_resolve_collection`, role resolution,
  etc. inside them are deliberate leftovers awaiting the rewrite. Do NOT report them as
  bugs, do NOT log them as gaps, do NOT edit them.
- **COMPILER_SPEC.md / PYSCRIPT_COMPILER_SPEC.md** — frozen specs for the above. Directional
  only; their examples are not correct against the current model. Do not update them.
- **AI_PROMPT_SPEC.md** — same situation: written against the old device_map JSON model,
  frozen until the format locks. Do not flag its staleness or rewrite it until AI-import
  work is explicitly scheduled (it's deferred in TASKS.md).

**The ONLY live work right now is the piston JSON format, the wizard, the editor, and the
backend save/storage path.** When you find legacy residue, first ask: is it in a frozen
item above? If yes — silent, leave it. If no — that's real, report/log it. The narrow
exception: a *fact* about frozen code may be cited when it informs a LIVE decision (e.g.
`_compile_with_block` only resolving `devices[0]` is evidence for the GAP-S74-3
`device`-vs-`devices` decision) — cite it as evidence, do not propose touching the frozen
code.

## Authority Order & Key Files

CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files. Code is the source of truth for
"what exists today"; specs are the source of truth for "what it must do."

- **TASKS.md** — all open gaps, grouped into session bundles. The ONLY status file.
- **PISTON_FORMAT.md** (data model) + **STATEMENT_TYPES.md** (per-statement schemas) +
  **WITH_BLOCK_TASK_FRAMEWORK.md** (task container) — authoritative for JSON shape.
- **COMPILER_SPEC.md / PYSCRIPT_COMPILER_SPEC.md** — INTENTIONALLY FROZEN/STALE
  (see "FROZEN ON PURPOSE" above). Directional only; do not update or trust examples.
- **AI_PROMPT_SPEC.md** — INTENTIONALLY FROZEN/STALE (old device_map model; see above).
  Do not flag or rewrite until AI-import work is scheduled.
- **SAMPLE_PISTONS.md** — old-format until regenerated (D-S5d). Not a valid reference.
- **PROGRESS_TRACKER.md** — Session-12 fossil; ignore if still present.
- **/reference/** — archived session artifacts. NEVER read anything in this folder.

When making a claim about what code does, cite file + approximate line. The
Verified/Decided/Assumed ledger convention is the TARGET, but it only exists in the
Session-73 specs (WITH_BLOCK_TASK_FRAMEWORK, SPEAK_ACTION_SPEC, NOTIFY_ACTION_SPEC) — MOST
specs do NOT have it yet. So: the ABSENCE of an ASSUMED tag does NOT mean a claim is
verified. Treat any unledgered "the code does X" claim in an older spec as UNVERIFIED until
checked against the actual code, and mark your own unverified claims ASSUMED.

## Verification & Narration — READ THIS, IT IS HOW JEREMY STEERS

**Jeremy cannot read code. Diffs and line numbers tell him nothing.** His ONLY way to
catch a misunderstanding or a wrong turn is your plain-English narration of INTENT. This
is not a courtesy — it is the steering mechanism. Treat it as a hard requirement:

- **Narrate intent, in plain English, as you go.** Before each step, say in ONE plain
  sentence what you are about to make happen and WHY — described by behavior, not by
  code. ✅ "I'm making the action only keep the device that can actually run the chosen
  command, so a speaker's battery sensor doesn't end up as the target." ❌ "Editing
  `_saveDeviceCmd` at line 765, changing the filter on `finalIds`." The second sentence
  is useless to Jeremy and he cannot catch drift in it.
- **Never substitute a diff for an explanation.** "I changed these lines" / "see the
  diff" does NOT count as telling him what you did. Showing which lines changed conveys
  nothing to him. Every change must be stated as a behavior in words.
- **State intent BEFORE acting, not only after.** Jeremy catches "that's not what I
  meant" from your stated plan. If you act first and explain after, you've removed his
  only window. Plan mode up front + a plain sentence before each edit = two chances for
  him to stop you. Use both.
- **When he interrupts or says "that's not it," STOP immediately** — do not finish the
  edit "to be tidy." Re-state your understanding in plain English and get a yes before
  resuming. A misunderstanding caught mid-task is the system working, not a failure.
- **If a step is genuinely hard to describe without code, that is a signal** the change
  is bigger or murkier than agreed — pause and flag it, don't push a code-only
  explanation past him.

## Verification (behavioral — Jeremy tests, never reads)

- Jeremy tests on the DEV instance first. Production deploy only after dev passes.
- After ANY change, tell him exactly what to click and what he should SEE/observe — he
  verifies behavior on screen, not code. End every coding task with these steps.
- If a validator/schema script exists (planned: piston JSON schema check), run it after
  any change that touches piston JSON shape, before declaring the task done. Report the
  result in plain English ("the saved piston matches the expected shape" / "it flagged a
  missing field").
- Syntax-check every JS/Python file you edit (`node --check`, `python -m py_compile`) and
  say plainly whether it passed — don't make Jeremy infer it from the absence of an error.

## Deploy (Unraid — Jeremy runs this, you don't)

```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## Session Close Checklist

1. Summarize: planned task status, detours taken, commits made.
2. Move completed gaps to TASKS_HISTORY.md; roll partial remainders forward.
3. File every new gap into a TASKS.md bundle.
4. Flag any spec that the session's findings made stale.
5. Remind Jeremy to commit/push via GitHub Desktop if uncommitted work remains.
