"""
Piston models.

These map directly to the PistonCore JSON sharing format (Design Doc §6).
Keep them in sync with the schema documented in the repo.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, Literal
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────────────

class PistonMode(str, Enum):
    single = "single"      # Ignore new triggers while running
    restart = "restart"    # Cancel current run, start fresh
    queued = "queued"      # Finish current run, then start next
    parallel = "parallel"  # Allow multiple simultaneous instances


class VariableType(str, Enum):
    text = "text"
    number = "number"
    yesno = "yesno"
    datetime = "datetime"
    device = "device"
    devices = "devices"


class TriggerType(str, Enum):
    state = "state"            # Entity state change
    numeric = "numeric"        # Numeric threshold
    time = "time"              # Specific time of day
    sun = "sun"                # Sunrise / Sunset
    time_pattern = "time_pattern"  # Every X minutes/hours
    ha_event = "ha_event"      # Any HA event
    webhook = "webhook"        # Incoming webhook
    piston_call = "piston_call"    # Called by another piston
    manual = "manual"          # Manual only


class ActionType(str, Enum):
    call_service = "call_service"
    if_then = "if_then"
    set_variable = "set_variable"
    wait = "wait"
    wait_for_state = "wait_for_state"
    repeat = "repeat"
    call_piston = "call_piston"
    log = "log"
    stop = "stop"


class ConditionOperator(str, Enum):
    equals = "equals"
    not_equals = "does not equal"
    greater_than = "is greater than"
    less_than = "is less than"
    between = "is between"
    is_on = "is on"
    is_off = "is off"
    contains = "contains"
    not_contains = "does not contain"
    before = "is before"
    after = "is after"


# ── Building blocks ────────────────────────────────────────────────────────────

class Role(BaseModel):
    """A named device placeholder used in sharing. Maps to a real entity at import time."""
    label: str                  # Human-readable name shown during import
    domain: Optional[str] = None  # Hint: which HA domain this role expects
    required: bool = True


class Variable(BaseModel):
    name: str
    type: VariableType
    default: Optional[Any] = None
    description: Optional[str] = None


class Condition(BaseModel):
    attribute: Optional[str] = None        # None = the entity's main state
    operator: ConditionOperator
    value: Optional[Any] = None
    value2: Optional[Any] = None           # Used for "is between"
    target_role: Optional[str] = None      # Role key
    target_variable: Optional[str] = None  # Variable name
    join: Optional[Literal["AND", "OR"]] = None  # How this joins to the next condition


class Trigger(BaseModel):
    type: TriggerType
    # State trigger
    target_role: Optional[str] = None
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    # Numeric trigger
    attribute: Optional[str] = None
    threshold: Optional[float] = None
    direction: Optional[Literal["above", "below"]] = None
    # Time trigger
    time: Optional[str] = None            # HH:MM:SS
    # Sun trigger
    event: Optional[Literal["sunrise", "sunset"]] = None
    offset_minutes: Optional[int] = 0
    # Time pattern
    every_minutes: Optional[int] = None
    every_hours: Optional[int] = None
    # HA event
    event_type: Optional[str] = None
    # Webhook
    webhook_id: Optional[str] = None
    # Piston call
    source_piston_id: Optional[str] = None


class Action(BaseModel):
    type: ActionType
    # call_service
    service: Optional[str] = None
    target_role: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    # if_then
    conditions: Optional[list[Condition]] = None
    then_actions: Optional[list["Action"]] = None
    else_actions: Optional[list["Action"]] = None
    # set_variable
    variable_name: Optional[str] = None
    variable_value: Optional[Any] = None
    # wait
    duration_seconds: Optional[int] = None
    until: Optional[str] = None           # HH:MM:SS for "wait until time"
    # wait_for_state
    timeout_seconds: Optional[int] = None
    # repeat
    count: Optional[int] = None
    while_conditions: Optional[list[Condition]] = None
    loop_actions: Optional[list["Action"]] = None
    # log / call_piston / stop
    message: Optional[str] = None
    target_piston_id: Optional[str] = None


Action.model_rebuild()  # Needed for self-referential model


# ── Top-level piston ──────────────────────────────────────────────────────────

class Piston(BaseModel):
    pistoncore_version: str = "1.0"
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    folder: Optional[str] = ""
    mode: PistonMode = PistonMode.single
    enabled: bool = True
    roles: dict[str, Role] = {}
    device_map: dict[str, str] = {}       # role_key → entity_id (never shared)
    variables: list[Variable] = []
    triggers: list[Trigger] = []
    conditions: list[Condition] = []
    actions: list[Action] = []
    last_modified: Optional[str] = None


class PistonSummary(BaseModel):
    """What the piston list screen needs — no triggers/actions/conditions."""
    id: str
    name: str
    description: Optional[str] = ""
    folder: Optional[str] = ""
    enabled: bool
    mode: PistonMode
    last_modified: Optional[str] = None


class PistonImportRequest(BaseModel):
    """Payload for importing a shared piston JSON."""
    piston_data: dict[str, Any]
    device_map: dict[str, str] = {}  # Provided by user after role-mapping prompt


class RoleMapRequest(BaseModel):
    """Intermediate step: which roles need to be mapped before import."""
    roles: dict[str, Role]
    existing_map: dict[str, str] = {}
