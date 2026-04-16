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

- **Structured document editor** — logic is always visible top to bottom like a text editor, not hidden in dropdowns and form fields
- **Dynamic condition wizard** — pick a device and see only what that device can actually do, pulled live from your HA instance
- **Device-level picker** — you pick devices the way you think about them, not by hunting through entity IDs
- **Auto-detecting compiler** — simple pistons compile to HA YAML, complex pistons compile to PyScript. Auto-detection is the default with manual override planned for future versions.
- **Your automations are yours** — compiled files are standard HA files. Uninstall PistonCore tomorrow, every piston keeps running forever.
- **Shareable pistons** — plain JSON, paste anywhere, import from a URL. No account required, no central server.
- **Runs locally** — Docker container on Unraid, Raspberry Pi, or any Docker host. Nothing in the cloud.
- **AI-friendly** — the piston JSON format is documented so any AI can generate valid pistons from plain English

---

## Why Both YAML and PyScript?

Simple pistons compile to **YAML** — the format with thousands of YouTube tutorials and a huge HA community. If something breaks or you want to tweak the output, help is easy to find.

Complex pistons compile to **PyScript** — which handles logic that YAML cannot reliably express. Variables, loops, nested conditions, wait-for-state. Most users will never know PyScript exists.

The compiler detects which format to use automatically. Manual override is planned for a future version for users who want explicit control.

---

## Project Status

**Early development — not yet usable.**

The design is complete and development is underway. The repo currently contains:

- `DESIGN.md` — full specification (start here)
- `CLAUDE_SESSION_PROMPT.md` — AI session continuity document
- `session2_archive/` — early scaffolding code from initial development sessions

The project is being built in sessions with AI assistance. Real traffic is already arriving — if you found this repo and want to follow along or contribute, you're early.

---

## Looking for Contributors

PistonCore needs people with:

- **Frontend experience** — especially anyone who has built structured document editors or code-editor-style UIs
- **Python / FastAPI experience** — backend API and compiler work
- **WebCoRE experience** — help ensure the feel and features match what WebCoRE users expect
- **Home Assistant integration experience** — custom integration / HACS experience a plus

If you're interested, open an issue or start a Discussion on GitHub. The full specification is in `DESIGN.md`.

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
