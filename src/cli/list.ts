// src/cli/list.ts
import { Command } from "commander";
import { loadConfig } from "../config/config";
import { checkPort } from "../proxy/health";
function statusLabel(isHealthy: boolean): string {
	return isHealthy ? "reachable" : "unreachable";
}
export const listCommand = new Command("list")
	.description("List domains")
	.action(async () => {
		const config = await loadConfig();

		if (config.domains.length === 0) {
			console.log("No domains configured.");
			return;
		}

		for (const domain of config.domains) {
			const healthy = await checkPort(domain.port);
			console.log(
				`http://${domain.name} -> localhost:${domain.port} (${statusLabel(healthy)})`,
			);
			for (const route of domain.routes ?? []) {
				const routeHealthy = await checkPort(route.port);

				console.log(
					`  http://${domain.name}${route.path} -> localhost:${
						route.port
					} (${statusLabel(routeHealthy)})`,
				);
			}
		}
	});
