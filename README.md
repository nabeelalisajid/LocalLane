# LocalLane

LocalLane is a local development proxy tool that maps clean local domains to local application ports.

It is inspired by tools like ngrok and local reverse proxies, but the goal of this project is also educational: to learn how CLI tools, reverse proxies, routing, local networking, hosts files, HTTPS certificates, daemons, IPC, and public tunnels work internally.

> Current stage: TypeScript/Node.js implementation for learning and prototyping.  
> Future stage: rebuild the same project in Go.

---

## Why LocalLane?

During local development, applications usually run on ports like:

```bash
http://localhost:3000
http://localhost:8080
```

LocalLane lets you map those apps to cleaner development domains:

```text
myapp.test -> localhost:3000
myapp.test/api -> localhost:8080
```

Current usage is through the proxy port:

```bash
curl -H "Host: myapp.test" http://localhost:10080/
```

Future versions will support direct browser usage such as:

```text
http://myapp.test
https://myapp.test
```

---

## Current Features

LocalLane currently supports:

- CLI commands using `commander`
- Local YAML config file
- Domain normalization
- Start/list/stop commands
- HTTP reverse proxy
- Host-based routing
- Path-based route support (correctly forwards to the matched route port)
- Route prefix stripping
- Upstream health checks
- Clean `502 Bad Gateway` handling when upstream apps are down
- Explicit `/etc/hosts` integration with `--hosts`
- `doctor` command for diagnostics
- Access logs (`~/.locallane/access.log`)
- HTTPS proxy with a local root CA and per-domain certificates (SNI)
- HTTP to HTTPS redirect

---

## Roadmap

Planned features:

- Port forwarding from `80 -> 10080` and `443 -> 10443`
- Background daemon
- Unix socket IPC
- Public WebSocket tunnel
- Go implementation

---

## Tech Stack

Current stack:

```text
TypeScript
Node.js
CommonJS
commander
yaml
fs-extra
http-proxy
execa          # sudo tee for /etc/hosts
node-forge     # root CA + per-domain certificates
```

Future additions may include:

```text
ws             # public WebSocket tunnel
```

---

## Project Structure

```text
src/
  index.ts

  cli/
    start.ts
    stop.ts
    list.ts
    proxy.ts
    doctor.ts
    root.ts      # `ca` command
    daemon.ts

  config/
    path.ts
    config.ts
    validation.ts

  proxy/
    server.ts
    router.ts
    health.ts

  cert/
    ca.ts        # local root CA
    leaf.ts      # per-domain certificates

  daemon/
    daemon.ts    # background process management
    ipc.ts       # unix socket control channel

  doctor/
    doctor.ts

  log/
    logger.ts

  system/
    hosts.ts
    port-forward.ts   # 80/443 -> 10080/10443
```

Future structure (stubs that are scaffolded but not yet implemented):

```text
src/
  tunnel/
    client.ts
    server.ts
```

---

## Installation

Clone the repository:

```bash
git clone <your-repo-url>
cd LocalLane
```

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

---

## Usage

### Start a local app

For testing, start a simple app on port `3000`:

```bash
node -e "require('node:http').createServer((req,res)=>res.end('MAIN APP: ' + req.url)).listen(3000, '127.0.0.1')"
```

Keep this terminal running.

---

### Register a domain

In another terminal:

```bash
node dist/index.js start myapp --port 3000
```

This creates or updates:

```text
~/.locallane/config.yaml
```

Example config:

```yaml
domains:
  - name: myapp.test
    port: 3000
    routes: []
```

---

### List configured domains

```bash
node dist/index.js list
```

Example output:

```text
http://myapp.test -> localhost:3000 (reachable)
```

---

### Start the proxy

```bash
node dist/index.js proxy
```

Expected output:

```text
LocalLane proxy listening on http://localhost:10080
```

Keep this terminal running.

---

### Test the proxy

In another terminal:

```bash
curl -H "Host: myapp.test" http://localhost:10080/
```

Expected result:

