// src/cli/daemon.ts
import { Command } from "commander";
import { DAEMON_LOG_PATH } from "../config/path";
import { getDaemonPid, startDaemon, stopDaemon } from "../daemon/daemon";

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
	});

export const daemonCommand = daemon;
