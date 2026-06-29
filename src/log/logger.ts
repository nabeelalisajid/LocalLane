// src/log/logger.ts
// Minimal access logger for the proxy. Writes one line per request to both the
// console and ~/.locallane/access.log. Honors the optional config.logMode:
//   "full"    -> log every request (default)
//   "minimal" -> log only non-2xx responses
//   "off"     -> disable logging
import fs from "fs-extra";
import { BASE_DIR, LOG_PATH } from "../config/path";

export type LogMode = "full" | "minimal" | "off";

export type AccessLogEntry = {
	host?: string;
	method?: string;
	url?: string;
	upstreamPort: number;
	status: number;
};

/**
 * Records a single proxied request. File writes are best-effort: a logging
 * failure must never take the proxy down, so errors are swallowed.
 */
export async function logAccess(
	entry: AccessLogEntry,
	mode: LogMode = "full",
): Promise<void> {
	if (mode === "off") return;
	if (mode === "minimal" && entry.status >= 200 && entry.status < 300) return;

	const line = formatEntry(entry);
	console.log(line);

	try {
		await fs.ensureDir(BASE_DIR);
		await fs.appendFile(LOG_PATH, line + "\n");
	} catch {
		// Logging is best-effort; never crash the proxy over a log write.
	}
}

function formatEntry(entry: AccessLogEntry): string {
	const time = new Date().toISOString();
	const host = entry.host ?? "-";
	const method = entry.method ?? "-";
	const url = entry.url ?? "-";
	return `${time} ${host} ${method} ${url} -> :${entry.upstreamPort} ${entry.status}`;
}
