// src/proxy/server.ts
import http from "http";
import httpProxy from "http-proxy";
import { loadConfig } from "../config/config";
import { PROXY_HTTP_PORT } from "../config/path";

const proxy = httpProxy.createProxyServer({});

export async function startHttpProxy() {
	const server = http.createServer(async (req, res) => {
		const config = await loadConfig();

		const host = req.headers.host?.split(":")[0];

		const domain = config.domains.find((d) => d.name === host);

		if (!domain) {
			res.statusCode = 404;
			res.end("Domain not configured");
			return;
		}

		const targetPort = matchRoute(domain, req.url ?? "/");

		proxy.web(req, res, {
			target: `http://localhost:${targetPort}`,
			changeOrigin: false,
		});
	});

	server.listen(PROXY_HTTP_PORT, () => {
		console.log(
			`local-lane proxy listening on http://localhost:${PROXY_HTTP_PORT}`,
		);
	});
}

function matchRoute(domain: any, urlPath: string) {
	const routes = [...(domain.routes ?? [])].sort(
		(a, b) => b.path.length - a.path.length,
	);

	for (const route of routes) {
		if (urlPath === route.path || urlPath.startsWith(route.path + "/")) {
			return route.port;
		}
	}

	return domain.port;
}
