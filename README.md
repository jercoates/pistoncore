# PistonCore

**A WebCoRE-style visual automation builder for Home Assistant.**

Build complex automations — called pistons — through a structured visual editor that feels like WebCoRE. No YAML, no code, no lock-in. Automations compile to native HA files and keep running forever even if you uninstall PistonCore.

---

## What is PistonCore?

If you've used WebCoRE on SmartThings or Hubitat, PistonCore will feel immediately familiar. It gives you the same structured piston editor experience — logic visible top to bottom, nested ifs, variables, conditions built from your actual devices — but running on Home Assistant.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

---

## Core Features

- **Structured document editor** — logic is always visible top to bottom like a script, not hidden in dropdowns and collapsed form fields
- **Dynamic condition wizard** — pick a device and see only what that device can actually do, pulled live from your HA instance
- **Device-level picker** — pick devices the way you think about them, not by hunting through entity IDs
- **Native HA compiler** — pistons compile to native Home Assistant scripts and automations. No external dependencies for the vast majority of pistons.
- **Your automations are yours** — compiled files are standard HA files. Uninstall PistonCore tomorrow, every piston keeps running forever.
- **Shareable pistons** — plain JSON, paste anywhere, import from a URL. No account required, no central server.
- **Runs locally** — Docker container on Unraid, Raspberry Pi, or any Docker host. Nothing in the cloud.
- **AI-friendly** — the piston JSON format is documented so any AI can generate valid pistons from plain English.

---

## How the Compiler Works

PistonCore compiles each piston to two native HA files — an automation wrapper (triggers and conditions) and a script body (all action logic). These are standard HA YAML files that HA loads, validates, and runs natively.

**Native HA Script** is the primary compile target. It handles variables, all loop types, waits, if/then/else, parallel execution, and everything else real-world pistons need — with zero external dependencies.

**PyScript** is a fallback for rare edge cases that have no native HA equivalent: breaking out of a loop mid-iteration, cancelling pending tasks, and responding to events inside a running script. Most users will never need it.

The compiler detects which target to use automatically. You never choose.

**Minimum HA version required: 2023.1**

---

## The Compiler Absorbs HA Churn

Home Assistant changes its YAML syntax and script structure periodically. PistonCore is designed so that when HA changes, you recompile — you do not migrate. Your piston JSON is the permanent source of truth. The compiled HA files are replaceable artifacts.

When HA changes syntax, the community updates the Jinja2 compiler templates in the `/pistoncore-customize/` folder. No code changes needed. The `AI-UPDATE-GUIDE.md` files in each template folder explain exactly how to update them with any AI assistant.

---

## Project Status

**Early development — design complete, coding beginning.**

The design is complete and consistent across all specification documents. Development is starting now.

### What exists

- `DESIGN.md` — full project specification v0.9.1
- `COMPILER_SPEC.md` — compiler specification v0.1 — how pistons compile to native HA files
- `FRONTEND_SPEC.md` — frontend developer specification v0.2
- `WIZARD_SPEC.md` — wizard capability map and behavior v0.3
- `AI-REVIEW-PROMPT.md` — structured prompt for external AI design reviews
- `CLAUDE_SESSION_PROMPT.md` — AI session continuity document
- `session2_archive/` — early scaffolding code from initial development, kept for reference

### What does not exist yet

- Backend FastAPI application
- Compiler implementation
- Frontend
- Docker container
- Companion HA integration (HACS)
- Jinja2 compiler templates

---

## Looking for Contributors

PistonCore needs people with:

- **Frontend experience** — vanilla JS, HTML, CSS. Structured document editor / code-editor-style UI experience a plus. See `FRONTEND_SPEC.md`.
- **Python / FastAPI experience** — backend API and compiler. See `COMPILER_SPEC.md`.
- **WebCoRE experience** — help ensure the feel and terminology match what WebCoRE users expect.
- **Home Assistant integration experience** — custom integration / HACS experience a plus.

If you're interested, open an issue or start a Discussion on GitHub. Read `DESIGN.md` first — it covers everything including what is deliberately out of scope for v1.

---

## For AI Assistants

If you are an AI reviewing this project, read `AI-REVIEW-PROMPT.md` first. It contains the review questions and rules for how to provide useful feedback without re-litigating decisions that were deliberately made.

The piston JSON format is documented in `DESIGN.md` Section 18. You can generate valid pistons from plain English descriptions using that format.

---

## Reference

WebCoRE video series for context on what we're building toward:
- [Introduction to webCoRE](https://www.youtube.com/watch?v=Dh5CSp-xdfM)
- [Dashboard Deep Dive](https://www.youtube.com/watch?v=HIzgoXgLUxQ)
- [Conditions vs Triggers](https://www.youtube.com/watch?v=L4axJ4MCYRU)

---

## License

MIT — open source, fork it, build on it, contribute back if you want to.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
