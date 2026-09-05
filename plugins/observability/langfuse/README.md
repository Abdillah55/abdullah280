# Langfuse Observability Plugin

This plugin ships bundled with Nimro but is **opt-in** — it only loads when
you explicitly enable it.

## Enable

Pick one:

```bash
# Interactive: walks you through credentials + SDK install + enable
nimro tools  # → Langfuse Observability

# Manual
pip install langfuse
nimro plugins enable observability/langfuse
```

## Required credentials

Set these in `~/.nimro/.env` (or via `nimro tools`):

```bash
NIMRO_LANGFUSE_PUBLIC_KEY=pk-lf-...
NIMRO_LANGFUSE_SECRET_KEY=sk-lf-...
NIMRO_LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or your self-hosted URL
```

Without the SDK or credentials the hooks no-op silently — the plugin fails
open.

## Verify

```bash
nimro plugins list                 # observability/langfuse should show "enabled"
nimro chat -q "hello"              # then check Langfuse for a "Nimro turn" trace
```

## Optional tuning

```bash
NIMRO_LANGFUSE_ENV=production       # environment tag
NIMRO_LANGFUSE_RELEASE=v1.0.0       # release tag
NIMRO_LANGFUSE_SAMPLE_RATE=0.5      # sample 50% of traces
NIMRO_LANGFUSE_MAX_CHARS=12000      # max chars per field (default: 12000)
NIMRO_LANGFUSE_DEBUG=true           # verbose plugin logging
```

## Disable

```bash
nimro plugins disable observability/langfuse
```
