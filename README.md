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

---

## Roadmap

Planned features:

- HTTPS support
- Local root CA generation
- Per-domain TLS certificates
- SNI-based certificate loading
- HTTP to HTTPS redirect
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
```

Future additions may include:

```text
execa
node-forge
ws
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

  config/
    path.ts
    config.ts
    validation.ts

  proxy/
    server.ts
    router.ts
    health.ts

  doctor/
    doctor.ts

  log/
    logger.ts

  system/
    hosts.ts
```

Future structure (stubs that are scaffolded but not yet implemented):

```text
src/
  cert/
    ca.ts
    leaf.ts

  daemon/
    daemon.ts
    ipc.ts

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
node dist/index.js proxy
```

Behavior:

- Starts HTTP proxy on port `10080`
- Reads incoming `Host` header
- Matches configured domain
- Matches route prefix if available
- Forwards to the correct local upstream
- Returns clean `502` if upstream is unreachable
- Logs each request to the console and `~/.locallane/access.log`

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

## Current Limitations

LocalLane does not yet:

- Support direct browser access through `myapp.test`
- Support HTTPS
- Generate certificates
- Run as a background daemon
- Reload config through IPC
- Expose local apps publicly

For now, use `curl` with a `Host` header:

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

## Planned HTTPS Support

Future HTTPS flow:

```text
Browser
  -> https://myapp.test
  -> 127.0.0.1
  -> LocalLane HTTPS proxy
  -> localhost:3000
```

Required work:

- Generate local root CA
- Trust root CA
- Generate leaf certificate for each local domain
- Load certificates using SNI
- Run HTTPS proxy on port `10443`
- Redirect HTTP to HTTPS

---

## Planned Daemon Support

Current behavior:

```bash
node dist/index.js proxy
```

runs in the foreground.

Future behavior:

```bash
locallane start myapp --port 3000
```

should:

- Save config
- Start daemon if not running
- Reload daemon if already running
- Exit CLI while proxy keeps running

Expected daemon files:

```text
~/.locallane/locallane.pid
~/.locallane/locallane.sock
```

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
