// src/proxy/router.ts
// Host/path routing logic for the proxy, extracted from server.ts so it can be
// unit-tested and reused (e.g. by a future HTTPS proxy or daemon).
import type { Domain, Route } from "../config/config";

export type RouteMatch = {
	/** Upstream port the request should be forwarded to. */
	port: number;
	/** The matched route, if a path-based route was used (undefined => domain root). */
	matchedRoute?: Route;
};

/**
 * Finds the upstream for a request URL using longest-prefix matching over the
 * domain's routes, falling back to the domain's own port.
 */
export function matchRoute(domain: Domain, urlPath: string): RouteMatch {
	const pathname = getPathname(urlPath);

	const routes = [...(domain.routes ?? [])].sort(
		(a, b) => b.path.length - a.path.length,
	);

	for (const route of routes) {
		if (pathname === route.path || pathname.startsWith(route.path + "/")) {
			return { port: route.port, matchedRoute: route };
		}
	}

	return { port: domain.port };
}

/**
 * Removes a matched route prefix from the URL before forwarding upstream, so
 * `myapp.test/api/users` reaches the upstream as `/users`. The query string is
 * preserved.
 */
export function stripRoutePrefix(rawUrl: string, prefix: string): string {
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

function getPathname(rawUrl: string): string {
	const url = new URL(rawUrl, "http://localhost");
	return url.pathname;
}
