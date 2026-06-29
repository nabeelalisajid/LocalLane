// src/cli/forward.ts
import { Command } from "commander";
import { startForward } from "../system/port-forward";
import { parsePort } from "../config/validation";
import { PROXY_HTTP_PORT, PROXY_HTTPS_PORT } from "../config/path";

/** Parses a `from:to` port mapping. */
function parseMapping(value: string): { from: number; to: number } {
	const parts = value.split(":");
	if (parts.length !== 2) {
		throw new Error(`Invalid mapping "${value}". Expected format: from:to`);
	}
	return {
		from: parsePort(parts[0], "source port"),
		to: parsePort(parts[1], "target port"),
	};
}

async function forward(map: { from: number; to: number }): Promise<void> {
	try {
		await startForward(map.from, map.to);
		console.log(`✓ forwarding :${map.from} -> :${map.to}`);
	} catch (err: any) {
		if (err.code === "EACCES") {
			console.error(
				`✗ cannot bind port ${map.from}: permission denied. ` +
					`Binding ports below 1024 requires sudo.`,
			);
		} else if (err.code === "EADDRINUSE") {
			console.error(`✗ cannot bind port ${map.from}: already in use.`);
		} else {
			console.error(`✗ failed to forward :${map.from}: ${String(err)}`);
		}
		process.exitCode = 1;
	}
}

export const forwardCommand = new Command("forward")
	.description("Forward privileged ports 80/443 to the proxy (10080/10443)")
	.option("--http <from:to>", "HTTP port mapping", `80:${PROXY_HTTP_PORT}`)
	.option("--https <from:to>", "HTTPS port mapping", `443:${PROXY_HTTPS_PORT}`)
	.option("--no-http", "Do not forward the HTTP port")
	.option("--no-https", "Do not forward the HTTPS port")
	.action(async (options: any) => {
		if (options.http) await forward(parseMapping(options.http));
		if (options.https) await forward(parseMapping(options.https));

		if (!options.http && !options.https) {
			console.log("Nothing to forward (both --no-http and --no-https set).");
			return;
		}

		console.log("Forwarding... press Ctrl+C to stop.");
	});
