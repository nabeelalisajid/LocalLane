// src/cli/stop.ts
import { Command } from "commander";
import { normalizeDomain, removeDomain } from "../config/config";
import { removeHost } from "../system/hosts";

export const stopCommand = new Command("stop")
	.argument("<name>")
	.action(async (name: string) => {
		const domain = normalizeDomain(name);
		await removeDomain(domain);
		// await removeHost(domain);
		console.log(`Stopped ${domain}`);
	});
