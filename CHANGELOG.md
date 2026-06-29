# Changelog

All notable changes to LocalLane are documented in this file.

## [Unreleased]

### Added — Port forwarding

- **TCP port forwarder** (`src/system/port-forward.ts`, `src/cli/forward.ts`):
  the `forward` command pipes the privileged ports `80`/`443` to the proxy's
  unprivileged `10080`/`10443`, so domains can be reached without a port suffix.
  It is a raw byte pipe (no HTTP parsing), so it works for both HTTP and the
  TLS-terminating HTTPS proxy. Mappings are configurable
  (`--http from:to`, `--https from:to`, `--no-http`, `--no-https`), and bind
  failures report a clear message (EACCES → needs sudo, EADDRINUSE → in use).

### Added — Unix socket IPC

- **IPC control channel** (`src/daemon/ipc.ts`): the proxy can expose a
  newline-delimited JSON control server on `~/.locallane/locallane.sock`
  (`proxy --ipc`; the daemon enables it automatically). Commands: `ping`,
  `status` (pid, uptime, configured domains), `reload` (clears the SNI cert
  cache), and `shutdown` (graceful exit). The socket is removed on exit.
- **Daemon IPC subcommands** (`src/cli/daemon.ts`): `daemon ping`,
  `daemon reload`, and a richer `daemon status` that reports live uptime and
  domains. `daemon stop` now shuts down gracefully over IPC before falling back
  to a signal.

### Added — Background daemon

- **Background daemon** (`src/daemon/daemon.ts`, `src/cli/daemon.ts`): run the
  proxy detached from the terminal.
  - `daemon start [--https] [--redirect]` spawns the `proxy` command as a
    detached process, tracks its PID in `~/.locallane/locallane.pid`, and
    appends output to `~/.locallane/daemon.log`.
  - `daemon stop` terminates the running daemon.
  - `daemon status` reports whether it is running (and cleans up stale PID
    files).

### Added — HTTPS support

- **Local root CA** (`src/cert/ca.ts`): generates and caches a self-signed root
  CA under `~/.locallane/ca` using node-forge. Used to sign per-domain certs.
- **Per-domain leaf certificates** (`src/cert/leaf.ts`): generates and caches a
  certificate per domain (with a DNS SAN), signed by the root CA, under
  `~/.locallane/certs`.
- **HTTPS reverse proxy on port 10443** (`src/proxy/server.ts`): loads the
  matching leaf certificate per connection via SNI and reuses the same routing
  and access-logging path as the HTTP proxy.
- **`proxy --https`**: runs the HTTPS proxy alongside the HTTP proxy.
- **`proxy --redirect`**: serves 308 redirects from HTTP (10080) to HTTPS
  (10443) instead of proxying plain HTTP (implies `--https`).
- **`ca` command** (`src/cli/root.ts`): generates the root CA on demand and
  prints platform-specific instructions for trusting it.

Verified end-to-end: `openssl s_client` reports `issuer=CN = LocalLane Local CA`
with `Verify return code: 0 (ok)`, and requests proxy to the correct upstream
over TLS (including path routes).

### Fixed

- **Path-based routing forwarded to the wrong upstream.** The proxy computed the
  route match twice — once on the original URL and again *after* the route prefix
  had been stripped. The second lookup no longer matched the route, so a request
  like `myapp.test/api/users` was forwarded to the domain's port (e.g. `:3000`)
  instead of the route's port (`:8080`). The proxy now reuses the single original
  match. (`src/proxy/server.ts`)
- **`--route` mappings were never persisted.** `start` parsed and printed routes
  but called `setDomain(name, port)` without them, so routes never reached
  `~/.locallane/config.yaml`. Routes are now saved. (`src/cli/start.ts`)
- Removed leftover `console.log` debug output from the proxy request handler.

### Added

- **`/etc/hosts` integration via an explicit `--hosts` flag** on `start` and
  `stop`. The existing `addHost`/`removeHost` helpers are now wired in. Editing
  `/etc/hosts` stays opt-in because it may require `sudo`. (`src/cli/start.ts`,
  `src/cli/stop.ts`)
- **`doctor` command** for diagnostics: verifies the base directory and config
  file, checks whether the proxy port is free, and reports upstream reachability
  for every configured domain and route. (`src/cli/doctor.ts`,
  `src/doctor/doctor.ts`)
- **Access logs.** Each proxied request is logged to the console and appended to
  `~/.locallane/access.log`. Verbosity is controlled by the optional
  `logMode` config field (`full` | `minimal` | `off`). (`src/log/logger.ts`)

### Changed

- Extracted route matching and prefix stripping out of `server.ts` into a
  dedicated, reusable `proxy/router.ts` module. (`src/proxy/router.ts`)
- Centralized port and route-mapping validation in `config/validation.ts`, now
  used by the `start` command. (`src/config/validation.ts`)
