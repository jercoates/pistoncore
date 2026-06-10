# PistonCore — Backend Spec (PROTO / research-gathering)

**Status:** PROTO — research-gathering, NOT a build contract. This file collects *verified*
plumbing patterns (add-on packaging, HA client, file/reload) pulled from real code, so when
PistonCore reaches the backend/add-on phase there's a sourced starting point instead of
assumptions. Nothing here is a decision yet. Promote items to a definitive spec only when
about to code them.
**Created:** Session 73 (June 2026).
**Discipline (carried from this session):** everything below is either (a) read from actual
source/docs with the link, or (b) explicitly flagged as unverified. Reference to READ, never
code to lift — borrowed patterns carry the source project's assumptions, which may contradict
PistonCore's model (structured JSON, wizard-only mutations, friendly-name→entity_id rule).
Read, then decide; don't import.

---

## 0. Why these sources, and the honest caveat

Pointed here by an external note (another AI) suggesting two HA add-on repos as
plumbing references. The note reasoned from repo *descriptions*, not code, so its specifics
were unverified. This file records what was actually fetched and read. Repos:
- **asosnovsky/Shortumation** — visual automation editor add-on. **Not maintained** (last
  active ~2022, ~300 stars). Node-RED-flavored editor, but the *backend plumbing* is the
  relevant part. ⚠ Age means add-on API patterns may have drifted vs current HA — verify any
  pattern against current HA add-on docs before relying.
- **saihgupr/HomeAssistantEditor** — described as a current (2026) visual editor add-on. NOT
  yet fetched/verified in this session — see §6 (open to pull next).
- **hassio-addons/addon-vscode** (Studio Code Server) — the canonical well-built add-on;
  named as the gold standard for add-on structure. NOT yet fetched — see §6.

**Architectural relevance confirmed:** Shortumation is FastAPI-style (hypercorn ASGI,
`src.app:app`, port 8000) with a separately-built frontend (`webapp/build`) — the same shape
as PistonCore (FastAPI + vanilla JS). So its add-on wiring is a real apples-to-apples
reference, not a foreign architecture. Its editor model is NOT relevant (flow-style, not
piston/with-block).

---

## 1. Add-on manifest (config.yaml) — VERIFIED from Shortumation

Source (read June 2026): `raw.githubusercontent.com/asosnovsky/Shortumation/main/config.yaml`

The fields PistonCore's add-on manifest will need, with what each does:

```yaml
name: Shortumation
version: v0.7.6
slug: shortumation
image: "asosnovsky/shortumation-{arch}"     # multi-arch image naming
arch: [aarch64, amd64, armhf, armv7, i386]
startup: application
boot: auto
init: false
ingress: true                 # serve UI through HA's ingress (no exposed port needed)
ingress_port: 8000
ingress_entry: "web/"         # path the UI is served from
homeassistant_api: true       # grants access to HA core API from the add-on
auth_api: true                # access to HA auth
panel_icon: mdi:home-automation
hassio_role: homeassistant    # supervisor role/permission level
host_network: false
map:
  - config:rw                 # mounts HA's /config read-write (how it reaches automations/files)
ports:
  8000/tcp:
```

**Why this matters for PistonCore:** this is the near-complete shape of the add-on manifest.
The load-bearing ones for PistonCore: `ingress: true` + `ingress_port` + `ingress_entry`
(serve the wizard UI through HA, no separate exposed port), `homeassistant_api: true`
(reach HA), `map: config:rw` (write compiled YAML / pyscript files to `/config`), and
`hassio_role`. **Decision deferred:** PistonCore writes to
`/config/automations/pistoncore/` and `/config/pyscript/pistoncore/` (per HA_LIMITATIONS §4)
— confirm `config:rw` is sufficient or whether explicit subfolder perms are needed.

---

## 2. Dockerfile pattern — VERIFIED from Shortumation

Source (read June 2026): `raw.githubusercontent.com/asosnovsky/Shortumation/main/Dockerfile`

Real structure (trimmed to the load-bearing shape):

```dockerfile
ARG BUILD_ARCH
FROM python:3.10-slim-bullseye
WORKDIR /app
ARG BUILD_VERSION
ENV BUILD_VERSION $BUILD_VERSION
ENV BUILD_ARCH $BUILD_ARCH
ENV LANG C.UTF-8
RUN apt-get update -y && apt-get install -y gcc git build-essential libtool automake curl
COPY docker/bin /app/bin
COPY docker/hypercorn.toml /app/hypercorn.toml
RUN /app/bin/prep.sh
COPY api/setup.py /app/setup.py
RUN /app/bin/build.sh /app
COPY api/src /app/src         # python backend
COPY webapp/build /app/web    # pre-built frontend served as static
EXPOSE 8000
LABEL io.hass.type="addon" \
      io.hass.arch="armhf|aarch64|i386|amd64|armv7"
ENTRYPOINT [ "/app/bin/run.sh" ]
CMD [ "/app" ]
```

**Takeaways for PistonCore:**
- `BUILD_ARCH`/`BUILD_VERSION` args are the standard HA add-on multi-arch build convention.
- The `io.hass.type="addon"` + `io.hass.arch` LABELs are what mark the image as an HA add-on.
- Python backend (`/app/src`) + pre-built static frontend (`/app/web`) is exactly
  PistonCore's split — directly transferable layout.
- PistonCore already runs Docker on Unraid at :7777 (dev). The add-on packaging is the
  *additional* target (HA OS / supervised) — this Dockerfile is the template for that path.

