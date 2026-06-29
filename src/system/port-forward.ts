// src/system/port-forward.ts
// Simple TCP port forwarder. Used to expose the proxy on the privileged ports
// 80/443 by forwarding them to the unprivileged 10080/10443 the proxy binds to.
//
// This is a raw byte pipe (it does not parse HTTP), so it works for both the
// HTTP and HTTPS proxies — TLS is terminated by the HTTPS proxy downstream.
import net from "node:net";

export type Forward = {
	from: number;
	to: number;
	server: net.Server;
};

/**
 * Starts forwarding TCP connections from `fromPort` to `toHost:toPort`.
 * Resolves once the listener is bound, or rejects on bind errors (e.g. EACCES
 * when binding a privileged port without root).
 */
export function startForward(
	fromPort: number,
	toPort: number,
	toHost = "127.0.0.1",
): Promise<Forward> {
	const server = net.createServer((client) => {
		const upstream = net.createConnection({ host: toHost, port: toPort });

		client.pipe(upstream);
		upstream.pipe(client);

		const teardown = () => {
			client.destroy();
			upstream.destroy();
		};
		client.on("error", teardown);
		upstream.on("error", teardown);
		client.on("close", () => upstream.destroy());
		upstream.on("close", () => client.destroy());
	});

	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(fromPort, () => {
			resolve({ from: fromPort, to: toPort, server });
		});
	});
}