```text
MAIN APP: /
```

---

## Route Support

LocalLane supports path-based routes.

Register a route:

```bash
node dist/index.js start myapp --port 3000 --route /api=8080
```

Start a test API app:

```bash
node -e "require('node:http').createServer((req,res)=>res.end('API APP: ' + req.url)).listen(8080, '127.0.0.1')"
```

Start the proxy if it is not already running:

```bash
node dist/index.js proxy
```

Test the route:

```bash
curl -H "Host: myapp.test" http://localhost:10080/api/users
```

Expected result:

```text
API APP: /users
```

The `/api` prefix is stripped before forwarding to the upstream service.

---

## How Routing Works

Given this config:

```yaml
domains:
  - name: myapp.test
    port: 3000
    routes:
      - path: /api
        port: 8080
```

LocalLane routes requests like this:

```text
myapp.test/          -> localhost:3000/
myapp.test/about     -> localhost:3000/about
myapp.test/api       -> localhost:8080/
myapp.test/api/users -> localhost:8080/users
```

Route matching uses longest-prefix matching.

Example:

```yaml
routes:
  - path: /api
    port: 8080
  - path: /api/admin
    port: 9000
```

Request:

```text
/api/admin/users
```

Should go to:

```text
localhost:9000/users
```

not:

```text
localhost:8080/admin/users
```

---

## Current Commands

### `start`

```bash
node dist/index.js start <name> --port <port>
```

Example:

```bash
node dist/index.js start myapp --port 3000
```

With route:

```bash
node dist/index.js start myapp --port 3000 --route /api=8080
```

With a `/etc/hosts` entry:

```bash
node dist/index.js start myapp --port 3000 --hosts
```

Behavior:

- Normalizes the domain
- Adds `.test` if no TLD is provided
- Validates the port and any route mappings
- Saves config to `~/.locallane/config.yaml` (including routes)
- With `--hosts`, adds `127.0.0.1 myapp.test # local-lane` to `/etc/hosts`
  (may prompt for `sudo`)

---

### `list`

```bash
node dist/index.js list
```

Behavior:

- Reads configured domains
- Shows upstream ports
- Checks whether upstream apps are reachable

---

### `stop`

```bash
node dist/index.js stop <name>
```

Example:

```bash
node dist/index.js stop myapp
```

With `--hosts` to also remove the `/etc/hosts` entry:

```bash
node dist/index.js stop myapp --hosts
```

Behavior:

- Removes the domain from config
- With `--hosts`, removes the matching `/etc/hosts` entry (may prompt for `sudo`)

---

### `proxy`

```bash
node dist/index.js proxy            # HTTP only on 10080
node dist/index.js proxy --https    # HTTP on 10080 + HTTPS on 10443
node dist/index.js proxy --redirect # HTTP 308-redirects to HTTPS (implies --https)
```

Behavior:

- Starts HTTP proxy on port `10080`
- Reads incoming `Host` header
- Matches configured domain
- Matches route prefix if available
- Forwards to the correct local upstream
- Returns clean `502` if upstream is unreachable
- Logs each request to the console and `~/.locallane/access.log`
- With `--https`, also serves HTTPS on `10443`, presenting a per-domain
  certificate loaded via SNI
- With `--redirect`, the HTTP port returns `308` redirects to the HTTPS port
  instead of proxying plain HTTP

---

### `ca`

```bash
node dist/index.js ca
```

Behavior:

- Generates the local root CA (if missing) under `~/.locallane/ca`
- Prints platform-specific instructions for trusting it

