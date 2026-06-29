// src/doctor/doctor.ts
// Diagnostics for a LocalLane setup. Checks that the config exists and parses,
// that the proxy port is free to bind, and that every configured upstream
// (domain + routes) is reachable.
import net from "node:net";
import fs from "fs-extra";
import { loadConfig } from "../config/config";
import { checkPort } from "../proxy/health";
import { BASE_DIR, CONFIG_PATH, PROXY_HTTP_PORT } from "../config/path";

export type CheckStatus = "ok" | "warn" | "fail";

export type DiagnosticCheck = {
	name: string;
	status: CheckStatus;
	detail: string;
};

/** Resolves true if a TCP port can be bound on localhost (i.e. it is free). */
function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => server.close(() => resolve(true)));
		server.listen(port, "127.0.0.1");
	});
}

/** Runs every diagnostic check and returns the results. */
export async function runDiagnostics(): Promise<DiagnosticCheck[]> {
	const checks: DiagnosticCheck[] = [];

	// Base dir
	checks.push({
		name: "Base directory",
		status: (await fs.pathExists(BASE_DIR)) ? "ok" : "warn",
		detail: BASE_DIR,
	});

	// Config file
	const hasConfig = await fs.pathExists(CONFIG_PATH);
	let config = null;
	let configError: string | null = null;
	if (hasConfig) {
		try {
			config = await loadConfig();
		} catch (err) {
			configError = String(err);
		}
	}
	checks.push({
		name: "Config file",
		status: !hasConfig ? "warn" : configError ? "fail" : "ok",
		detail: !hasConfig
			? `${CONFIG_PATH} (not created yet — run "start")`
			: configError ?? CONFIG_PATH,
	});

	// Proxy port availability
	const free = await isPortFree(PROXY_HTTP_PORT);
	checks.push({
		name: "Proxy port",
		status: free ? "ok" : "warn",
		detail: free
			? `:${PROXY_HTTP_PORT} is free`
			: `:${PROXY_HTTP_PORT} is in use (proxy already running?)`,
	});

	// Upstream reachability
	if (config && config.domains.length > 0) {
		for (const domain of config.domains) {
			const healthy = await checkPort(domain.port);
			checks.push({
				name: `Upstream ${domain.name}`,
				status: healthy ? "ok" : "warn",
				detail: `localhost:${domain.port} ${healthy ? "reachable" : "unreachable"}`,
			});
			for (const route of domain.routes ?? []) {
				const routeHealthy = await checkPort(route.port);
				checks.push({
					name: `Upstream ${domain.name}${route.path}`,
					status: routeHealthy ? "ok" : "warn",
					detail: `localhost:${route.port} ${routeHealthy ? "reachable" : "unreachable"}`,
				});
			}
		}
	}

	return checks;
}