### 2.1 Run script — VERIFIED
Source: `docker/bin/run.sh`. ASGI launch via hypercorn:
```bash
python -m hypercorn src.app:app -b $host:$port --config /app/hypercorn.toml
```
Notable: it reads a `HASSIO_WS` env var (the HA WebSocket URL) — confirming the HA connection
is over WebSocket (see §3), and `PORT`/`HOST` are env-overridable.

---

## 3. HA client — the most valuable finding (WebSocket API)

Shortumation talks to HA over the **WebSocket API**, and the author extracted the wrapper
into a standalone PyPI library worth studying (or using):

- **`hass-websocket-client`** (PyPI, `from hass_ws import HassWS`). VERIFIED interface (PyPI
  page, read June 2026):
  - `await HassWS(server, token)` — connect with ws://|wss:// URL + long-lived token
  - `fetch_states() -> HassEntity[]` — all entity states (PistonCore device picker source)
  - `fetch_services() -> {domain: {service: HassService}}` — **all services by domain**
  - `fetch_config()`, `fetch_panels()`
  - `call_service(domain, service, target, data) -> bool`
  - `listen_event(type)` — async event subscription

**Why this is the key find for PistonCore:**
- `fetch_states()` is the device-picker feed PistonCore already needs (parallels current
  `ha_client.py` `get_states`).
- `fetch_services()` returning `{domain: {service}}` is *exactly* the second fetch the NOTIFY
  spec requires (the notify service registry — notify targets aren't in states) AND covers
  SPEAK's `tts.*` enumeration. The note never caught this; it's the strongest reason to look
  here. ⚠ Verify the lib is current/maintained before adopting as a dependency vs. just
  reading its approach.
- HA's own WebSocket API reference (developers.home-assistant.io/docs/api/websocket/) is the
  authoritative source — verified current (doc dated 2026). If not adopting the lib,
  implement against this directly.

### 3.1 LESSON LEARNED from Shortumation (issue #115) — VERIFIED, important
Source: `github.com/asosnovsky/Shortumation/issues/115` (read June 2026). They **started by
mounting `/config` and manually reading/validating automation files, then concluded the
better path was the HA WebSocket + HA's REST config endpoints**
(`GET/POST /api/config/automation/config/<id>`). 

For PistonCore this is a real decision input: there are two ways to get pistons into HA —
(a) write YAML files to `/config/...` and reload (PistonCore's current plan, HA_LIMITATIONS
§4), or (b) push via HA's config REST/WS endpoints. Shortumation's experience says (b) is
more consistent and avoids manual file validation. **NOT a decision for PistonCore** — (a)
fits the "compile to native Script files + pyscript" model better and keeps PistonCore's
output inspectable. But the tradeoff is now documented from someone who hit it, instead of
discovered the hard way. Revisit at backend-coding time.

---

## 4. File writing + reload — what to still pull/verify

PistonCore's plan (HA_LIMITATIONS §4): write to `/config/automations/pistoncore/` +
`/config/pyscript/pistoncore/`, then `automation.reload` / `script.reload`, catch silent
reload failures (HA_LIMITATIONS §4 documents that reload can 200 but leave the automation
broken). NOT yet sourced from a reference repo. Candidate to pull from HomeAssistantEditor
(§6) since it does direct YAML editing + reload at scale, and from its paired TimeMachine
repo for save/snapshot patterns. Specifically still wanted:
- file-write-with-signature pattern (so PistonCore knows which files it owns)
- reload-validation (detect the silent-fail case)
- backup/snapshot before overwrite

---

## 5. What does NOT transfer (guardrail)

- **Neither repo's editor/data model.** Shortumation is flow/Node-RED-flavored; both operate
  on HA's native automation model. PistonCore's structured-piston-JSON, wizard-only-mutation,
  pure-projection model is NOT in either. Do not import editor logic, JSON shape, or
  device-data handling — those carry assumptions that conflict with PistonCore's locked rules
  (friendly-name keys, entity_ids resolved at commit, role_tokens discipline).
- Borrowed HA-client code still shapes device data its own way — re-check any grouping/
  resolution against PistonCore's `_groupDevices` + capability-intersection rules before use.

---

## 6. Open to pull next (research queue — not yet fetched)

1. **saihgupr/HomeAssistantEditor** — fetch add-on config, backend (confirm FastAPI?), the
   YAML edit + reload path, entity/service discovery. Current (2026) so less drift risk than
   Shortumation. Highest value for §4 (file/reload at scale).
2. **HomeAssistantVersionControl / TimeMachine** (same author) — save/snapshot/backup
   patterns for piston export/versioning.
3. **hassio-addons/addon-vscode** (Studio Code Server) — gold-standard add-on structure;
   pull ingress/supervisor wiring before PistonCore finalizes its add-on layout (retrofitting
   ingress is painful — do this BEFORE designing the add-on shell).
4. Re-verify Shortumation's add-on patterns against **current** HA add-on developer docs
   (the repo is ~2022; confirm `config.yaml` fields, ingress, hassio_role haven't changed).

---

## 7. Timing note

Per Session 73: STAGE B (backend/compiler) is BLOCKED behind the wizard round-trip, and the
with-block tasks are the current highest-value work. This backend research is a PARKED
accelerator for the add-on/backend phase — not to be chased mid-wizard. This file exists so
the research isn't re-done later; add to it opportunistically, build from it when STAGE B
unblocks.
