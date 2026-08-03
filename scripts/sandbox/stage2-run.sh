#!/usr/bin/env bash
# Stage 2 of the dev sandbox: build the mounts and run the payload.
#
# Not called directly. scripts/dev-sandbox.sh (stage 1) creates the user and
# network namespaces with `unshare` and re-execs into this script inside them,
# so by the time this runs we are already at the target uid with a private
# netns. bwrap therefore does NOT create a userns here -- it only adds the
# mount and pid namespaces. (`unshare --user` grants its creator full
# capabilities in the new userns regardless of which uid it maps, which is what
# lets bwrap mount as a non-root uid.)
#
# The whole interface with stage 1 is the DEV_SANDBOX_* environment, asserted
# below: there are no shared functions or variables between the two stages.
# Stage 1 locates this script alongside the other sandbox assets (see
# DEV_SANDBOX_ASSETS in dev-sandbox.sh), so the Nix wrapper's store copy and a
# plain repo checkout both work.

set -euo pipefail

: "${DEV_SANDBOX_ROOT:?missing DEV_SANDBOX_ROOT}"
: "${DEV_SANDBOX_BASH:?missing DEV_SANDBOX_BASH}"
: "${DEV_SANDBOX_INTERACTIVE:?missing DEV_SANDBOX_INTERACTIVE}"
: "${DEV_SANDBOX_USER:?missing DEV_SANDBOX_USER}"
: "${DEV_SANDBOX_HOME:?missing DEV_SANDBOX_HOME}"

# Announce our pid so stage 1 can point slirp4netns at these namespaces,
# then hold until it reports the network is up.
slirp_ready="$DEV_SANDBOX_ROOT/root/logs/slirp.ready"
printf '%s\n' "$$" > "$DEV_SANDBOX_ROOT/root/logs/sandbox.pid"
for _ in $(seq 1 200); do
  [ -s "$slirp_ready" ] && break
  sleep 0.05
done
if [ ! -s "$slirp_ready" ]; then
  echo 'error: timed out waiting for sandbox network setup' >&2
  cat "$DEV_SANDBOX_ROOT/root/logs/slirp.log" >&2 || true
  exit 1
fi

# The sandbox HOME is /root for a root install and /home/<user> for a
# user-level one. Only the latter needs its parent created first; --dir /
# is not a thing bwrap accepts.
home_mounts=()
home_parent="$(dirname "$DEV_SANDBOX_HOME")"
if [ "$home_parent" != / ]; then
  home_mounts+=(--dir "$home_parent")
fi
home_mounts+=(--bind "$DEV_SANDBOX_ROOT/home" "$DEV_SANDBOX_HOME")

node_env=()
if [ -n "${DEV_SANDBOX_NODE_DIR:-}" ]; then
  node_env+=(--setenv npm_config_nodedir "$DEV_SANDBOX_NODE_DIR")
fi
electron_env=()
if [ -n "${DEV_SANDBOX_ELECTRON_LD_LIBRARY_PATH:-}" ]; then
  electron_env+=(
    --setenv LD_LIBRARY_PATH "$DEV_SANDBOX_ELECTRON_LD_LIBRARY_PATH"
    --setenv HERMES_DESKTOP_DISABLE_GPU 1
  )
fi
gui_mounts=()
if [ -n "${DEV_SANDBOX_WAYLAND_SOCKET:-}" ]; then
  runtime_dir="${DEV_SANDBOX_XDG_RUNTIME_DIR:?missing DEV_SANDBOX_XDG_RUNTIME_DIR}"
  runtime_parent="$(dirname "$runtime_dir")"
  runtime_grandparent="$(dirname "$runtime_parent")"
  gui_mounts+=(
    --dir "$runtime_grandparent"
    --dir "$runtime_parent"
    --dir "$runtime_dir"
    --bind "$DEV_SANDBOX_WAYLAND_SOCKET" "$DEV_SANDBOX_WAYLAND_SOCKET"
    --setenv XDG_RUNTIME_DIR "$runtime_dir"
    --setenv WAYLAND_DISPLAY "${DEV_SANDBOX_WAYLAND_DISPLAY:?missing DEV_SANDBOX_WAYLAND_DISPLAY}"
  )
fi

