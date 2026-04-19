# Notes for Next Session
# Generated end of Session 5 — April 2026
# These corrections take priority over DESIGN.md v0.7, FRONTEND_SPEC v0.1, and WIZARD_SPEC v0.1
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

The status page in WebCoRE shows the piston script in read-only form — the same visual
document the editor shows, rendered with syntax highlighting and line/statement numbers.

This is NOT compiled output (Groovy/YAML/PyScript). It is PistonCore's own visual format
rendered read-only. Compiled YAML/PyScript remains hidden — that decision is still correct.

Update DESIGN.md Section 7 status page and FRONTEND_SPEC to add read-only script view
to the status page below the action buttons and quick facts panels.

---

### 3. execute / end execute — Missing Keyword Wrapping Action Tree

The entire action tree is wrapped in an `execute` / `end execute;` block.
This is a top-level keyword at the same level as `define` and `settings`.

Correct document structure order:
1. Comment header (piston name, author, created, modified, build, version, import code)
2. `settings` / `end settings;` — only shown when non-empty, omit when empty
3. `define` / `end define;` — piston variables, only shown when variables exist
4. Comments (user-added section comments like `/* Check for Smoke */`)
5. `execute` — starts the action tree
6. [all action statements indented inside]
7. `end execute;` — closes the action tree

Add `execute` / `end execute;` to FRONTEND_SPEC document structure and DESIGN.md Section 6.

---

### 4. if/then/end if — Saved Format vs Editor Display Format

Two different views of the same structure:

EDITOR DISPLAY (while building — what user sees):
```
if
  [condition]
  {
    when true
      [statements]
    when false
      [statements]
  }
```

SAVED/EXPORT FORMAT (serialized piston, status page read-only view):
```
if
  [condition]
then
  [statements]
end if;
```

Both specs are correct for their context:
- FRONTEND_SPEC editor view: uses when true / when false with braces — correct
- JSON save format and status page read-only view: uses if/then/end if — correct

Document this distinction explicitly in both FRONTEND_SPEC and DESIGN.md.
The editor renders one way. The saved format and read-only view render another way.

---

### 5. repeat / until / end repeat Structure

The repeat block uses an `until` keyword for the termination condition.
This was missing from the spec.

Correct structure:
```
repeat
do
  [statements]
until
  [condition]
end repeat;
```

The `until` condition appears at the bottom of the repeat block, not the top.
Add `until` to FRONTEND_SPEC statement types and DESIGN.md Section 6.5 / Section 21.

---

### 6. AND / OR Between Conditions — Indentation

The `and` and `or` keywords between conditions appear at the same indent level
as the conditions themselves, not indented further.

Example from screenshot:
```
if
  Any of (@Smoke_Detectors)'s smoke changes to clear
  and
  All of (@Smoke_Detectors)'s smoke are clear
then
```

Update FRONTEND_SPEC rendering rules to show AND/OR at condition indent level.

---

### 7. Trace Numbers Are Statement Numbers Not Line Numbers

Trace numbers appear as comments in the script: `/* #1 */`, `/* #2 */` etc.
These are statement-level numbers assigned to each statement when the piston is built.
They are NOT line numbers of the rendered document.

Each statement gets a number regardless of how many visual lines it occupies.
The Trace overlay matches log entries to these statement numbers.

Update DESIGN.md Section 15 and FRONTEND_SPEC to clarify statement numbers vs line numbers.

---

### 8. settings / end settings Block

The settings block exists in WebCoRE but only appears when non-empty.
In the screenshot piston it was omitted entirely because it was empty.

For PistonCore v1: research what goes in the settings block before implementing.
Do not implement settings block until its contents are defined.
Add as an open item in DESIGN.md.

---

### 9. Comment Header Block

The piston script begins with a comment header block containing:
- Piston name
- Author
- Created date
- Modified date  
- Build number
- UI version
- Import code (for PistonCore this will be different — see note below)

PistonCore equivalent: replace the import code line with the piston ID and a note
that the piston can be exported via Snapshot or Backup buttons.

Add comment header block to FRONTEND_SPEC document structure.

---

### 10. Sharing — JSON Not Short Code

WebCoRE's short alphanumeric import code (e.g. "ojccy") requires a central server,
expires, and cannot be used by AI assistants.

PistonCore deliberately uses JSON for sharing. This is a confirmed improvement over
WebCoRE's approach. No change needed to the design — just document the reason clearly
in DESIGN.md so future contributors understand why we diverged from WebCoRE here.

Add a note to DESIGN.md Section 10 (Export and Import) explaining this decision.

---

## OPEN ITEMS STILL UNRESOLVED

These were not resolved this session and remain blockers:

1. **Editor save pipeline** — what happens step by step between Save and landing on
   status page. What does the user see during save. What happens if save fails partway.
   Define before coding the save flow.

2. **Compiler template system** — format, file location on Docker volume, how placeholders
   work, what "user replaceable" means in practice. Do not write compiler code until defined.

3. **globals.json sandbox validation** — requires a running PyScript/HA environment to test
   which of the three fallback solutions works. Cannot be resolved in a design session.

4. **settings / end settings block contents** — what goes in it. Research needed.

5. **AI Prompt feature redesign** — needs more thought before implementation.

---

## SESSION 5 ACCOMPLISHMENTS

- DESIGN.md updated to v0.7 and pushed to repo
- FRONTEND_SPEC.md v0.1 written and pushed to repo  
- WIZARD_SPEC.md v0.1 written and pushed to repo
- Frontend technology confirmed: vanilla JS, HTML, CSS
- Drag and drop rules defined: within-block reorder only, cut/paste for cross-block
- Statement tree data structure defined
- Wizard capability map defined (closes DESIGN.md Section 8.1)
- Lightning bolt trigger/condition distinction defined
- No-trigger upgrade flow defined
- WebCoRE screenshots reviewed — corrections documented above

---

*Session 5 — April 2026*
