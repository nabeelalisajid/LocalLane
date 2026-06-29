// src/cli/tunnel.ts
import { Command } from "commander";
import { startShare } from "../tunnel/client";
import { startTunnelServer } from "../tunnel/server";
import { TUNNEL_WS_PATH } from "../tunnel/protocol";
import { parsePort } from "../config/validation";

const DEFAULT_TUNNEL_PORT = 9000;

export const shareCommand = new Command("share")
	.description("Expose a local port through a public tunnel server")
	.requiredOption("-p, --port <port>", "local port to expose")
	.option(
		"--server <url>",
		"tunnel server WebSocket URL",
		`ws://127.0.0.1:${DEFAULT_TUNNEL_PORT}${TUNNEL_WS_PATH}`,
	)
	.action((options: any) => {
		const port = parsePort(options.port);
		startShare({ port, serverUrl: options.server });
	});

export const tunnelServerCommand = new Command("tunnel-server")
	.description("Run the public tunnel server")
	.option("--port <port>", "public port to listen on", String(DEFAULT_TUNNEL_PORT))
	.option(
		"--host <host>",
		"hostname used when building public URLs (e.g. lvh.me)",
		"lvh.me",
	)
	.action((options: any) => {
		startTunnelServer({ port: parsePort(options.port), host: options.host });
	});
