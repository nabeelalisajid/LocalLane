// src/proxy/server.ts
import * as http from "node:http";
import * as https from "node:https";
import * as tls from "node:tls";
import httpProxy from "http-proxy";
import { loadConfig } from "../config/config";
import { PROXY_HTTP_PORT, PROXY_HTTPS_PORT } from "../config/path";
import { matchRoute, stripRoutePrefix } from "./router";
import { logAccess } from "../log/logger";
import { ensureLeafCert } from "../cert/leaf";

const proxy = httpProxy.createProxyServer({});

// Per-domain TLS contexts loaded lazily via SNI. Kept at module scope so the
// IPC `reload` command can clear it without restarting the proxy.
const contextCache = new Map<string, tls.SecureContext>();

// When the proxy started, used by the IPC `status` command to report uptime.
const startedAt = Date.now();

/** Milliseconds since the proxy process started serving. */
export function getUptimeMs(): number {
	return Date.now() - startedAt;
}

/** Drops all cached TLS contexts so changed certs are reloaded on next use. */
export function clearCertCache(): void {
	contextCache.clear();
}

proxy.on("error", (err, _req, res) => {
	const response = res as http.ServerResponse;

	if (!response.headersSent) {
		response.writeHead(502, { "Content-Type": "text/plain" });
	}

	response.end(`Bad Gateway: upstream is not running.\n\n${String(err)}\n`);
});

/**
 * Shared request handler for both the HTTP and HTTPS proxies. Resolves the
 * domain from the Host header, applies route matching/prefix stripping, logs
 * the request, and forwards it to the matched upstream.
 */
async function handleRequest(
	req: http.IncomingMessage,
	res: http.ServerResponse,
) {
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
}

/** Starts the plain HTTP reverse proxy on PROXY_HTTP_PORT. */
export async function startHttpProxy() {
	const server = http.createServer(handleRequest);
	server.listen(PROXY_HTTP_PORT, () => {
		console.log(
			`local-lane proxy listening on http://localhost:${PROXY_HTTP_PORT}`,
		);
	});
}

/**
 * Starts the HTTPS reverse proxy on PROXY_HTTPS_PORT. Certificates are loaded
 * per-connection via SNI: the leaf cert for the requested servername is
 * generated/cached on demand and signed by the local root CA.
 */
export async function startHttpsProxy() {
	async function getContext(servername: string): Promise<tls.SecureContext> {
		const cached = contextCache.get(servername);
		if (cached) return cached;

		const leaf = await ensureLeafCert(servername);
		const ctx = tls.createSecureContext({
			cert: leaf.certPem,
			key: leaf.keyPem,
		});
		contextCache.set(servername, ctx);
		return ctx;
	}

	// A default cert is required to construct the server; reuse it for the
	// localhost name and let SNI swap in per-domain certs for real requests.
	const fallback = await ensureLeafCert("localhost");

	const server = https.createServer(
		{
			cert: fallback.certPem,
			key: fallback.keyPem,
			SNICallback: (servername, cb) => {
				getContext(servername)
					.then((ctx) => cb(null, ctx))
					.catch((err) => cb(err as Error));
			},
		},
		handleRequest,
	);

	server.listen(PROXY_HTTPS_PORT, () => {
		console.log(
			`local-lane proxy listening on https://localhost:${PROXY_HTTPS_PORT}`,
		);
	});
}

/**
 * Starts an HTTP server on PROXY_HTTP_PORT that redirects every request to the
 * HTTPS proxy instead of forwarding it. Used when --redirect is passed.
 */
export function startHttpRedirect() {
	const server = http.createServer((req, res) => {
		const host = req.headers.host?.split(":")[0] ?? "localhost";
		const location = `https://${host}:${PROXY_HTTPS_PORT}${req.url ?? "/"}`;
		res.writeHead(308, { Location: location });
		res.end();
	});

	server.listen(PROXY_HTTP_PORT, () => {
		console.log(
			`local-lane redirecting http://localhost:${PROXY_HTTP_PORT} -> https://localhost:${PROXY_HTTPS_PORT}`,
		);
	});
}
