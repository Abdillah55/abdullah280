"""
Shared platform registry for Nimro Agent.

Single source of truth for platform metadata consumed by both
skills_config (label display) and tools_config (default toolset
resolution).  Import ``PLATFORMS`` from here instead of maintaining
duplicate dicts in each module.
"""

from collections import OrderedDict
from typing import NamedTuple


class PlatformInfo(NamedTuple):
    """Metadata for a single platform entry."""
    label: str
    default_toolset: str


# Ordered so that TUI menus are deterministic.
PLATFORMS: OrderedDict[str, PlatformInfo] = OrderedDict([
    ("cli",            PlatformInfo(label="🖥️  CLI",            default_toolset="nimro-cli")),
    ("telegram",       PlatformInfo(label="📱 Telegram",        default_toolset="nimro-telegram")),
    ("discord",        PlatformInfo(label="💬 Discord",         default_toolset="nimro-discord")),
    ("slack",          PlatformInfo(label="💼 Slack",           default_toolset="nimro-slack")),
    ("whatsapp",       PlatformInfo(label="📱 WhatsApp",        default_toolset="nimro-whatsapp")),
    ("whatsapp_cloud", PlatformInfo(label="📱 WhatsApp Business (Cloud)", default_toolset="nimro-whatsapp")),
    ("signal",         PlatformInfo(label="📡 Signal",          default_toolset="nimro-signal")),
    ("bluebubbles",    PlatformInfo(label="💙 BlueBubbles",     default_toolset="nimro-bluebubbles")),
    ("email",          PlatformInfo(label="📧 Email",           default_toolset="nimro-email")),
    ("homeassistant",  PlatformInfo(label="🏠 Home Assistant",  default_toolset="nimro-homeassistant")),
    ("mattermost",     PlatformInfo(label="💬 Mattermost",      default_toolset="nimro-mattermost")),
    ("matrix",         PlatformInfo(label="💬 Matrix",          default_toolset="nimro-matrix")),
    ("dingtalk",       PlatformInfo(label="💬 DingTalk",        default_toolset="nimro-dingtalk")),
    ("feishu",         PlatformInfo(label="🪽 Feishu",          default_toolset="nimro-feishu")),
    ("wecom",          PlatformInfo(label="💬 WeCom",           default_toolset="nimro-wecom")),
    ("wecom_callback", PlatformInfo(label="💬 WeCom Callback",  default_toolset="nimro-wecom-callback")),
    ("weixin",         PlatformInfo(label="💬 Weixin",          default_toolset="nimro-weixin")),
    ("qqbot",          PlatformInfo(label="💬 QQBot",           default_toolset="nimro-qqbot")),
    ("yuanbao",        PlatformInfo(label="🤖 Yuanbao",         default_toolset="nimro-yuanbao")),
    ("webhook",        PlatformInfo(label="🔗 Webhook",         default_toolset="nimro-webhook")),
    ("api_server",     PlatformInfo(label="🌐 API Server",      default_toolset="nimro-api-server")),
    ("cron",           PlatformInfo(label="⏰ Cron",            default_toolset="nimro-cron")),
])


def platform_label(key: str, default: str = "") -> str:
    """Return the display label for a platform key, or *default*.

    Checks the static PLATFORMS dict first, then the plugin platform
    registry for dynamically registered platforms.
    """
    info = PLATFORMS.get(key)
    if info is not None:
        return info.label
    # Check plugin registry
    try:
        from gateway.platform_registry import platform_registry
        entry = platform_registry.get(key)
        if entry:
            return f"{entry.emoji}  {entry.label}" if entry.emoji else entry.label
    except Exception:
        pass
    return default


def get_all_platforms() -> "OrderedDict[str, PlatformInfo]":
    """Return PLATFORMS merged with any plugin-registered platforms.

    Plugin platforms are appended after builtins.  This is the function
    that tools_config and skills_config should use for platform menus.
    """
    merged = OrderedDict(PLATFORMS)
    try:
        from gateway.platform_registry import platform_registry
        for entry in platform_registry.plugin_entries():
            if entry.name not in merged:
                merged[entry.name] = PlatformInfo(
                    label=f"{entry.emoji}  {entry.label}" if entry.emoji else entry.label,
                    default_toolset=f"nimro-{entry.name}",
                )
    except Exception:
        pass
    return merged
