// src/daemon/ipc.ts
// Unix-socket control channel for the running proxy/daemon.
//
// Messages are newline-delimited JSON. The proxy process runs the server (see
// the `proxy --ipc` flag); the CLI uses the client helpers to ping the daemon,
// query live status, ask it to reload, or shut it down gracefully.
import net from "node:net";
import fs from "fs-extra";
import { SOCKET_PATH } from "../config/path";

export type IpcRequest = { cmd: string; [key: string]: unknown };
export type IpcResponse = { ok: boolean; [key: string]: unknown };
export type IpcHandler = (
	req: IpcRequest,
) => Promise<IpcResponse> | IpcResponse;

/**
 * Starts the IPC control server on the Unix socket. Any stale socket file is
 * removed first, and the socket is cleaned up on process exit.
 */
export async function startIpcServer(handler: IpcHandler): Promise<net.Server> {
	await fs.remove(SOCKET_PATH).catch(() => {});

	const server = net.createServer((sock) => {
		let buf = "";
		sock.on("data", async (chunk) => {
			buf += chunk.toString();
			let idx: number;
			while ((idx = buf.indexOf("\n")) >= 0) {
				const line = buf.slice(0, idx);
				buf = buf.slice(idx + 1);
				if (!line.trim()) continue;

				let res: IpcResponse;
				try {
					res = await handler(JSON.parse(line) as IpcRequest);
				} catch (err) {
					res = { ok: false, error: String(err) };
				}
				sock.write(JSON.stringify(res) + "\n");
			}
		});
		sock.on("error", () => sock.destroy());
	});

	const cleanup = () => {
		try {
			fs.removeSync(SOCKET_PATH);
		} catch {
			// best effort
		}
	};
	process.on("exit", cleanup);
	process.on("SIGINT", () => process.exit(0));
	process.on("SIGTERM", () => process.exit(0));

	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(SOCKET_PATH, () => resolve(server));
	});
}

/** Sends a single command to the daemon and resolves with its response. */
export function sendCommand(
	req: IpcRequest,
	timeoutMs = 2000,
): Promise<IpcResponse> {
	return new Promise((resolve, reject) => {
		const sock = net.createConnection(SOCKET_PATH);
		let buf = "";

		const timer = setTimeout(() => {
			sock.destroy();
			reject(new Error("IPC request timed out"));
		}, timeoutMs);

		sock.on("connect", () => sock.write(JSON.stringify(req) + "\n"));
		sock.on("data", (chunk) => {
			buf += chunk.toString();
			const idx = buf.indexOf("\n");
			if (idx < 0) return;
			clearTimeout(timer);
			try {
				resolve(JSON.parse(buf.slice(0, idx)) as IpcResponse);
			} catch (err) {
				reject(err);
			}
			sock.end();
		});
		sock.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

/** Returns true if a daemon is listening and answers a ping. */
export async function isDaemonResponsive(): Promise<boolean> {
	try {
		const res = await sendCommand({ cmd: "ping" });
		return res.ok === true;
	} catch {
		return false;
	}
}
