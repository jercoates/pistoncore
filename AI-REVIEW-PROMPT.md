# PistonCore — External AI Review Prompt

Use this prompt when asking any AI (Grok, Gemini, Perplexity, ChatGPT, etc.) to review
the PistonCore design. Paste this entire file, or give the AI repo access and reference it.

---

## What PistonCore Is

PistonCore is an open-source WebCoRE-style visual automation builder for Home Assistant.
Users build automations called "pistons" through a structured UI. PistonCore compiles those
pistons to native Home Assistant YAML files that run permanently and independently.

The project has four specification documents in the repo:
- DESIGN.md — full project design and philosophy
- COMPILER_SPEC.md — how pistons compile to native HA scripts and automations
- WIZARD_SPEC.md — the capability-driven multi-step wizard that builds pistons
- FRONTEND_SPEC.md — the three-page UI spec for the frontend developer

Please read all four before responding.

---

## What I Want From You

This is a **technical review session only**. I am not asking you to redesign anything.
I am not asking for feature suggestions. I am asking you to find problems with what is
already designed.

Answer only these questions. Be specific. If you cannot find a problem with something,
say so — do not invent issues to seem thorough.

---

## The Three Standing Questions (answer these for every review)

**Question 1 — What technical assumptions in this design are most likely to be wrong?**

Focus on assumptions about:
- How Home Assistant actually behaves at runtime
- How the HA WebSocket API actually responds
- How native HA scripts actually execute
- How the companion integration can actually interact with HA

Do not flag philosophical or UI assumptions — those are deliberate choices.
Only flag things that could cause the compiled output to fail or the wizard to show wrong data.

**Question 2 — What features described here cannot work the way they are described?**

Look for descriptions where the proposed implementation is technically impossible or
would require something not available in the current HA ecosystem. Be specific about
which section and why it cannot work as written.

**Question 3 — What has been left undefined that will block a developer from writing code?**

A developer is about to start implementing the native HA script compiler
(COMPILER_SPEC.md) and the wizard backend (WIZARD_SPEC.md). What information is
missing that they would need to look up or guess at before they could write a single
line of working code?

---

## The Compiler-Specific Question (answer this every review)

**Question 4 — Review COMPILER_SPEC.md specifically.**

For each statement type defined in Section 8, confirm whether the compiled HA YAML
output is correct for current Home Assistant (2023.1+). Flag any statement type where:
- The compiled YAML syntax is wrong or outdated
- The HA behavior differs from what the spec assumes
- There is a known edge case the spec does not account for

Pay particular attention to:
- Variable scope inside loops (Section 8.9)
- The wait_for_trigger approach for "wait until time" (Section 8.2)
- The binary sensor on/off compiled value rule (Section 11)
- How the completion event fires if a script action fails mid-run (Section 12)

---

## Rules for Your Response

1. **Validate HA-specific claims before asserting them.** If you are not certain how HA
   behaves in a specific situation, say so rather than asserting confidently.

2. **Do not suggest adding things back that were deliberately removed.** The design
   deliberately excludes: Full Mode YAML setup complexity, PyScript as the primary target,
   React frontend, central server, WebCoRE piston import, and helper-based YAML compilation.
   These are not oversights — they are documented decisions.

3. **Do not suggest features for v2.** The out-of-scope list is in DESIGN.md Section 22.
   If something is already listed there, do not re-raise it.

4. **Be specific.** Reference the section number and the exact claim you are questioning.
   Vague feedback ("the wizard seems complex") is not useful.

5. **Separate confirmed problems from suspicions.** Use clear language:
   - "This will definitely fail because..." — for confirmed problems
   - "This may fail if..." — for suspected problems worth investigating
   - "I am not certain whether..." — for things you cannot confirm

---

## What This Project Is NOT Looking For

- Suggestions to use a different frontend framework
- Suggestions to add a cloud service or central server
- General architecture opinions not grounded in a specific technical problem
- UI/UX redesign suggestions
- Comparisons to other automation tools

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant,
Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
