import net from "node:net";

export function checkPort(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.createConnection({
			host: "localhost",
			port,
		});

		socket.setTimeout(1000);

		socket.on("connect", () => {
			socket.destroy();
			resolve(true);
		});

		socket.on("timeout", () => {
			socket.destroy();
			resolve(false);
		});

		socket.on("error", () => {
			socket.destroy();
			resolve(false);
		});
	});
}
