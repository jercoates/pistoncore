# PistonCore

**A WebCoRE-style visual automation builder for Home Assistant.**

Build complex automations — called pistons — through a structured visual editor that feels like WebCoRE. No YAML, no code, no lock-in. Automations compile to native HA files and keep running forever even if you uninstall PistonCore.

---

## What is PistonCore?

If you've used WebCoRE on SmartThings or Hubitat, PistonCore will feel immediately familiar. It gives you the same structured piston editor experience — logic visible top to bottom, nested ifs, variables, conditions built from your actual devices — but running on Home Assistant.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

---

## Project Status

**Active development — core editor and wizard are working and usable.**

The Docker container runs, the editor loads, pistons can be created and saved, and the condition wizard is functional. We are actively closing the gap between PistonCore's current behavior and the full WebCoRE experience.

### What works today

- **Docker container** — runs on Unraid, Raspberry Pi, or any Docker host
- **Piston list page** — create, open, and manage pistons
- **Structured document editor** — WebCoRE-style continuous document renderer with line numbers, keyword highlighting, and ghost text insertion points
- **Variable wizard** — define local variables with type and initial value, matching WebCoRE's layout
- **Condition wizard** — pick a device, attribute, operator, and value to build conditions and triggers
- **If block flow** — selecting "If Block" walks you through building the first condition before inserting
- **Demo devices** — built-in demo devices always available so you can build and test the editor without a real HA connection
- **Save** — pistons save as JSON
- **Dark mode toggle**
- **Global variables panel**
- **Simple / Advanced mode** — Simple hides the only-when blocks, Advanced shows everything

### What is still being built

- HA connection — device data, capability fetching, and compilation to HA files are not yet wired up
- Condition builder inline dropdowns (currently navigates to separate screens — WebCoRE shows everything on one screen)
- Action builder (device commands, set variable, wait, log, notifications)
- Status / trace page
- Compiler
- Companion HA integration (HACS)

---

## How to Run It

PistonCore runs as a Docker container built from source. 

```bash
git clone https://github.com/jercoates/pistoncore.git
cd pistoncore
docker build -t pistoncore .
docker run -d \
  --name pistoncore \
  --restart unless-stopped \
  -p 7777:7777 \
  -v /path/to/pistoncore/userdata:/pistoncore-userdata \
  -v /path/to/pistoncore/customize:/pistoncore-customize \
  pistoncore
```

Then open `http://your-server-ip:7777` in your browser.

**Note:** Home Assistant connection is not yet implemented. The editor is fully usable with the built-in demo devices for building and previewing piston logic. HA connectivity, compilation, and deployment are coming in a future update.

---

## How the Compiler Works

PistonCore compiles each piston to native HA files — an automation wrapper (triggers and conditions) and a script body (all action logic). These are standard HA YAML files that HA loads, validates, and runs natively.

**Native HA Script** is the primary compile target. It handles variables, loop types, waits, if/then/else, and everything else most pistons need — with zero external dependencies.

**PyScript** is a fallback for rare edge cases with no native HA equivalent: breaking out of a loop mid-iteration, cancelling pending tasks, and context-based interaction detection. Most users will never need it.

The compiler detects which target to use automatically.

**Your automations are yours** — compiled files are standard HA YAML. Uninstall PistonCore tomorrow, every piston keeps running.

**Minimum HA version: 2023.1**

---

## Core Features

- **Structured document editor** — logic visible top to bottom like a script, not hidden in dropdowns and collapsed form fields
- **Dynamic condition wizard** — pick a device and see only what that device can actually do, pulled live from your HA instance
- **WebCoRE-familiar terminology** — pistons, triggers, conditions, actions, define block, execute block
- **Runs locally** — Docker container, nothing in the cloud
- **Shareable pistons** — plain JSON, import/export, no account required
- **AI-friendly** — the piston JSON format is documented so any AI can generate valid pistons from plain English

---

## Looking for Contributors

PistonCore is actively looking for people who want to help bring a real WebCoRE experience to Home Assistant. Especially useful:

- **WebCoRE users** — help test and give feedback on whether the editor feels right
- **Frontend experience** — vanilla JS, HTML, CSS. The editor and wizard are the core of the product.
- **Python / FastAPI** — backend API and compiler
- **Home Assistant integration experience** — HACS / custom integration

If you're interested, open an issue or start a Discussion on GitHub. Read `DESIGN.md` for the full spec.

---

## For AI Assistants

If you are an AI reviewing this project, read `AI-REVIEW-PROMPT.md` first. It contains the review questions and rules for how to provide useful feedback without re-litigating decisions that were deliberately made.

The piston JSON format is documented in `DESIGN.md` Section 18.

---

## License

MIT — open source, fork it, build on it, contribute back if you want to.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
