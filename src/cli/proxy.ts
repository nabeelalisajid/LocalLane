// src/cli/proxy.ts
import { Command } from "commander";
import { startHttpProxy } from "../proxy/server";

export const proxyCommand = new Command("proxy")
	.description("Run local proxy")
	.action(async () => {
		await startHttpProxy();
	});
