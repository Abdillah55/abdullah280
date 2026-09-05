"""Resolve NIMRO_HOME for standalone skill scripts.

Skill scripts may run outside the Nimro process (system Python, nix env,
CI) where ``nimro_constants`` is not importable.  This module provides the
same ``get_nimro_home()`` contract without requiring it on ``sys.path``.

When ``nimro_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from nimro_constants import get_nimro_home as get_nimro_home
except (ModuleNotFoundError, ImportError):

    def get_nimro_home() -> Path:
        """Return the Nimro home directory (default: ``~/.nimro``)."""
        val = os.environ.get("NIMRO_HOME", "").strip()
        return Path(val) if val else Path.home() / ".nimro"
