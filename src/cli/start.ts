import { Command } from "commander";
import { addHost } from "../system/hosts";
import { setDomain, type Route } from "../config/config";

function collectRoute(value: string, previous: string[]): string[] {
	previous.push(value);
	return previous;
}
function parseRoutes(routeMappings: string[]): Route[] {
	return routeMappings.map((mapping) => {
		const parts = mapping.split("=");

		if (parts.length !== 2) {
			throw new Error(
				`Invalid route "${mapping}". Expected format: /path=port`,
			);
		}

		const [routePath, portValue] = parts;

		if (!routePath.startsWith("/")) {
			throw new Error(
				`Invalid route path "${routePath}". Route must start with /`,
			);
		}

		const port = Number(portValue);

		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw new Error(`Invalid route port "${portValue}"`);
		}

		return {
			path: routePath,
			port,
		};
	});
}
export const startCommand = new Command("start")
	.argument("<name>")
	.requiredOption("-p, --port <port>", "local port")
	.option("--route <mapping>", "Route mapping like /api=8080", collectRoute, [])
	.action(async (name: any, options: any) => {
		const port = Number(options.port);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw new Error("Invalid Port");
		}
		const routes = parseRoutes(options.route ?? []);
		const domain = await setDomain(name, port);
		// await addHost(domain);
		console.log(`✓ https://${domain} -> localhost:${port}`);
		for (const route of routes) {
			console.log(`  http://${domain}${route.path} -> localhost:${route.port}`);
		}
	});
