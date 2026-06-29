// src/daemon/daemon.ts
// Background daemon management. The daemon is simply the existing `proxy`
// command spawned as a detached child process, with its PID tracked in
// ~/.locallane/locallane.pid so it can be stopped later. Output is appended to
// ~/.locallane/daemon.log.
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";
import { BASE_DIR, DAEMON_LOG_PATH, PID_PATH } from "../config/path";

export type DaemonOptions = {
	https?: boolean;
	redirect?: boolean;
};

/** Resolves the path to the compiled CLI entry point (dist/index.js). */
function entryPoint(): string {
	// Compiled location is dist/daemon/daemon.js, so the entry is ../index.js.
	return path.join(__dirname, "..", "index.js");
}

/** Returns the running daemon PID if one is alive, otherwise null. */
export async function getDaemonPid(): Promise<number | null> {
	if (!(await fs.pathExists(PID_PATH))) return null;

	const raw = (await fs.readFile(PID_PATH, "utf8")).trim();
	const pid = Number(raw);
	if (!Number.isInteger(pid) || pid <= 0) return null;

	if (isAlive(pid)) return pid;

	// Stale pid file — clean it up.
	await fs.remove(PID_PATH).catch(() => {});
	return null;
}

/** Returns true if a process with the given pid exists. */
function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err: any) {
		// EPERM means the process exists but we can't signal it.
		return err.code === "EPERM";
	}
}

/**
 * Starts the proxy as a detached background process. Returns the new pid, or
 * the existing pid if the daemon is already running.
 */
export async function startDaemon(
	options: DaemonOptions = {},
): Promise<{ pid: number; alreadyRunning: boolean }> {
	const existing = await getDaemonPid();
	if (existing) return { pid: existing, alreadyRunning: true };

	await fs.ensureDir(BASE_DIR);
	const logFd = await fs.open(DAEMON_LOG_PATH, "a");

	const args = [entryPoint(), "proxy"];
	if (options.redirect) args.push("--redirect");
	else if (options.https) args.push("--https");

	const child = spawn(process.execPath, args, {
		detached: true,
		stdio: ["ignore", logFd, logFd],
	});

	child.unref();
	await fs.close(logFd);

	if (!child.pid) {
		throw new Error("Failed to start daemon: no pid assigned");
	}

	await fs.writeFile(PID_PATH, String(child.pid));
	return { pid: child.pid, alreadyRunning: false };
}

/**
 * Stops the running daemon. Returns the stopped pid, or null if none was
 * running.
 */
export async function stopDaemon(): Promise<number | null> {
	const pid = await getDaemonPid();
	if (!pid) return null;

	try {
		process.kill(pid);
	} catch (err: any) {
		if (err.code !== "ESRCH") throw err;
	}

	await fs.remove(PID_PATH).catch(() => {});
	return pid;
}
