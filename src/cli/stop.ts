// src/cli/stop.ts
import { Command } from "commander";
import { normalizeDomain, removeDomain } from "../config/config";
import { removeHost } from "../system/hosts";

export const stopCommand = new Command("stop")
	.argument("<name>")
	.option("--hosts", "Also remove the /etc/hosts entry (may require sudo)")
	.action(async (name: string, options: any) => {
		const domain = normalizeDomain(name);
		await removeDomain(domain);

		if (options.hosts) {
			await removeHost(domain);
			console.log(`✓ /etc/hosts entry removed for ${domain}`);
		}

		console.log(`Stopped ${domain}`);
	});
