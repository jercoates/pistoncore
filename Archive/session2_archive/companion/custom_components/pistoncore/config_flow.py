"""Config flow for PistonCore companion integration."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant

from .const import DOMAIN, CONF_EDITOR_TOKEN


class PistoncoreConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle setup of the PistonCore companion integration."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}

        if user_input is not None:
            # Basic validation — token must not be empty
            if not user_input.get(CONF_EDITOR_TOKEN, "").strip():
                errors[CONF_EDITOR_TOKEN] = "token_required"
            else:
                return self.async_create_entry(
                    title="PistonCore",
                    data=user_input,
                )

        schema = vol.Schema({
            vol.Required(CONF_EDITOR_TOKEN): str,
        })

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
            description_placeholders={
                "docs_url": "https://github.com/jercoates/pistoncore"
            },
        )
