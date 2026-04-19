# Notes for Next Session
# Generated end of Session 5 — April 2026
# These corrections and decisions take priority over DESIGN.md v0.7, FRONTEND_SPEC v0.1, and WIZARD_SPEC v0.1
# Produce v0.8 / v0.2 updates at start of next session before any coding

---

## CONFIRMED CORRECTIONS FROM WEBCORE SCREENSHOTS

### 1. Piston List Layout — Single Column Not Two Column

FRONTEND_SPEC v0.1 shows a two-column layout with a folder sidebar on the left.
WebCoRE uses a single scrolling list with folder names as inline section headers/dividers.

Correct design:
- Single scrolling list
- Folder name in teal/colored text as a section header with piston count: "Security (12)"
- Pistons listed under their folder header
- No sidebar column
- Last run time shown on the right (time only — "08:46:25" not "10 minutes ago")
- true/false state shown inline next to piston name

Update FRONTEND_SPEC v0.2 to reflect this layout.

---

### 2. Status Page Shows Piston Script — Not Compiled Output

The status page shows the piston script in read-only form — the same visual document
the editor shows, rendered with syntax highlighting and statement numbers.

This is NOT compiled output (Groovy/YAML/PyScript). It is PistonCore's own visual format
rendered read-only. Compiled YAML/PyScript remains hidden — that decision is still correct.

Update DESIGN.md Section 7 status page and FRONTEND_SPEC to add read-only script view
to the status page below the action buttons and quick facts panels.

---

### 3. execute / end execute — Missing Keyword Wrapping Action Tree

The entire action tree is wrapped in an execute / end execute; block.
This is a top-level keyword at the same level as define and settings.

Correct document structure order:
1. Comment header (piston name, author, created, modified, build, version, piston ID)
2. settings / end settings; — only shown when non-empty, omit when empty
3. define / end define; — piston variables, only shown when variables exist
4. Section comments (user-added comments)
5. execute — starts the action tree
6. [all action statements indented inside]
7. end execute; — closes the action tree

Note on comment header: WebCoRE used a short alphanumeric import code in the header.
PistonCore uses the piston ID instead. Sharing is done via Snapshot/Backup export, not
a central-server short code. Document this deliberate divergence in DESIGN.md Section 10.

---

### 4. if/then/end if — Two Views of the Same Structure

EDITOR DISPLAY (while building):
  if
    [condition]
    {
      when true
        [statements]
      when false
        [statements]
    }

SAVED/EXPORT FORMAT (status page read-only view, green camera export):
  if
    [condition]
  then
    [statements]
  end if;

Both specs are correct for their context. Document this distinction explicitly in both
FRONTEND_SPEC and DESIGN.md.

---

### 5. repeat / until / end repeat Structure

The until condition appears at the BOTTOM of the repeat block, not the top.

  repeat
  do
    [statements]
  until
    [condition]
  end repeat;

Add until to FRONTEND_SPEC statement types and DESIGN.md Section 6.5 and Section 21.

---

### 6. AND / OR Between Conditions — Indentation

The and and or keywords appear at the same indent level as the conditions themselves.

  if
    Any of (@Smoke_Detectors)'s smoke changes to clear
    and
    All of (@Smoke_Detectors)'s smoke are clear
  then

---

### 7. Trace Numbers Are Statement Numbers Not Line Numbers

Trace numbers are statement-level numbers assigned when the piston is built.
They appear as comments: /* #1 */ /* #2 */ etc.
Each statement gets one number regardless of how many visual lines it occupies.
They are NOT document line numbers.

---

### 8. settings / end settings Block

Exists in WebCoRE but only shown when non-empty — omit entirely when empty.
Contents not yet defined for PistonCore. Do not implement until defined.
Add as an open item in DESIGN.md.

---

## NEW DESIGN DECISIONS — SESSION 5

### 9. Editor Save Pipeline — Confirmed Flow

1. Frontend validates piston has a name — if empty stop and highlight the field
2. Frontend sends piston JSON to backend via POST
3. Save button shows loading state: "Saving..."
4. Backend writes piston JSON to Docker volume
5. Backend runs Stage 1 internal validation
6. Backend returns success or failure plus any validation warnings
7. If success — navigate to status page, warnings appear in banner if any
8. If write fails — stay in editor, show error banner: "Save failed — your work is preserved. Try again."

Save does not touch HA at all. Deploy is a separate action.

---

### 10. Validation on Docker — No HA Dependency

| Stage | What runs | Where | Catches |
|---|---|---|---|
| 1 | PistonCore internal checks | Docker | Missing triggers, undefined globals, unmapped roles |
| 2 | py_compile or yamllint | Docker | Syntax errors |
| 3 | Stub mock import (PyScript) | Docker | Reference errors, basic logic |
| 4 | HA check_config (YAML, optional) | HA via companion | HA semantic errors — only if companion installed |

