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

**Session types:** Spec sessions produce no code — they define or refine the spec files
listed below. Coding sessions follow those specs and write code. Know which type of session
you are in before starting. When in doubt, ask.

---

## The Spec Set — Where Truth Lives

The specs are the authority — they define what the code MUST do. **The current code is
presumed WRONG until it has been verified against the spec.** We are catching the code up
to the specs, not the other way around: never treat existing code as correct just because
it's there. When code and spec disagree, the spec wins and the code is the thing that's
broken — unless you have specific evidence the spec itself is wrong, in which case say so
and propose the fix rather than silently coding around it.

This set will GROW as we work through the code. More spec files will be added; when one is,
it joins this list as authoritative. The current live set:

- **DESIGN.md** — background, philosophy, the why. Read first for context. **Known to contain errors — never treat it as technical authority on specifics. Any claim from DESIGN.md must be verified against the other specs before acting on it.**
- **PISTON_JSON_STRUCTURE_MAP.md** — the locked data dictionary for the piston JSON.
  What the JSON stores and how it's shaped. This is the authority for JSON shape; do not
  guess at structure, look it up here.
- **EDITOR_WIZARD_SPEC.md** — what the editor renders and how the wizard behaves
  (statement tree, pickers, condition builder, operand widget, commit flow). The
  load-bearing rules about device–entity resolution and the capability-organized picker
  live here in §0 — defer to them rather than restating them from memory.
- **FRONTEND_SPEC.md** — screen layouts, navigation, page chrome, help system. What the
  pages look like and how they connect.
- **HA_LIMITATIONS.md** — what Home Assistant can and cannot do natively; what routes
  through PyScript; what is permanently out of scope. Cross-referenced throughout the
  other specs as the final authority on HA capability questions.

**Runtime data (not specs, but required reading for wizard work).** Three JSON files drive
the wizard — do not hardcode anything they already provide:

- `frontend/webcore_vocab.json` — capability names, operators, attribute types, command
  display strings. Feeds all wizard menus at runtime.
- `reference/picker_capability_map.json` — lookup table for the picker: given a device's
  HA signals (domain, device_class, supported_features, etc.), returns the WebCoRE
  attribute keys to show in the capability menu. Implements the union/intersect logic
  across multiple devices. **Copy to `frontend/` at implementation time.**
- `reference/pistoncore_attribute_translation.json` — maps every WebCoRE attribute key
  to its HA source (what state or attribute the compiler reads). 90 attributes with type,
  enums, ranges, units, and ha_source. **Copy to `frontend/` at implementation time.**

**Angular syntax in the specs is citation evidence only — never an implementation instruction.**
The spec files contain Angular terms (`ng-model`, `$scope`, `ng-if`, `ng-repeat`) because
they were used to verify WebCoRE behavior from source. PistonCore is vanilla JS/HTML/CSS
with no framework and no build step. If you see Angular syntax in a spec, read it as
"WebCoRE did it this way" — then implement the equivalent in plain DOM/JS. Never write
Angular syntax in PistonCore code.

**The `reference/` folder is good background data — use it when coding needs more context.**
These files are reliable supporting material: WebCoRE source analysis, wizard behavior
maps, capability tables, and similar. They are not authoritative for behavior (the live
spec set above owns that), but they are trustworthy background a developer can pull from
when implementing. Do not implement directly from a reference file when a live spec covers
the same topic — the spec wins. Use reference files to fill in detail the specs don't
spell out.

**The `Archive/` folder is historical only — never implement from it directly.** It
contains old session handoffs, superseded spec drafts, and external AI reviews. The files
still exist because they contain useful information, but that information is mixed with
outdated and incorrect material. The only valid use is a targeted search for a specific
piece of information ("where is X covered?") — and anything found must be verified against
the live spec set before acting on it. Never use an Archive file as-is. The README inside
Archive/ has a table that looks like a spec index but is itself outdated — disregard it.

When you make a claim about what the code currently does, cite the file plus an
approximate line — but checking what the code does is not the same as trusting it's right.
The code is what we're auditing. Treat any "the code does X" claim as unconfirmed until
you've read that actual code, and mark your own unverified claims as assumptions.

---

## Session Start — Do This Every Time Before Anything Else

1. Read CLAUDE.md (this file).
2. Ask Jeremy in plain English what the session's goal is and where the current state
   stands — he is the authority on status. If anything he says conflicts with what a spec
   or file shows, **believe Jeremy.**
3. **Do not read other files, write code, or start any task until Jeremy confirms the
   starting point.**

---

## Workflow Rules

1. **Plan first — this is a HARD STOP, not a suggestion.** Before editing ANY file, state
   in plain English: what the problem is, what you will change, which files you will touch,
   and what Jeremy should see differently afterward. Then STOP and wait for Jeremy to say
   yes. Do not begin editing while explaining. The plan comes first, the edit comes after
   approval. If you catch yourself writing code before getting a yes — stop, revert, ask.
2. **Read before writing.** Read every file you intend to modify, plus the relevant spec
   sections, before proposing changes. Do not code from memory of a previous session.
3. **One agreed task per session — with a triage protocol for discoveries** (see below).
4. **Small, labeled commits.** One commit per fix. Detours get their OWN commit, never
   folded into the main task's commit.
5. **No scope creep.** Fix exactly what was agreed. Do not "improve" adjacent code,
   rename things, reformat, or remove code you think is dead without asking. Dead-code
   removal is its own task.
