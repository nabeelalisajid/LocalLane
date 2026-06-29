# Changelog

All notable changes to LocalLane are documented in this file.

## [Unreleased]

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
