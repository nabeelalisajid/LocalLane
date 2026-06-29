import { Command } from "commander";
import { addHost } from "../system/hosts";
import { setDomain } from "../config/config";
import { parsePort, parseRoutes } from "../config/validation";

function collectRoute(value: string, previous: string[]): string[] {
	previous.push(value);
	return previous;
}

export const startCommand = new Command("start")
	.argument("<name>")
	.requiredOption("-p, --port <port>", "local port")
	.option("--route <mapping>", "Route mapping like /api=8080", collectRoute, [])
	.option("--hosts", "Add a 127.0.0.1 entry to /etc/hosts (may require sudo)")
	.action(async (name: string, options: any) => {
		const port = parsePort(options.port);
		const routes = parseRoutes(options.route ?? []);
		const domain = await setDomain(name, port, routes);

		if (options.hosts) {
			await addHost(domain);
			console.log(`✓ /etc/hosts updated: 127.0.0.1 ${domain}`);
		}

		console.log(`✓ https://${domain} -> localhost:${port}`);
		for (const route of routes) {
			console.log(`  http://${domain}${route.path} -> localhost:${route.port}`);
		}
	});
