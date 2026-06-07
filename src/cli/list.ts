// src/cli/list.ts
import { Command } from "commander";
import { loadConfig } from "../config/config";

export const listCommand = new Command("list")
	.description("List domains")
	.action(async () => {
		const config = await loadConfig();

		if (config.domains.length === 0) {
			console.log("No domains configured.");
			return;
		}

		for (const d of config.domains) {
			console.log(`https://${d.name} -> localhost:${d.port}`);
			for (const r of d.routes ?? []) {
				console.log(`  https://${d.name}${r.path} -> localhost:${r.port}`);
			}
		}
	});