See [HTTPS](#https) below for the full workflow.

---

### `daemon`

Run the proxy in the background instead of the foreground:

```bash
node dist/index.js daemon start              # background HTTP proxy
node dist/index.js daemon start --https      # also HTTPS on 10443
node dist/index.js daemon status             # running? uptime + domains
node dist/index.js daemon ping               # check the IPC channel
node dist/index.js daemon reload             # clear the TLS cert cache
node dist/index.js daemon stop               # stop it (graceful via IPC)
```

Behavior:

- `start` spawns the `proxy --ipc` command as a detached process and records its
  PID in `~/.locallane/locallane.pid`; output is appended to
  `~/.locallane/daemon.log`
- `status` reports whether the daemon is running (clears stale PID files) and,
  via the IPC channel, its uptime and configured domains
- `ping` / `reload` talk to the daemon over its Unix socket
- `stop` asks the daemon to shut down gracefully over IPC, then falls back to a
  signal if needed

The daemon exposes a control channel on a Unix socket
(`~/.locallane/locallane.sock`); see [IPC](#ipc) below.

---

### `forward`

Forward the privileged ports `80`/`443` to the proxy so domains work without a
port suffix (e.g. `http://myapp.test` instead of `http://myapp.test:10080`):

```bash
sudo node dist/index.js forward            # 80 -> 10080 and 443 -> 10443
sudo node dist/index.js forward --no-https # only 80 -> 10080
node dist/index.js forward --http 8080:10080 --no-https  # custom, unprivileged
```

Behavior:

- Raw TCP pipe, so it works for both the HTTP and HTTPS proxies (TLS is
  terminated downstream by the HTTPS proxy)
- Mappings are configurable via `--http from:to` / `--https from:to`
- Binding `80`/`443` requires `sudo`; a permission error is reported clearly
- Runs in the foreground; press Ctrl+C to stop

---

### `doctor`

```bash
node dist/index.js doctor
```

Behavior:

- Checks the base directory `~/.locallane`
- Checks that the config file exists and parses
- Checks whether the proxy port `10080` is free to bind
- Reports reachability for every configured domain and route

Example output:

```text
✓ Base directory: /home/you/.locallane
✓ Config file: /home/you/.locallane/config.yaml
✓ Proxy port: :10080 is free
✓ Upstream myapp.test: localhost:3000 reachable
! Upstream myapp.test/api: localhost:8080 unreachable
```

---

## Access Logs

When the proxy is running, every request is written to the console and appended
to:

```text
~/.locallane/access.log
```

Each line looks like:

```text
2026-06-29T05:31:30.972Z myapp.test GET /api/users -> :8080 200
```

Verbosity is controlled by an optional `logMode` field in `config.yaml`:

```yaml
logMode: full      # full (default) | minimal (non-2xx only) | off
domains:
  - name: myapp.test
    port: 3000
    routes: []
```

---

## HTTPS

LocalLane can serve your local domains over HTTPS using a local root CA and
per-domain certificates loaded via SNI.

**1. Generate and trust the root CA (once):**

```bash
node dist/index.js ca
```

Follow the printed instructions to add `~/.locallane/ca/rootCA.crt` to your
system / browser trust store. The CA is only used to sign local development
certificates.

**2. Register a domain and start the HTTPS proxy:**

```bash
node dist/index.js start myapp --port 3000 --hosts
node dist/index.js proxy --https
```

A leaf certificate for `myapp.test` is generated and cached under
`~/.locallane/certs` the first time it is requested.

**3. Test it:**

```bash
curl --cacert ~/.locallane/ca/rootCA.crt \
  --resolve myapp.test:10443:127.0.0.1 \
  https://myapp.test:10443/
```

Or, once the CA is trusted and `--hosts` has added the entry, open
`https://myapp.test:10443` directly. To make plain HTTP bounce to HTTPS, run the
proxy with `--redirect`.

> Note: ports `10443`/`10080` are used because binding `443`/`80` requires
> elevated privileges. Use [`forward`](#forward) to map `443 -> 10443` and
> `80 -> 10080` and drop the port suffix.

---

## Current Limitations

LocalLane does not yet:

- Expose local apps publicly

For plain HTTP without a hosts entry, use `curl` with a `Host` header:

```bash
curl -H "Host: myapp.test" http://localhost:10080/
```

---

## Hosts Integration

Implemented via the explicit `--hosts` flag:

```bash
node dist/index.js start myapp --port 3000 --hosts
```

This adds the following line to `/etc/hosts`:

```text
127.0.0.1 myapp.test # local-lane
```

Removing it again:

```bash
node dist/index.js stop myapp --hosts
```

Editing `/etc/hosts` requires `sudo`, so LocalLane only touches it when you pass
`--hosts` — it never modifies system files implicitly.

---

## HTTPS Architecture

Implemented HTTPS flow:

```text
Browser
  -> https://myapp.test
  -> 127.0.0.1
  -> LocalLane HTTPS proxy (:10443, per-domain cert via SNI)
  -> localhost:3000
```

Implemented:

- Generate local root CA (`ca` command, `src/cert/ca.ts`)
- Generate a leaf certificate per local domain (`src/cert/leaf.ts`)
- Load certificates using SNI (`src/proxy/server.ts`)
- Run HTTPS proxy on port `10443` (`proxy --https`)
- Redirect HTTP to HTTPS (`proxy --redirect`)

Remaining (manual):

- Trusting the root CA is a one-time manual step (printed by `ca`)
- Binding `443`/`80` directly needs `sudo` (see the `forward` command)

---

## Daemon Support

The proxy can run in the foreground:

```bash
node dist/index.js proxy
```

…or detached in the background:

```bash
node dist/index.js daemon start --https
node dist/index.js daemon status
node dist/index.js daemon stop
```

The daemon spawns the `proxy --ipc` command as a detached process, records its
PID, and logs to a file:

```text
~/.locallane/locallane.pid
~/.locallane/daemon.log
~/.locallane/locallane.sock   # IPC control channel
```

---

## IPC

When the proxy runs with `--ipc` (always the case under the daemon), it exposes
a control channel on a Unix socket at `~/.locallane/locallane.sock`. Messages are
newline-delimited JSON.

Supported commands:

| Command    | Response                                      |
|------------|-----------------------------------------------|
| `ping`     | `{ ok: true, pong: true }`                    |
| `status`   | `{ ok: true, pid, uptimeMs, domains: [...] }` |
| `reload`   | clears the SNI cert cache                     |
| `shutdown` | graceful exit                                 |

These back the `daemon ping`, `daemon status`, `daemon reload`, and `daemon stop`
commands. Configured domains are re-read from `config.yaml` on every request, so
adding or removing a domain takes effect without a reload; `reload` is only
needed to drop cached TLS certificates.

---

## Planned Public Tunnel

Future command:

```bash
locallane share --port 3000
```

Expected architecture:

```text
Public user
  -> remote LocalLane tunnel server
  -> WebSocket connection
  -> local LocalLane client
  -> localhost:3000
```

This will be built after the local proxy, HTTPS, daemon, and IPC features are stable.

---

## Learning Goals

This project is designed to learn:

- CLI tool architecture
- Config management
- Reverse proxy internals
- Host-based routing
- Path-based routing
- TCP health checks
- `/etc/hosts`
- TLS and certificates
- Root CA and leaf certificates
- SNI
- Port forwarding
- Background daemons
- Unix socket IPC
- WebSocket tunneling
- Go migration from TypeScript

---

## Go Migration Plan

After completing the TypeScript implementation, LocalLane will be rebuilt in Go.

Mapping:

```text
commander            -> cobra
fs-extra             -> os, filepath
yaml                 -> yaml.v3
http-proxy           -> httputil.ReverseProxy
node:http            -> net/http
node:net             -> net
child_process        -> os/exec
node-forge/openssl   -> crypto/x509, crypto/tls
ws                   -> coder/websocket or gorilla/websocket
```

Expected Go structure:

```text
cmd/
internal/config/
internal/proxy/
internal/system/
internal/cert/
internal/daemon/
internal/tunnel/
protocol/
```

---

## Development Notes

The project currently uses CommonJS to keep TypeScript imports clean:

```ts
import { loadConfig } from "../config/config";
```

This avoids NodeNext ESM requiring `.js` extensions in TypeScript source files.

---

## License

MIT
