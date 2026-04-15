"""Entity models — what PistonCore knows about HA entities."""

from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class EntityDomain(str, Enum):
    light = "light"
    switch = "switch"
    binary_sensor = "binary_sensor"
    sensor = "sensor"
    climate = "climate"
    cover = "cover"
    media_player = "media_player"
    input_boolean = "input_boolean"
    input_number = "input_number"
    input_select = "input_select"
    input_text = "input_text"
    alarm_control_panel = "alarm_control_panel"
    lock = "lock"
    fan = "fan"
    vacuum = "vacuum"
    camera = "camera"
    person = "person"
    device_tracker = "device_tracker"
    automation = "automation"
    script = "script"
    scene = "scene"
    group = "group"


class Entity(BaseModel):
    entity_id: str
    domain: str
    domain_label: str
    friendly_name: str
    state: str
    device_class: Optional[str] = None
    unit_of_measurement: Optional[str] = None
    area_id: Optional[str] = None
    attributes: dict[str, Any] = {}


class EntitySummary(BaseModel):
    """Slimmed-down entity for dropdown population. No internal attributes."""
    entity_id: str
    friendly_name: str
    domain: str
    domain_label: str
    state: str
    device_class: Optional[str] = None
    area_id: Optional[str] = None
    unit_of_measurement: Optional[str] = None


class EntityListResponse(BaseModel):
    entities: list[EntitySummary]
    grouped: dict[str, list[EntitySummary]]
    total: int
