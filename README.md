# PistonCore

**A WebCoRE-style visual automation builder for Home Assistant.**

Build complex automations — called pistons — through a structured visual editor that feels like WebCoRE. No YAML, no code, no lock-in. Automations compile to native HA files and keep running forever even if you uninstall PistonCore.

---

## What is PistonCore?

If you've used WebCoRE on SmartThings or Hubitat, PistonCore will feel immediately familiar. It gives you the same structured piston editor experience — logic visible top to bottom, nested ifs, variables, conditions built from your actual devices — but running on Home Assistant.

**PistonCore is not a home automation platform. It is a tool for building automations on top of one.**

It reads what HA already has, gives you a better way to write logic against it, and compiles that logic to native HA files that run permanently and independently.

---

## Two Ways to Install

### Home Assistant Addon (recommended)

For HA OS and HA Supervised users. Two-click install — no Docker knowledge needed.

> **Status: Coming soon.** Addon packaging is underway. The core editor and compiler are being built and validated first.

1. Add the PistonCore addon repository URL to your HA addon store
2. Install like any other addon
3. Open the PistonCore UI from the HA sidebar
4. Start building pistons

No companion integration needed. No HACS required for the addon itself. PistonCore gets a supervisor token automatically — you don't enter anything.

### Docker Container (for power users)

For Unraid, NAS, any Docker host, or Docker-based HA installs.

> **Status: In active development.** Core editor and wizard are working. HA compilation and deployment are being wired up.

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

Enter your HA URL and a long-lived access token in PistonCore settings. That's it.

**Running HA in Docker?** The Docker version works for you — same token approach, same REST API. The addon requires a supervisor, which Docker HA installs don't have.

---

## Feature Comparison

| Feature | Addon | Docker |
|---|---|---|
| Install method | HA addon store | Docker Hub / build from source |
| HA auth | Automatic (supervisor token) | Long-lived token in settings |
| Simple pistons → Native HA YAML | ✅ | ✅ |
| Complex pistons → PyScript | ✅ v1 | ✅ Permanent |
| Complex pistons → Native runtime | ✅ v2 (planned) | — |
| Requires HACS | Only for complex pistons (PyScript) | Only for complex pistons (PyScript) |
| Requires companion integration | ❌ | ❌ |
| Shareable piston JSON | ✅ | ✅ |
| Community-editable compiler templates | ✅ | ✅ |
| Minimum HA version | 2023.1 | 2023.1 |

**Docker is not a lite version.** Docker users get the same editor, the same compiler, the same piston format, and the same features. Complex pistons compile to PyScript permanently on Docker — no deprecation planned. The only thing Docker doesn't get is the v2 native runtime engine, which addon users get in a future update.

---

## What Works Today

- **Piston list page** — create, open, and manage pistons
- **Structured document editor** — WebCoRE-style continuous document renderer with keyword highlighting, indentation, and ghost text insertion points
- **Variable wizard** — define local variables with type and initial value
- **Condition wizard** — pick a device from your live HA instance, pick an attribute, pick an operator, set a value
- **If block flow** — walks you through building the first condition before inserting the block
- **Demo devices** — built-in demo devices so you can build and test without a real HA connection
- **Real HA connection** — live devices loading from your HA via WebSocket
- **Save** — pistons save as JSON
- **Simple / Advanced mode** — Simple hides the only-when blocks, Advanced shows everything (default: Advanced)
- **Dark mode toggle**

## What Is Being Built Now

- Compilation to native HA YAML (deploy to HA)
- Action builder (device commands, set variable, wait, log, notifications)
- Status / trace page with run log
- Test Compile preview
- PyScript detection and setup prompt

---

## How the Compiler Works

PistonCore compiles each piston to native HA files based on what the piston needs.

**Simple pistons (~95%)** compile to a native HA automation + script pair — standard YAML that HA loads, validates, and runs natively. Zero external dependencies.

**Complex pistons** compile to a PyScript `.py` file. Complex means: breaking out of a loop mid-iteration, cancelling pending tasks in flight, or context-based interaction detection. Most users will never build a complex piston.

The compiler detects which target to use automatically. You never choose.

**Your automations are yours** — compiled files are standard HA files. Uninstall PistonCore tomorrow and every piston keeps running, as long as the relevant runtime (native HA scripts or PyScript) remains installed.

**Minimum HA version: 2023.1**

---

## Piston JSON Format

