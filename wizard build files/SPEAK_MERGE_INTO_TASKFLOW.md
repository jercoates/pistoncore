# SPEAK — MERGE INTO EDITOR_WIZARD_SPEC: the author-time verification gate ONLY.

**This adds ONE thing the falls do NOT cover: the good-faith check that Speak will actually
work before the wizard offers it.** The WebCoRE falls already define how Speak renders, its
inline optional volume, the standalone Set Volume task, and the editor fields — do NOT restate
any of that; the falls/map are the authority and already cover it. The ONLY gap is the
backend-capability verification below. Merge it where Speak is offered in the task picker.

Storage of a committed Speak/volume task is the structure map (§19 ACTION / §20 TASK) — not
restated here.

---

## The author-time gate — verify Speak can work before offering it

Speak is offered as a task type in the do-list ONLY IF all three good-faith checks pass
[VERIFIED from SPEAK_ACTION_SPEC §3.3]:

1. all resolved entities in the with-block are domain `media_player`, AND
2. every resolved player advertises `supported_features & 512` (PLAY_MEDIA), AND
3. at least one `tts.*` engine entity exists in HA.

→ if all three hold, offer "Speak text". If not, do not offer it.

- The PLAY_MEDIA check is intersected across selected devices using the locked capability
  pattern (union within a device's sub-entities, then intersect across devices) — same
  intersection rule already in the spec; reference it, do not restate.
- The gate is **best-effort, author-time only** — it can be stale. It exists to stop the user
  building an obviously-broken Speak task, not to guarantee correctness (authoritative check
  is a compiler concern, out of scope). [VERIFIED from SPEAK_ACTION_SPEC §3.3]

## Backend data the gate needs (fold into the existing backend-forwarding note, §10.7)

Both signals are already in the single HA `get_states` call — no new HA round-trips — but the
backend currently drops them. Same forwarding-fix class as §10.7's companion-list gap; note it
there, do not create a new backend section. [VERIFIED from SPEAK_ACTION_SPEC §6]:
- **PLAY_MEDIA bit:** `attributes.supported_features` is read in `ha_client.py` `_fetch_devices`
  but currently dropped before the wizard sees it — must be carried through.
- **TTS engine list:** `tts.*` entities are in the same `get_states` result but filtered out by
  `ALLOWED_DOMAINS` — a small enumeration of `tts.` entities must be forwarded (also feeds the
  global default-engine setting).

---

## Tagging
All `[VERIFIED]` from SPEAK_ACTION_SPEC (live-HA confirmed, Session 72/73). Nothing here
restates the falls — only the verification gate and its backend data dependency are added.
