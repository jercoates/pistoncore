"""
Entity service.

Takes raw HA state data and turns it into clean, PistonCore-friendly
entity objects. The UI never sees entity_ids — it gets friendly names,
domains, device classes, and areas. Entity IDs stay internal.
"""

from typing import Optional
from models.entity import Entity, EntitySummary, EntityDomain

DOMAIN_LABELS = {
    "light": "Lights",
    "switch": "Switches",
    "binary_sensor": "Binary Sensors",
    "sensor": "Sensors",
    "climate": "Climate",
    "cover": "Covers",
    "media_player": "Media Players",
    "input_boolean": "Input Booleans",
    "input_number": "Input Numbers",
    "input_select": "Input Selects",
    "input_text": "Input Text",
    "alarm_control_panel": "Alarm Panels",
    "lock": "Locks",
    "fan": "Fans",
    "vacuum": "Vacuums",
    "camera": "Cameras",
    "person": "People",
    "device_tracker": "Device Trackers",
    "automation": "Automations",
    "script": "Scripts",
    "scene": "Scenes",
    "group": "Groups",
    "timer": "Timers",
    "counter": "Counters",
    "sun": "Sun",
    "weather": "Weather",
    "zone": "Zones",
}


def parse_domain(entity_id: str) -> str:
    return entity_id.split(".")[0]


def friendly_domain(domain: str) -> str:
    return DOMAIN_LABELS.get(domain, domain.replace("_", " ").title())


def state_to_entity(state: dict) -> Entity:
    """Convert a raw HA state dict to a PistonCore Entity."""
    entity_id = state["entity_id"]
    domain = parse_domain(entity_id)
    attrs = state.get("attributes", {})

    friendly_name = (
        attrs.get("friendly_name")
        or entity_id.split(".")[1].replace("_", " ").title()
    )

    return Entity(
        entity_id=entity_id,
        domain=domain,
        domain_label=friendly_domain(domain),
        friendly_name=friendly_name,
        state=state.get("state", "unknown"),
        device_class=attrs.get("device_class"),
        unit_of_measurement=attrs.get("unit_of_measurement"),
        area_id=attrs.get("area_id"),
        attributes=attrs,
    )


def to_summary(entity: Entity) -> EntitySummary:
    """Strip down to what the piston editor dropdowns need."""
    return EntitySummary(
        entity_id=entity.entity_id,
        friendly_name=entity.friendly_name,
        domain=entity.domain,
        domain_label=entity.domain_label,
        state=entity.state,
        device_class=entity.device_class,
        area_id=entity.area_id,
        unit_of_measurement=entity.unit_of_measurement,
    )


def group_by_domain(entities: list[Entity]) -> dict[str, list[EntitySummary]]:
    """Group entity summaries by domain for organized dropdown display."""
    grouped: dict[str, list[EntitySummary]] = {}
    for entity in sorted(entities, key=lambda e: e.friendly_name.lower()):
        label = entity.domain_label
        grouped.setdefault(label, []).append(to_summary(entity))
    return dict(sorted(grouped.items()))
