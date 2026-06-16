// src/proxy/server.ts
import * as http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
// import http from "http";
import httpProxy from "http-proxy";
import { loadConfig, type Domain, type Route } from "../config/config";
import { PROXY_HTTP_PORT } from "../config/path";

const proxy = httpProxy.createProxyServer({});
proxy.on("error", (err, req, res) => {
	const response = res as import("node:http").ServerResponse;

	if (!response.headersSent) {
		response.writeHead(502, { "Content-Type": "text/plain" });
	}

	response.end(`Bad Gateway: upstream is not running.\n\n${String(err)}\n`);
});
type RouteMatch = {
	port: number;
	matchedRoute?: Route;
};
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
		const originalUrl = req.url ?? "/";
		const match = matchRoute(domain, originalUrl);
		if (match.matchedRoute) {
			req.url = stripRoutePrefix(originalUrl, match.matchedRoute.path);
		}

		const targetPort = matchRoute(domain, req.url ?? "/");
		console.log(targetPort);
		proxy.web(req, res, {
			target: `http://127.0.0.1:${targetPort.port}`,
			changeOrigin: false,
		});
	});

	server.listen(PROXY_HTTP_PORT, () => {
		console.log(
			`local-lane proxy listening on http://localhost:${PROXY_HTTP_PORT}`,
		);
	});
}

function matchRoute(domain: Domain, urlPath: string): RouteMatch {
	const pathname = getPathname(urlPath);

	const routes = [...(domain.routes ?? [])].sort(
		(a, b) => b.path.length - a.path.length,
	);

	for (const route of routes) {
		if (pathname === route.path || pathname.startsWith(route.path + "/")) {
			return {
				port: route.port,
				matchedRoute: route,
			};
		}
	}

	return {
		port: domain.port,
	};
}
function getPathname(rawUrl: string): string {
	const url = new URL(rawUrl, "http://localhost");
	return url.pathname;
}

function stripRoutePrefix(rawUrl: string, prefix: string): string {
	const url = new URL(rawUrl, "http://localhost");

	let newPath = url.pathname.slice(prefix.length);

	if (newPath === "") {
		newPath = "/";
	}

	if (!newPath.startsWith("/")) {
		newPath = "/" + newPath;
	}

	return newPath + url.search;
}
