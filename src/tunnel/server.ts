// src/tunnel/server.ts
// Public-facing tunnel server. Local clients connect over a WebSocket and are
// each assigned a random subdomain. Incoming public HTTP requests are routed to
// the client whose id matches the first label of the Host header, forwarded
// over the WebSocket, and the client's response is written back.
//
//   Public user -> tunnel server (:port) --WebSocket--> local client -> app
import * as http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
	TUNNEL_WS_PATH,
	type ClientMessage,
	type HeaderMap,
	type ServerMessage,
} from "./protocol";

export type TunnelServerOptions = {
	port: number;
	host: string;
	requestTimeoutMs?: number;
};

// Response headers that must not be copied verbatim — Node sets them based on
// the buffered body we write.
const HOP_BY_HOP = new Set([
	"connection",
	"keep-alive",
	"transfer-encoding",
	"content-length",
]);

function sanitizeHeaders(headers: HeaderMap): HeaderMap {
	const out: HeaderMap = {};
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined) continue;
		if (HOP_BY_HOP.has(key.toLowerCase())) continue;
		out[key] = value;
	}
	return out;
}

export function startTunnelServer(options: TunnelServerOptions): http.Server {
	const timeoutMs = options.requestTimeoutMs ?? 30000;
	const clients = new Map<string, WebSocket>();
	const pending = new Map<string, http.ServerResponse>();

	const server = http.createServer((req, res) => {
		const host = (req.headers.host ?? "").split(":")[0];
		const id = host.split(".")[0];
		const ws = clients.get(id);

		if (!ws) {
			res.statusCode = 404;
			res.end(`No active tunnel for "${id}"\n`);
			return;
		}

		const chunks: Buffer[] = [];
		req.on("data", (c) => chunks.push(c as Buffer));
		req.on("end", () => {
			const requestId = randomBytes(8).toString("hex");
			pending.set(requestId, res);

			const message: ServerMessage = {
				type: "request",
				requestId,
				method: req.method ?? "GET",
				url: req.url ?? "/",
				headers: req.headers,
				body: Buffer.concat(chunks).toString("base64"),
			};
			ws.send(JSON.stringify(message));

			setTimeout(() => {
				if (!pending.delete(requestId)) return;
				if (!res.headersSent) {
					res.statusCode = 504;
					res.end("Tunnel request timed out\n");
				}
			}, timeoutMs);
		});
	});

	const wss = new WebSocketServer({ server, path: TUNNEL_WS_PATH });

	wss.on("connection", (ws) => {
		const id = randomBytes(4).toString("hex");
		clients.set(id, ws);

		const url = `http://${id}.${options.host}:${options.port}`;
		const ready: ServerMessage = { type: "ready", id, url };
		ws.send(JSON.stringify(ready));
		console.log(`tunnel client connected: ${url}`);

		ws.on("message", (data) => {
			let message: ClientMessage;
			try {
				message = JSON.parse(data.toString()) as ClientMessage;
			} catch {
				return;
			}

			const res = pending.get(message.requestId);
			if (!res) return;
			pending.delete(message.requestId);

			if (message.type === "response") {
				res.writeHead(message.status, sanitizeHeaders(message.headers));
				res.end(Buffer.from(message.body, "base64"));
			} else {
				res.statusCode = 502;
				res.end(`Tunnel client error: ${message.message}\n`);
			}
		});

		ws.on("close", () => {
			clients.delete(id);
			console.log(`tunnel client disconnected: ${id}`);
		});
	});

	server.listen(options.port, () => {
		console.log(
			`local-lane tunnel server on http://${options.host}:${options.port} ` +
				`(clients connect at ws://<host>:${options.port}${TUNNEL_WS_PATH})`,
		);
	});

	return server;
}