Stage 4 is optional. For PyScript, Stage 4 is dropped entirely.

---

### 11. Validation Rules File — Updateable Without Code Changes

Lives in /pistoncore-customize/validation-rules/
Two files: internal-checks.json and error-translations.json
Edit the file, restart the container — no code changes needed.
Community can contribute error translations via pull requests.
Full format documented in DESIGN.md v0.8.

---

### 12. Docker Volume Folder Structure — Confirmed Design

Two top-level folders. Names are self-explanatory without reading documentation.

/pistoncore-userdata/               YOUR DATA — pistons, globals, settings
  pistons/                          your piston JSON files
  globals.json                      your global variables
  device-definitions/               your custom device definitions
  config.json                       your PistonCore settings
  logs/
    pistoncore.log

/pistoncore-customize/              CUSTOMIZE PISTONCORE — templates, rules
  compiler-templates/
    yaml/
      automation.yaml.j2            Jinja2 template for simple pistons
      AI-UPDATE-GUIDE.md            paste into any AI to update YAML templates
      README.md
    pyscript/
      piston.py.j2                  Jinja2 template for complex pistons
      ha-stubs.py                   mock HA objects for Docker validation
      AI-UPDATE-GUIDE.md            paste into any AI to update PyScript templates
      README.md
  validation-rules/
    internal-checks.json            what PistonCore checks and error messages
    error-translations.json         plain English explanations for raw errors
    AI-UPDATE-GUIDE.md              paste into any AI to update validation rules
    README.md
  README.md                         explains the two folder system in plain English

Default file behavior: container ships with defaults, copies them to volume on first
launch only if files do not already exist. Container updates never overwrite user files.

---

### 13. AI-UPDATE-GUIDE.md — One Per Template Folder

Purpose: anyone pastes the guide into any AI and describes what they want changed.
The AI has everything needed to produce a valid updated file without asking questions.
Scoped to that folder only — nothing about other folders.
Makes maintenance independent of project maintainers.
Community members can update templates when HA changes, submit pull requests.

Cannot be written until compiler template system is designed — next session item.

Contents (once compiler is designed):
- What this folder contains and what it controls
- Input data format relevant to this template
- Template format and available placeholders
- Rules the output must follow
- Worked example: input to template to output
- What not to change
- How to test the change

---

## OPEN ITEMS — STILL UNRESOLVED (Blocking Coding)

1. Compiler template system — format, placeholders, how compiler walks the piston tree
   Must be designed before templates, AI guides, or compiler code can be written

2. settings / end settings block contents — research WebCoRE behavior before implementing

3. globals.json sandbox validation — requires running PyScript/HA environment to confirm
   which fallback solution works (task.executor, hass.data cache, or PyScript module)

4. AI Prompt feature redesign — copy format spec only produces generic output
   Needs friendly name context without exposing entity IDs. See DESIGN.md Section 11.

---

## SESSION 5 ACCOMPLISHMENTS

- DESIGN.md updated to v0.7 and pushed to repo
- FRONTEND_SPEC.md v0.1 written and pushed to repo
- WIZARD_SPEC.md v0.1 written and pushed to repo
- Frontend technology confirmed: vanilla JS, HTML, CSS
- Drag and drop rules defined: within-block reorder only, cut/paste for cross-block
- Statement tree data structure defined
- Wizard capability map defined — closes DESIGN.md Section 8.1
- Lightning bolt trigger/condition distinction defined
- No-trigger upgrade flow defined
- WebCoRE screenshots reviewed — 8 corrections documented above
- Editor save pipeline defined
- Docker validation approach defined — no HA dependency
- Validation rules file design defined — updateable without code changes
- Docker volume folder structure defined — two folders, self-explanatory names
- AI-UPDATE-GUIDE.md concept defined — one per template folder, community maintainable
- Compiler template format confirmed: Jinja2

---

## NEXT SESSION AGENDA — IN PRIORITY ORDER

1. Read DESIGN.md v0.7, FRONTEND_SPEC.md, WIZARD_SPEC.md, and this notes file
2. Produce DESIGN.md v0.8 and FRONTEND_SPEC v0.2 incorporating all corrections above
3. Design the compiler template system — remaining structural blocker
4. Write AI-UPDATE-GUIDE.md files once compiler is designed
5. Update CLAUDE_SESSION_PROMPT.md
6. Begin backend scaffolding if all design blockers are resolved

Do not write production code until items 3 and 4 are complete.

---

Session 5 — April 2026
Sources: WebCoRE screenshots, design review, session discussion
