# PistonCore — Sample Piston Library

**Status:** Planning — Snapshot JSON not yet written
**Last Updated:** Session 23
**Purpose:** Document the planned preloaded piston library. These pistons ship
with PistonCore or are available from the GitHub repo as ready-to-import
Snapshot JSON files. Users import, map devices, deploy.

---

## The Onboarding Story

Sample pistons use role names like `{Battery_Devices}` that map at import
time through the standard role mapping flow — same as any Snapshot import.
Users map their own devices to each role. No forced naming convention.

If a user already has a global variable that matches a role name, the import
dialog can offer to use it automatically — but never forces it.

A companion best practices guide (see MISSING_SPECS.md item 12) explains
why creating globals for shared devices saves time across multiple pistons,
and why using the define block for single-piston device references keeps
logic clean. This is a guide, not a requirement.

---

## Standard Role Names Used in Sample Pistons

Sample pistons use these role names consistently so the import dialog asks
sensible questions. Users map whatever devices they have to each role.

| Role Name | Purpose |
|---|---|
| `{Battery_Devices}` | All battery-powered devices to monitor |
| `{Smoke_Detectors}` | All smoke/CO detector devices |
| `{Water_Sensors_All}` | All water leak sensors |
| `{Water_Sensors_Away}` | Water sensors that trigger shutoff only when away |
| `{Water_Sensors_Always}` | Water sensors that always trigger shutoff |
| `{Presence_Sensors}` | Presence/occupancy sensors |
| `{Doors}` | All door contact sensors |
| `{Windows}` | All window contact sensors |
| `{Speakers_All}` | All speakers for emergency announcements |
| `{Announcement_Sonos}` | Primary announcement speaker |
| `{Alert_Lights}` | Lights used for visual alerts |
| `{Notifications_Push}` | Push notification device/service |
| `{Notification_Text}` | Text/SMS notification device/service |
| `{Shut_off_Valve}` | Main water shutoff valve |

Users who have already set up globals with matching names get them
offered automatically at import. Users who haven't get the standard
device picker — same experience, no penalty either way.

---

## Planned Sample Pistons

### 1. Low Battery Check
**File:** `sample_low_battery_check.piston`
**Compile target:** PyScript
**Globals required:** `@Battery_Devices`, `@Notifications_Push`
**What it does:**
Runs daily at a configurable time. Checks battery level on every device
in `@Battery_Devices`. Builds a status report listing every device below
the threshold with current battery percentage and last reported time.
Sends the report as a push notification. Separate check for smoke/CO
detectors with a different threshold (80% vs 20%).

**Patterns used:**
- `for_each` with dynamic attribute access (`{$device:battery}`)
- String accumulation across loop iterations
- Global device group as loop target
- formatDateTime for timestamps
- Configurable threshold as piston variable

**Known limitations:**
- Requires PyScript (dynamic attribute access in loop)
- Battery attribute must be named `battery` in HA — some integrations use
  different attribute names. May need customization for non-standard devices.

---

### 2. Door / Window Chime
**File:** `sample_door_window_chime.piston`
**Compile target:** PyScript
**Globals required:** `@Doors`, `@Windows`, `@Announcement_Sonos`
**What it does:**
Announces when any door or window opens. Message includes the device name
and "Opened" in a slow speech rate for clarity. Volume is higher during
sleeping hours (8PM–8AM) than during the day. Day-of-week aware — different
quiet hours on weekends vs weekdays.

**Patterns used:**
- `$currentEventDevice` — which specific door/window triggered
- Multi-role OR trigger — {Doors} or {Windows}
- Day-of-week time conditions
- SSML speech markup (`<prosody rate='slow'>`)
- Global device for announcement speaker

**Known limitations:**
- Requires PyScript (due to `$currentEventDevice`)
- SSML requires a TTS service that supports Speech Synthesis Markup Language
- Volume levels and quiet hours are piston variables — adjust before deploying

---

