import { Command } from "commander";

import { setDomain } from "../config/config";

export const startCommand = new Command("start")
	.argument("<name>")
	.requiredOption("-p, --port <port>", "local port")
	.action(async (name: any, options: any) => {
		const port = Number(options.port);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw new Error("Invalid Port");
		}

		const domain = await setDomain(name, port);
		console.log(`✓ https://${domain} -> localhost:${port}`);
	});