Pistons are stored as plain JSON. The format is stable and fully documented in `DESIGN.md` Section 6. You can share pistons as a forum post, a GitHub Gist, or any text format. Import from a URL or paste directly. No account or server required.

The same piston JSON works on both addon and Docker installs. The compiler picks the right output target based on piston complexity and deployment type — the JSON itself never changes.

---

## Complex Pistons and PyScript

Complex pistons require PyScript, a free HACS integration. PistonCore detects whether PyScript is installed before allowing you to deploy a complex piston, and shows a clear setup prompt if it's not found.

For addon users: in a future v2 update, complex pistons will run on PistonCore's own built-in runtime engine, and PyScript will no longer be needed for the addon.

For Docker users: PyScript is the permanent solution for complex pistons. It's a one-time install and works reliably.

---

## Core Features

- **Structured document editor** — logic visible top to bottom like a script
- **Dynamic condition wizard** — pick a device and see only what that device can actually do, pulled live from HA
- **WebCoRE-familiar terminology** — pistons, triggers, conditions, actions, define block, execute block
- **Runs locally** — no cloud, no account, nothing phoning home
- **Shareable pistons** — plain JSON, import/export from anywhere
- **AI-friendly** — the piston JSON format is documented so any AI can generate valid pistons from plain English
- **Community-editable compiler templates** — Jinja2 templates stored in your customize volume, updateable without a PistonCore release

---

## Looking for Contributors

PistonCore is actively looking for people who want to help bring a real WebCoRE experience to Home Assistant. Especially useful:

- **WebCoRE users** — test and give feedback on whether the editor feels right
- **Frontend experience** — vanilla JS, HTML, CSS. The editor and wizard are the core of the product.
- **Python / FastAPI** — backend API and compiler
- **Home Assistant addon experience** — addon packaging and ingress

If you're interested, open an issue or start a Discussion on GitHub. Read `DESIGN.md` for the full spec.

---

## For AI Assistants

**Read this section before reading anything else in the repo.**

### What this project is

PistonCore is a visual automation builder for Home Assistant. It compiles user-built pistons (stored as JSON) to native HA YAML automations or PyScript files. The editor is vanilla JS/HTML/CSS. The backend is Python FastAPI. There is no framework, no build pipeline.

### Closed decisions — do not relitigate these

* **AppDaemon is ruled out** for the v2 runtime. Decision is closed. See DESIGN.md Section 27.
* **Simple pistons compile to native HA YAML permanently.** Routing simple pistons through PistonCore's runtime is not the plan. See DESIGN.md Section 3.1.
* **PyScript is permanent for Docker users.** It is only deprecated for the addon target in v2.
* **No HACS companion integration.** PistonCore writes to HA directly via REST API.
* **Frontend never calls HA directly.** All HA communication goes through the backend. This is a security invariant.
* **BASE_URL must be used for all frontend connections.** No hardcoded paths anywhere in JS.

### Core invariants — never break these

* Every piston has a UUID that never changes, even on rename
* All HA artifact names derive from UUID — never from piston name
* `logic_version` and `ui_version` are separate fields in piston JSON — not a single `schema_version`
* The compile target boundary (what forces PyScript) lives in `pistoncore-customize/compiler/target-boundary.json` — not hardcoded in Python
* Entity IDs are never shown to the user in any screen

### Where everything lives

| What | Where |
|---|---|
| Full architecture and all design decisions | `DESIGN.md` |
| Frontend implementation spec | `FRONTEND_SPEC.md` |
| Wizard capability map and operator lists | `WIZARD_SPEC.md` |
| Compiler spec | `COMPILER_SPEC.md` ⚠ stale — needs update before compiler work |
| Piston JSON format | `DESIGN.md` Section 6 |
| Compiler context object | `DESIGN.md` Section 14 |
| Volume and file structure | `DESIGN.md` Section 26 |
| AI instruction files for each customize folder | See each folder's `AI-UPDATE-GUIDE.md` |

### Before writing any code or spec

Read `DESIGN.md` Section 32 (Standing Questions and Validation Workflow). Any HA behavior assumption must be validated against real HA docs before being written into a spec or implemented. Other AIs can be confidently wrong about HA-specific behavior.

### External review AIs

Read `AI-REVIEW-PROMPT.md` for the review questions and rules on how to provide useful feedback.

---

## License

MIT — open source, fork it, build on it, contribute back if you want to.

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
