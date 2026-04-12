# PistonCore — Claude Session Starter Prompt

Paste this at the start of every new Claude session to restore context.
Update the "Last session" and "This session" sections each time.

---

I am building an open source project called PistonCore — a WebCoRE-style 
visual automation builder for Home Assistant. 

GitHub repo: https://github.com/jercoates/pistoncore

Here is the full design document: [paste contents of DESIGN.md here]

Last session we finalized the design document and created the GitHub repo. 
The project has two components: a Docker container running a FastAPI backend 
and React frontend, and a Home Assistant companion integration distributed 
via HACS.

This session I want to: scaffold the complete folder structure for the 
project on GitHub, then start building the FastAPI backend skeleton that 
connects to Home Assistant's API to pull entity and device data.

Tech decisions already made:
- Python FastAPI backend
- React frontend  
- Piston storage as JSON files in a Docker volume
- Default port 7777
- MIT license
- Compiles simple pistons to YAML, complex to PyScript
- Plain JSON sharing format with roles for device abstraction
