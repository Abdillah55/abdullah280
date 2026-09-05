# Nimro CLI Reference

Live sources when anything looks stale: `nimro --help`, `nimro <command> --help`,
https://nimro-agent.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
nimro [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
nimro chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
nimro setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
nimro model                Interactive model/provider picker
nimro fallback [add|remove|list]  Fallback provider chain
nimro config [show|edit|get|set|unset|path|env-path|check|migrate]
nimro login / logout       OAuth sign-in / clear stored auth
nimro doctor [--fix]       Check dependencies and config
nimro status [--all]       Component status
```

### Tools & Skills

```
nimro tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

nimro skills list|browse|search QUERY|inspect ID
nimro skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
nimro skills config        Enable/disable skills per platform
nimro skills check|update|uninstall|publish PATH
nimro skills tap add REPO  Add a GitHub repo as a skill source
nimro bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
nimro mcp add NAME (--url or --command) | remove | list | test NAME
nimro mcp catalog | install NAME     Curated catalog install
nimro mcp configure NAME             Toggle tool selection
nimro mcp serve                      Run Nimro as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
nimro gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `nimro photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://nimro-agent.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
nimro sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
nimro cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
nimro webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
nimro profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
nimro profile rename A B | alias NAME | export NAME | import FILE
```

### Credentials & Pools

```
nimro auth                 Interactive credential manager
nimro auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
nimro auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
nimro desktop / gui        Native desktop app
nimro dashboard            Web admin panel + embedded chat (--stop / --status)
nimro proxy                OpenAI-compatible local proxy backed by an OAuth provider
nimro portal               Quick setup / sign in via Nous Portal
nimro kanban <verb>        Multi-agent work-queue board
nimro project              Named multi-folder workspaces
nimro skin list|use|set    Switch/tweak skins (see references/themes.md)
nimro pets <verb>          Pet mascots (see references/petdex.md)
nimro memory setup|status|off|reset   Memory provider
nimro secrets bitwarden|onepassword   External secret stores
nimro moa                  Mixture-of-Agents slots
nimro hooks / security / backup / import / checkpoints / console
nimro logs [-f] [errors]   View agent/error logs
nimro send                 One-off message through a gateway platform
nimro pairing / plugins / insights / journey / computer-use
nimro acp                  ACP server (IDE integration)
nimro completion bash|zsh|fish
nimro update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `nimro photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `nimro config edit` · [Configuration docs](https://nimro-agent.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `nimro tools list` · [Tools reference](https://nimro-agent.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `nimro skills browse` · [Skills catalog](https://nimro-agent.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `nimro model` · [Providers guide](https://nimro-agent.nousresearch.com/docs/integrations/providers) |
| Env variables | `nimro config env-path` · [Env vars reference](https://nimro-agent.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.nimro/logs/gateway.log` (or `nimro logs`) |
| Sessions | `nimro sessions browse` (reads state.db) |
