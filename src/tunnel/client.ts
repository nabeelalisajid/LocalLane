// src/tunnel/client.ts
// Local tunnel client. Connects to a public tunnel server over a WebSocket,
// receives forwarded HTTP requests, replays them against the local app, and
// sends the responses back.
import * as http from "node:http";
import { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./protocol";

export type ShareOptions = {
	port: number;
	serverUrl: string;
};

export function startShare(options: ShareOptions): WebSocket {
	const ws = new WebSocket(options.serverUrl);

	ws.on("open", () => {
		console.log(`connected to ${options.serverUrl}, waiting for public URL...`);
	});

	ws.on("message", (data) => {
		let message: ServerMessage;
		try {
			message = JSON.parse(data.toString()) as ServerMessage;
		} catch {
			return;
		}

		if (message.type === "ready") {
			console.log(
				`✓ public URL: ${message.url}  ->  localhost:${options.port}`,
			);
		} else if (message.type === "request") {
			forwardToLocal(ws, options.port, message);
		}
	});

	ws.on("close", () => {
		console.log("tunnel closed");
		process.exitCode = 1;
	});
	ws.on("error", (err) => {
		console.error(`tunnel error: ${err.message}`);
	});

	return ws;
}

function forwardToLocal(
	ws: WebSocket,
	port: number,
	message: Extract<ServerMessage, { type: "request" }>,
): void {
	const body = Buffer.from(message.body, "base64");

	// Point the Host header at the local app rather than the public subdomain.
	const headers = { ...message.headers, host: `127.0.0.1:${port}` };

	const req = http.request(
		{ host: "127.0.0.1", port, method: message.method, path: message.url, headers },
		(res) => {
			const chunks: Buffer[] = [];
			res.on("data", (c) => chunks.push(c as Buffer));
			res.on("end", () => {
				const reply: ClientMessage = {
					type: "response",
					requestId: message.requestId,
					status: res.statusCode ?? 502,
					headers: res.headers,
					body: Buffer.concat(chunks).toString("base64"),
				};
				ws.send(JSON.stringify(reply));
			});
		},
	);

	req.on("error", (err) => {
		const reply: ClientMessage = {
			type: "error",
			requestId: message.requestId,
			message: String(err),
		};
		ws.send(JSON.stringify(reply));
	});

	if (body.length) req.write(body);
	req.end();
}
