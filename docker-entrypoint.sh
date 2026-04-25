#!/bin/sh
# PistonCore entrypoint script
#
# On first run, seeds the pistoncore-customize volume with the default
# compiler templates and validation rules bundled in the image.
# If the volume already has content, it is left untouched.

CUSTOMIZE_DIR="/pistoncore-customize"
DEFAULTS_DIR="/app/defaults/pistoncore-customize"

if [ -z "$(ls -A "$CUSTOMIZE_DIR" 2>/dev/null)" ]; then
    echo "PistonCore: pistoncore-customize is empty — copying default templates..."
    cp -r "$DEFAULTS_DIR/." "$CUSTOMIZE_DIR/"
    echo "PistonCore: default templates installed."
else
    echo "PistonCore: pistoncore-customize already populated — skipping seed."
fi

exec uvicorn main:app --host 0.0.0.0 --port 7777
