// src/cli/daemon.ts
import { Command } from "commander";
import { DAEMON_LOG_PATH } from "../config/path";
import { getDaemonPid, startDaemon, stopDaemon } from "../daemon/daemon";
import { sendCommand } from "../daemon/ipc";

const daemon = new Command("daemon").description(
	"Run the proxy in the background",
);

daemon
	.command("start")
	.description("Start the proxy daemon")
	.option("--https", "Also start the HTTPS proxy on 10443")
	.option("--redirect", "Redirect HTTP to HTTPS (implies --https)")
	.action(async (options: any) => {
		const { pid, alreadyRunning } = await startDaemon({
			https: options.https,
			redirect: options.redirect,
		});

		if (alreadyRunning) {
			console.log(`Daemon already running (pid ${pid})`);
			return;
		}

		console.log(`✓ Daemon started (pid ${pid})`);
		console.log(`  logs: ${DAEMON_LOG_PATH}`);
	});

daemon
	.command("stop")
	.description("Stop the proxy daemon")
	.action(async () => {
		const pid = await stopDaemon();
		if (!pid) {
			console.log("Daemon is not running");
			return;
		}
		console.log(`✓ Daemon stopped (pid ${pid})`);
	});

daemon
	.command("status")
	.description("Show whether the daemon is running")
	.action(async () => {
		const pid = await getDaemonPid();
		if (!pid) {
			console.log("Daemon is not running");
			process.exitCode = 1;
			return;
		}
		console.log(`Daemon is running (pid ${pid})`);

		// Enrich with live info from the IPC control channel, if available.
		try {
			const res = await sendCommand({ cmd: "status" });
			if (res.ok) {
				const seconds = Math.floor(Number(res.uptimeMs ?? 0) / 1000);
				const domains = (res.domains as string[]) ?? [];
				console.log(`  uptime: ${seconds}s`);
				console.log(
					`  domains: ${domains.length ? domains.join(", ") : "(none)"}`,
				);
			}
		} catch {
			console.log("  (IPC control channel not responding)");
		}
	});

daemon
	.command("reload")
	.description("Ask the daemon to reload (clears the TLS cert cache)")
	.action(async () => {
		try {
			const res = await sendCommand({ cmd: "reload" });
			console.log(res.ok ? "✓ Daemon reloaded" : `Reload failed: ${res.error}`);
		} catch {
			console.log("Daemon is not running or not responding");
			process.exitCode = 1;
		}
	});

daemon
	.command("ping")
	.description("Check the daemon's IPC control channel")
	.action(async () => {
		try {
			const res = await sendCommand({ cmd: "ping" });
			console.log(res.pong ? "pong" : JSON.stringify(res));
		} catch {
			console.log("Daemon is not running or not responding");
			process.exitCode = 1;
		}
	});

export const daemonCommand = daemon;
