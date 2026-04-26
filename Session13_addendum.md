# Session 13 Addendum — Wizard Build Notes
From NotebookLM YouTube analysis + Claude review

---

## Two Things That MUST Be In The Wizard From Day One

### 1. "Stays" Duration Row
When the user picks a "stays"-type operator (e.g. "stays inactive", "did not change"),
a secondary input row appears immediately below the operator:

  "In the last..." → [Value type dropdown] | [number input] | [unit dropdown: minutes/hours/days]

This is critical for motion light pistons — the most common real-world use case.
Do not add this later. Build it into the condition wizard from the start.

### 2. $sunrise / $sunset With Offset
When the user picks a time variable as the value, an offset row appears:

  [+ / -] [number input] [minutes / hours]

Example result: "$sunset + 30 minutes"
These are system variables and must appear in the value picker alongside
$now, $time, $date, $datetime.

---

## Confirmed Flow — Complete Piston Build Sequence

For Claude to understand the full user journey:

1. Click "+ New" → modal → "Create blank piston" → goes to EDITOR
2. In editor: name the piston (toolbar input)
3. Click "· add a new trigger or condition" → wizard opens
   - Pick Condition vs Group
   - Pick device + attribute + operator
   - If "stays" operator: duration row appears
   - If time value: offset row appears
   - Add / Add more / Back
4. Click "· add a new statement" → statement type picker (card grid)
   - Pick "If Block" → adds if/then/else structure to document
   - Pick "Action" → device picker → command picker → task wizard
5. Click "· add a new statement" inside then/else → add actions there
6. Stack more if blocks below end if; for multiple independent scenarios
7. Save → goes to status page

---

## UI Toggles — WebCoRE Had Three, We Have One
WebCoRE toolbar had separate show/hide toggles for:
- Variables (define block)
- Complex Ifs (else if blocks)
- Restrictions (only when blocks)

We combined these into Simple / Advanced toggle.
Simple = hides variables and restrictions
Advanced = shows everything
This is fine — do not change it.

---

## Status Page — Next Execution Timer (V2, Not Now)
When a piston has a time-based trigger, WebCoRE showed a countdown
to when it would next fire. This requires backend calculation.
Note it, do not build it in Session 13.

---

## What NotebookLM Got Wrong — Ignore These
- "Restore from backup code" — we use files only, no codes
- "Author name in setup window" — name lives in editor toolbar, no separate setup window
- "Evaluation console" — that is the trace view, planned but not Session 13
