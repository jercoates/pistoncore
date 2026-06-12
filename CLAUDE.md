# CLAUDE.md — PistonCore

Open-source WebCoRE-style visual automation builder for Home Assistant.
Stack: Python/FastAPI backend, vanilla JS/HTML/CSS frontend (no framework, no build
step), Jinja2 templates, JSON storage, Docker on Unraid at port 7777.

**About Jeremy (the project director):** no programming background. He directs, you
implement. He verifies behaviorally — deploy, click through, watch what happens — not by
reading code. This means: your explanations ARE his code review. Explain in plain English
what you're changing and why before you change it. Never assume he caught something from
a diff.

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

- **sel.tokens model** — physical picker rows store ALL entity_ids of the device group,
  never just primary_entity_id. (Took 6 sessions. WIZARD_SPEC.md guardrail section.
  The wizard-action.js header comment saying "primary_entity_id" is STALE — ignore it.)
- **Union-then-intersect capability lookup** — `_getGroupedEntityIdsForTokens` returns
  arrays per group; union caps within a group, intersect across groups.
- **Nested tree model** — children embedded directly on parent nodes. No ID references
  between statements anywhere.
- **Editor never reads display text** — rendering is a pure projection from JSON;
  display text is never stored or parsed.
- **UI/Data separation** — `role`/`device_label` are always friendly names;
  `entity_ids` are always real HA entity IDs; `role_tokens` is edit-round-trip only and
  the compiler ignores it. If these mix anywhere, that is a bug.
- **Compiler is read-only** — it never mutates piston JSON. Errors go to the debug page.
- **All HA YAML values go through Jinja2 templates** — never inline YAML in Python.

## Authority Order & Key Files

CLAUDE_SESSION_PROMPT.md → DESIGN.md → spec files. Code is the source of truth for
"what exists today"; specs are the source of truth for "what it must do."

- **TASKS.md** — all open gaps, grouped into session bundles. The ONLY status file.
- **PISTON_FORMAT.md** (data model) + **STATEMENT_TYPES.md** (per-statement schemas) +
  **WITH_BLOCK_TASK_FRAMEWORK.md** (task container) — authoritative for JSON shape.
- **COMPILER_SPEC.md / PYSCRIPT_COMPILER_SPEC.md** — INTENTIONALLY FROZEN/STALE.
  Directional only. Do not update them and do not treat their examples as correct.
- **SAMPLE_PISTONS.md** — old-format until regenerated (D-S5d). Not a valid reference.
- **PROGRESS_TRACKER.md** — Session-12 fossil; ignore if still present.
- **/reference/** — archived session artifacts. NEVER read anything in this folder.

When making a claim about what code does, cite file + approximate line. Unverifiable
claims get marked ASSUMED (the Verified/Decided/Assumed ledger convention).

## Verification

- Jeremy tests on the DEV instance first. Production deploy only after dev passes.
- After frontend changes, tell Jeremy exactly what to click and what he should see —
  he verifies behavior, not code.
- If a validator/schema script exists (planned: piston JSON schema check), run it after
  any change that touches piston JSON shape, before declaring the task done.
- Syntax-check every JS/Python file you edit (`node --check`, `python -m py_compile`).

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