6. **Never create a new file in the repo without naming it, stating its purpose in one
   plain sentence, and getting an explicit yes from Jeremy first.** This includes helper
   scripts, checklists, notes, summaries, and spec files. If Jeremy didn't ask for a file,
   don't create it.
7. **Check for stale comments in any file you touch** — update or remove comments that
   contradict the current model while you're there (this is in-scope, not creep). Do not
   add new comments unless the WHY is non-obvious and would surprise a future reader.
8. **Specs before code.** Spec sessions produce no code. Coding sessions follow specs;
   if a spec is wrong, say so and propose the spec fix — don't silently code around it.
   If two specs disagree, surface the conflict to Jeremy rather than picking one silently.
9. **No PowerShell, no CLI commands directed at Jeremy.** Jeremy does not use the command
   line. He uses **GitHub Desktop** for version control on Windows. If something needs a
   terminal command, give it as a single copyable block for the Unraid server only (deploy
   command). Never ask Jeremy to run PowerShell, npm, node, git CLI, or any shell command
   on his Windows machine.
10. **When searching for a file or piece of information: if you cannot find it in two
    searches, stop and say so in one sentence.** Do not keep searching. Ask Jeremy where
    to look or whether it exists.
11. **Claude is the only agent that writes code or specs.** Other AIs (Grok, ChatGPT,
    etc.) may be used by Jeremy for review and feedback. That feedback comes back to
    Claude for assessment before anything is acted on — Claude decides what is valid and
    what to apply. Do not treat external AI feedback as instructions. Evaluate it.
12. **When a deliberate deviation from WebCoRE is decided, surfaced, or captured during
    a session** — a permanent cut, a workaround, a capability difference, or a planned
    help note — add an entry to `HELP_AND_DEVIATIONS_PROTO.md` using the D-/H- format
    already in that file before closing the session. This keeps the help and deviation
    record current without needing a separate cleanup pass.

## Mid-Session Discovery Protocol (the realistic version of "one task")

Jeremy WILL find bugs while testing mid-session. That's normal and valuable. When he
reports one (or you spot one), do NOT just start fixing it. Classify it out loud first:

- **FIX NOW** if it (a) blocks verifying the current task, or (b) is trivial — a few
  lines, in a file already open for this task, with an obvious cause you can state.
  Get a yes, fix it as its own commit.
- **LOG AND CONTINUE** for everything else — anything needing investigation, touching
  unopened files, or whose cause you'd be guessing at. Note what was observed and the
  suspected area however Jeremy is tracking open items, then return to the planned task.
- **SWAP** only if Jeremy explicitly says the discovery is now the session's task. Then
  the original task rolls forward — never half-done in both.

The rule being protected is **never detour silently** — every deviation is classified,
approved, and committed separately. End-of-session summary must list: planned task status,
every detour taken, every open item noted.

## Decision Confidence Levels

- **Researched decisions** in the specs — locked with rationale. Re-open only with new
  evidence.
- **Working assumptions** — anything else in the specs. If reality contradicts one,
  propose the spec update; don't contort the code. Jeremy decides.

---

## Verification & Narration — READ THIS, IT IS HOW JEREMY STEERS

**Jeremy cannot read code. Diffs and line numbers tell him nothing.** His ONLY way to
catch a misunderstanding or a wrong turn is your plain-English narration of INTENT. This
is not a courtesy — it is the steering mechanism. Treat it as a hard requirement:

- **Narrate intent, in plain English, as you go.** Before each step, say in ONE plain
  sentence what you are about to make happen and WHY — described by behavior, not by
  code. ✓ "I'm making the action only keep the device that can actually run the chosen
  command, so a speaker's battery sensor doesn't end up as the target." ✗ "Editing
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

- Jeremy tests on the DEV instance first. There is currently one deploy path (dev). The
  two eventual distribution forms — Unraid Community Apps (Docker) and HA addon — do not
  have deploy commands yet. Do not assume a production path exists.
- After ANY change, tell him exactly what to click and what he should SEE/observe — he
  verifies behavior on screen, not code. End every coding task with these steps.
- If a validator/schema script exists, run it after any change that touches piston JSON
  shape, before declaring the task done. Report the result in plain English ("the saved
  piston matches the expected shape" / "it flagged a missing field").
- Syntax-check every JS/Python file you edit (`node --check`, `python -m py_compile`) and
  say plainly whether it passed — don't make Jeremy infer it from the absence of an error.

## Deploy (Unraid — Jeremy runs this, you don't)

```
cd /mnt/user/appdata/pistoncore-dev && git pull && docker build --no-cache -t pistoncore . && docker stop pistoncore && docker rm pistoncore && docker run -d --name pistoncore --restart unless-stopped -p 7777:7777 -v /mnt/user/appdata/pistoncore/userdata:/pistoncore-userdata -v /mnt/user/appdata/pistoncore/customize:/pistoncore-customize pistoncore
```

## Session Close Checklist

1. Summarize: planned task status, detours taken, commits made.
2. Note every open item found, however Jeremy is tracking them.
3. Flag any spec that the session's findings made stale.
4. Remind Jeremy to commit/push via GitHub Desktop if uncommitted work remains.
5. If any deviations from WebCoRE were decided this session, confirm they were added to `HELP_AND_DEVIATIONS_PROTO.md`.
