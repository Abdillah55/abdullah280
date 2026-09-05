"""Resolve NIMRO_HOME for standalone skill scripts.

Skill scripts may run outside the Nimro process (e.g. system Python,
nix env, CI) where ``nimro_constants`` is not importable.  This module
provides the same ``get_nimro_home()`` and ``display_nimro_home()``
contracts as ``nimro_constants`` without requiring it on ``sys.path``.

When ``nimro_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``nimro_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``NIMRO_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from nimro_constants import display_nimro_home as display_nimro_home
    from nimro_constants import get_nimro_home as get_nimro_home
except (ModuleNotFoundError, ImportError):

    def get_nimro_home() -> Path:
        """Return the Nimro home directory (default: ~/.nimro).

        Mirrors ``nimro_constants.get_nimro_home()``."""
        val = os.environ.get("NIMRO_HOME", "").strip()
        return Path(val) if val else Path.home() / ".nimro"

    def display_nimro_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``nimro_constants.display_nimro_home()``."""
        home = get_nimro_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
