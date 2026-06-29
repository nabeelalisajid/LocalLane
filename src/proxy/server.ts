// src/proxy/server.ts
import * as http from "node:http";
import httpProxy from "http-proxy";
import { loadConfig } from "../config/config";
import { PROXY_HTTP_PORT } from "../config/path";
import { matchRoute, stripRoutePrefix } from "./router";
import { logAccess } from "../log/logger";

const proxy = httpProxy.createProxyServer({});

proxy.on("error", (err, _req, res) => {
	const response = res as http.ServerResponse;

	if (!response.headersSent) {
		response.writeHead(502, { "Content-Type": "text/plain" });
	}

	response.end(`Bad Gateway: upstream is not running.\n\n${String(err)}\n`);
});

export async function startHttpProxy() {
	const server = http.createServer(async (req, res) => {
		const config = await loadConfig();

		const host = req.headers.host?.split(":")[0];
		const domain = config.domains.find((d) => d.name === host);

		if (!domain) {
			res.statusCode = 404;
			res.end("Domain not configured");
			await logAccess(
				{ host, method: req.method, url: req.url, upstreamPort: 0, status: 404 },
				config.logMode,
			);
			return;
		}

		const originalUrl = req.url ?? "/";
		const match = matchRoute(domain, originalUrl);

		if (match.matchedRoute) {
			req.url = stripRoutePrefix(originalUrl, match.matchedRoute.path);
		}

		res.on("finish", () => {
			void logAccess(
				{
					host,
					method: req.method,
					url: originalUrl,
					upstreamPort: match.port,
					status: res.statusCode,
				},
				config.logMode,
			);
		});

		proxy.web(req, res, {
			target: `http://127.0.0.1:${match.port}`,
			changeOrigin: false,
		});
	});

	server.listen(PROXY_HTTP_PORT, () => {
		console.log(
			`local-lane proxy listening on http://localhost:${PROXY_HTTP_PORT}`,
		);
	});
}
