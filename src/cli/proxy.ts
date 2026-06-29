// src/cli/proxy.ts
import { Command } from "commander";
import {
	startHttpProxy,
	startHttpsProxy,
	startHttpRedirect,
} from "../proxy/server";

export const proxyCommand = new Command("proxy")
	.description("Run local proxy")
	.option("--https", "Also start the HTTPS proxy on 10443")
	.option(
		"--redirect",
		"Redirect HTTP to HTTPS instead of proxying (implies --https)",
	)
	.action(async (options: any) => {
		const useHttps = options.https || options.redirect;

		if (options.redirect) {
			startHttpRedirect();
		} else {
			await startHttpProxy();
		}

		if (useHttps) {
			await startHttpsProxy();
		}
	});
