// src/cli/proxy.ts
import { Command } from "commander";
import {
	startHttpProxy,
	startHttpsProxy,
	startHttpRedirect,
	clearCertCache,
	getUptimeMs,
} from "../proxy/server";
import { loadConfig } from "../config/config";
import { startIpcServer, type IpcResponse } from "../daemon/ipc";

/** Wires the IPC control channel handlers for a running proxy. */
async function startControlChannel() {
	await startIpcServer(async (req): Promise<IpcResponse> => {
		switch (req.cmd) {
			case "ping":
				return { ok: true, pong: true };
			case "status": {
				const config = await loadConfig();
				return {
					ok: true,
					pid: process.pid,
					uptimeMs: getUptimeMs(),
					domains: config.domains.map((d) => d.name),
				};
			}
			case "reload":
				clearCertCache();
				return { ok: true, reloaded: true };
			case "shutdown":
				setTimeout(() => process.exit(0), 50);
				return { ok: true, shuttingDown: true };
			default:
				return { ok: false, error: `unknown command: ${req.cmd}` };
		}
	});
	console.log("local-lane IPC control channel ready");
}

export const proxyCommand = new Command("proxy")
	.description("Run local proxy")
	.option("--https", "Also start the HTTPS proxy on 10443")
	.option(
		"--redirect",
		"Redirect HTTP to HTTPS instead of proxying (implies --https)",
	)
	.option("--ipc", "Expose a Unix-socket control channel for the daemon")
	.action(async (options: any) => {
		const useHttps = options.https || options.redirect;

		if (options.redirect) {
			startHttpRedirect();
		} else {
			await startHttpProxy();
		}

		if (useHttps) {
			await startHttpsProxy();
		}

		if (options.ipc) {
			await startControlChannel();
		}
	});
