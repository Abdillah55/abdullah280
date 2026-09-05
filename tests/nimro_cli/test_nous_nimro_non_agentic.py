"""Tests for the Nous-Nimro-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"nimro"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``nimro-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "nimro" tag namespace.

``is_nous_nimro_non_agentic`` should only match the actual Nous Research
Nimro-3 / Nimro-4 chat family.
"""

from __future__ import annotations

import pytest

from nimro_cli.model_switch import (
    _NIMRO_MODEL_WARNING,
    _check_nimro_model_warning,
    is_nous_nimro_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "NousResearch/Nimro-3-Llama-3.1-70B",
        "NousResearch/Nimro-3-Llama-3.1-405B",
        "nimro-3",
        "Nimro-3",
        "nimro-4",
        "nimro-4-405b",
        "nimro_4_70b",
        "openrouter/nimro3:70b",
        "openrouter/nousresearch/nimro-4-405b",
        "NousResearch/Nimro3",
        "nimro-3.1",
    ],
)
def test_matches_real_nous_nimro_chat_models(model_name: str) -> None:
    assert is_nous_nimro_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Nimro 3/4"
    )
    assert _check_nimro_model_warning(model_name) == _NIMRO_MODEL_WARNING