### 3. Carbon Monoxide / Smoke Alert
**File:** `sample_co_smoke_alert.piston`
**Compile target:** PyScript
**Globals required:** `@Smoke_Detectors`, `@Speakers_All`, `@Notifications_Push`,
`@Alert_Lights`, `@Notification_Text`
**What it does:**
Triggers when any smoke/CO detector detects CO. Immediately sends push
notification and email with which detectors are triggered. Enters a
persistent alert loop: flashes alert lights, speaks alarm message on all
speakers, sends push notification, waits 30 seconds, repeats. Loop continues
until ALL detectors are clear. Sends all-clear notification when resolved.

**Patterns used:**
- `repeat/until` with live multi-device state condition
- `for_each` with dynamic attribute access
- Nested loop inside repeat
- String accumulation across iterations
- Multiple `with/do` blocks in sequence (lights + speakers + push)
- All-clear second trigger

**Known limitations:**
- Requires PyScript (repeat/until live state, dynamic attribute access)
- Flash pattern requires HA light with flash support
- Speaker volume set to 90% — adjust before deploying in bedrooms
- Email notification requires a notify service configured in HA

**⚠ Safety note:** Test this piston thoroughly before relying on it.
Use the Test Compile button to verify output. Do a Live Fire test with
a non-safety device first. This piston controls real safety equipment.

---

### 4. Water Leak Detection and Shutoff
**File:** `sample_water_leak_shutoff.piston`
**Compile target:** PyScript
**Globals required:** `@Water_Sensors_All`, `@Water_Sensors_Away`,
`@Water_Sensors_Always`, `@Presence_Sensors`, `@Shut_off_Valve`,
`@Speakers_All`, `@Notifications_Push`, `@Notification_Text`
**What it does:**
Four coordinated triggers in one piston:
1. Away sensors detect leak AND nobody home → shut off valve immediately
2. Any sensor detects leak → enter alert loop (speak + push every 60 seconds
   until all sensors dry)
3. Always-on sensors detect leak → shut off valve regardless of presence
4. Valve state changes → notify (both open and closed)

**Patterns used:**
- Multiple triggers in one piston (four separate if blocks)
- `repeat/until` with live multi-device state condition
- Presence condition using global (`@Presence_Sensors`)
- `for_each` with dynamic attribute access
- Valve control (open/close switch)
- String accumulation across iterations

**Known limitations:**
- Requires PyScript (repeat/until, dynamic attribute access, multiple trigger patterns)
- Valve must be a switch entity in HA (turn_off = close)
- Presence detection accuracy depends on your presence sensors — test before relying on it
- `@Water_Sensors_Away` and `@Water_Sensors_Always` can overlap — devices in Always
  will shut off regardless of presence even if also in Away

**⚠ Safety note:** Test valve control carefully before deploying.
A false positive shutoff cuts water to the entire home. Verify your
presence detection is reliable before enabling the away-triggered shutoff.

---

## Where Sample Pistons Live

**Shipped with PistonCore** (in container, served by backend):
- Available from the Import dialog under a "Sample Pistons" tab
- `GET /api/samples` returns list of available samples
- `GET /api/samples/{name}` returns the Snapshot JSON

**Also available on GitHub:**
- `pistoncore/samples/` folder in the repo
- Raw JSON files importable via URL in the Import dialog

---

## Writing the Snapshot JSON

Each sample piston Snapshot JSON must be written after:
1. The Snapshot format is finalized (done — PISTON_FORMAT.md)
2. The import role mapping flow works (S2-4)
3. The round-trip smoke test passes (S3-1)
4. The standard global names above are confirmed

Do not write the Snapshot JSON before the import flow is tested —
the format needs to be validated by actually importing a test piston first.

---

## Future Sample Pistons (Not v1)

- Presence notification (home/away/arrived/left)
- Morning briefing (weather, calendar, reminders)
- Goodnight routine (locks, lights, thermostat)
- Motion-activated lighting with timeout
- Thermostat schedule manager

---

*Sample pistons are MIT licensed, same as PistonCore. Contributions welcome.*
