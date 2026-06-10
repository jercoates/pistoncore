Yes — some prior projects have relevant code, but limited for your specific needs. Here's a focused breakdown:
Most Relevant Projects & Code Value

Shortumation (asosnovsky/Shortumation) — The closest prior attempt.
Relevance: It was a visual automation UI for HA with some block-style elements inspired by Node-RED. The repo has frontend code for visualization, automation management, and HA integration.
What you can learn: How it handled device/service discovery, YAML generation, and add-on packaging. Look at its visualization and editing components.
Limitations: Abandoned, node/flow-oriented rather than true WebCoRE piston style (no deep nested with/do tasks, no structured JSON wizard model like yours). Not a direct template for your editor architecture. Useful for add-on/Docker patterns and HA client integration, but not for the core editor logic you're building.

Home Assistant Editor (saihgupr/HomeAssistantEditor) — Currently the most active visual tool.
Relevance: Three-column visual workspace for automations/scripts, version history, cleaner UI than core HA. JavaScript frontend.
What you can learn: UI layout patterns, version control integration, how it parses/edits large HA YAML structures, and add-on setup. Good reference for HA entity/service handling and rendering complex automations.
Limitations: It's an enhanced view on HA's native automation model (not a WebCoRE-style piston builder with wizards, tasks inside with blocks, role-based sharing, etc.). Less relevant for your structured JSON + pure-projection + wizard-driven approach.


Overall:

Some utility for HA integration patterns, device pickers, add-on structure, and YAML output — but none replicate your core architecture (structured piston JSON, wizard-only mutations, pure rendering from nested tree, with-block task framework, role_tokens/entity_ids discipline).
You won't find a drop-in solution for the tricky parts you're solving (multi-task interleaving, edit-by-id hydration, etc.). Your approach is genuinely more ambitious and closer to true WebCoRE fidelity than what existed before. That's why it feels harder.


Yes — pulling relevant code from these projects for Claude to analyze is a smart acceleration move. Here's a targeted summary you can feed directly into your next Claude session, including why I suggest them and specific use cases for PistonCore's backend/integration.
1. Shortumation (asosnovsky/Shortumation) — Most Relevant for Add-on / Backend Patterns
Repo: https://github.com/asosnovsky/Shortumation
Status: Not maintained / deprecated, but the code is still public and readable.
Why relevant for your backend:

It was a full Home Assistant add-on for visual automation management.
Strong focus on HA integration, device/service discovery, visualization of automations, and YAML handling.
Good reference for add-on architecture, Docker setup, and how to interact with HA's API / states / services from a custom tool.

Specific things to pull / study:

Add-on structure (config.yaml, Dockerfile, backend services) — Excellent template for your own PistonCore addon (ingress support, supervisor API calls, volume mounting for pistons).
HA client / integration code — How it fetched devices, entities, services, and states. Look for any ha_client or API wrappers — this can speed up your backend device resolution and live data fetching.
Automation/YAML handling — Parsing, visualization, and generation logic (even if it's more Node-RED inspired).
Installation / packaging examples — Docker compose and add-on repo setup.

Use case for PistonCore: Backend HA communication layer, add-on packaging, and any file writing / reload patterns. Even though the visual style differs, the plumbing for talking to HA is worth mining.
2. HomeAssistantEditor (saihgupr/HomeAssistantEditor) — Best Current Reference
Repo: https://github.com/saihgupr/HomeAssistantEditor
Related: Paired with HomeAssistantVersionControl / TimeMachine by the same author.
Why relevant:

Modern, actively maintained (as of 2026) visual editor add-on for HA automations and scripts.
Focuses on clean UI for large/complex automations, version history, and direct editing of HA YAML.
Excellent real-world example of a production-grade HA add-on with deep integration.

Specific things to pull / study:

Add-on architecture and HA integration (how it talks to core, handles automations/scripts, version control).
Frontend-backend communication patterns (especially if it has a FastAPI / Python backend like yours).
Entity / service discovery and rendering logic for large configs.
Versioning / backup patterns (via the paired TimeMachine repo) — useful for your piston save/export/snapshots.
Docker / add-on packaging setup.

Use case for PistonCore: Current best-practices for HA add-on development, integration stability, and handling real-world HA automations at scale. Great for your backend (FastAPI endpoints, HA client, file I/O with signatures, reload validation).
Other Minor Mentions

Studio Code Server (hassio-addons/addon-vscode) — Not a visual builder, but the gold standard for how a robust HA add-on with web UI is built. Pull its structure for your addon packaging.
No other strong WebCoRE-style piston editors exist with open code.

How to Use This with Claude
Feed Claude something like:
"Analyze these two repos for PistonCore backend / integration code:
https://github.com/asosnovsky/Shortumation — focus on add-on structure, HA API client, automation handling.
https://github.com/saihgupr/HomeAssistantEditor — focus on modern add-on patterns, entity/service integration, versioning.
Extract relevant patterns for: HA device/service discovery, file writing with safety (signatures), reload mechanisms, FastAPI-style backend structure, and add-on packaging. Highlight what can accelerate the PistonCore backend while preserving our structured JSON + independence philosophy."

This should give you concrete code snippets, architecture ideas, and integration patterns that speed up your work without derailing your core vision.
Your plan (finish your own pistons end-to-end + templates for compiler maintenance) remains solid. These repos are helpful for the "plumbing" (backend + addon) rather than the editor core you're wrestling with now.
If you want me to refine the prompt for Claude further or review any specific files from those repos (I can open them if needed), just let me know. Keep grinding on the with-block tasks — that's still the highest-