# How the sandbox gets a usable runtime, and where its own shims go.
#
# On Nix, every binary lives under /nix/store, so the sandbox can own /bin,
# /lib64 and /usr/bin outright and fill them with symlinks into the store.
#
# Elsewhere the runtime IS /usr, /bin, /lib, /lib64 -- so binding the
# sandbox's near-empty versions over them hides the real thing, and bwrap
# dies with `execvp /usr/bin/bash: No such file or directory`. Keep the host
# directories read-only and override only the individual files we shim.
runtime_mounts=()
shim_mounts=()
etc_mounts=()
if [ -d /nix ] && [[ "$(readlink -f "$DEV_SANDBOX_BASH")" == /nix/* ]]; then
  runtime_mounts+=(--ro-bind /nix /nix)
  shim_mounts+=(
    --dir /usr
    --dir /bin
    --dir /lib64
    --bind "$DEV_SANDBOX_ROOT/root/bin" /bin
    --bind "$DEV_SANDBOX_ROOT/root/lib64" /lib64
    --bind "$DEV_SANDBOX_ROOT/root/usr/bin" /usr/bin
  )
else
  for path in /usr /bin /sbin /lib /lib64; do
    [ -e "$path" ] && runtime_mounts+=(--ro-bind "$path" "$path")
  done
  # Debian/Ubuntu route many binaries through the alternatives system:
  # /usr/bin/awk is a symlink to /etc/alternatives/awk. The sandbox replaces
  # /etc with its own, so without this those symlinks dangle and the payload
  # sees "awk: not found" for a binary that is plainly on PATH. Bound after
  # /etc below via etc_mounts.
  [ -d /etc/alternatives ] \
    && etc_mounts+=(--ro-bind /etc/alternatives /etc/alternatives)
  # The git-upload-pack shim standing in for github.com is the only file that
  # must beat the host's copy; sh/ls/env are already there for real.
  shim_mounts+=(--bind "$DEV_SANDBOX_ROOT/root/usr/bin/ssh" /usr/bin/ssh)
fi

exec bwrap \
  --unshare-pid \
  --die-with-parent --proc /proc --dev /dev --tmpfs /tmp \
  "${gui_mounts[@]}" \
  "${runtime_mounts[@]}" \
  --bind "$DEV_SANDBOX_ROOT/root" /work \
  "${shim_mounts[@]}" \
  --bind "$DEV_SANDBOX_ROOT/root/usr/local" /usr/local \
  "${home_mounts[@]}" \
  --bind "$DEV_SANDBOX_ROOT/etc" /etc \
  "${etc_mounts[@]}" \
  --chdir /work/repo \
  --clearenv \
  --setenv PATH "$DEV_SANDBOX_HOME/.local/bin:/usr/local/bin:/usr/bin:$PATH" \
  --setenv HOME "$DEV_SANDBOX_HOME" \
  --setenv USER "$DEV_SANDBOX_USER" \
  --setenv LOGNAME "$DEV_SANDBOX_USER" \
  --setenv CURL_CA_BUNDLE /work/certs/ca.pem \
  --setenv SSL_CERT_FILE /work/certs/ca.pem \
  --setenv GIT_SSL_CAINFO /work/certs/ca.pem \
  --setenv NODE_EXTRA_CA_CERTS /work/certs/real-ca.pem \
  --setenv OPENSSL_CONF /work/certs/openssl.cnf \
  --setenv HTTP_PROXY http://127.0.0.1:8080 \
  --setenv HTTPS_PROXY http://127.0.0.1:8080 \
  --setenv ALL_PROXY http://127.0.0.1:8080 \
  --setenv NO_PROXY '' \
  --setenv DEV_SANDBOX_INTERACTIVE "$DEV_SANDBOX_INTERACTIVE" \
  --setenv ELECTRON_DISABLE_SANDBOX 1 \
  "${node_env[@]}" \
  "${electron_env[@]}" \
  -- "$DEV_SANDBOX_BASH" -ceu '
    python3 /work/proxy.py /work/http /work/certs /work/certs/real-ca.pem >/work/logs/proxy.log 2>&1 &
    proxy_pid=$!
    cleanup() {
      kill "$proxy_pid" 2>/dev/null || true
      wait "$proxy_pid" 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM
    # Bash opens /dev/tcp itself, so the readiness probe needs no netcat --
    # one less binary the sandbox has to find on the host (GitHub runners
    # ship no `nc`).
    proxy_up() { (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; }
    for _ in $(seq 1 100); do
      proxy_up && break
      sleep 0.05
    done
    if ! proxy_up; then
      echo "error: the sandbox fake-internet proxy never came up" >&2
      cat /work/logs/proxy.log >&2 || true
      exit 1
    fi
    "$@"
  ' sandbox-command "$@"
