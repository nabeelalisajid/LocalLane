// src/cli/stop.ts
import { Command } from "commander";
import { normalizeDomain, removeDomain } from "../config/config";

export const stopCommand = new Command("stop")
	.argument("<name>")
	.action(async (name: string) => {
		const domain = normalizeDomain(name);
		await removeDomain(domain);
		console.log(`Stopped ${domain}`);
	});
