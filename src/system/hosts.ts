// src/system/hosts.ts
import fs from "fs-extra";
import { execa } from "execa";

const HOSTS_PATH = "/etc/hosts";
const MARKER = "# local-lane";

export async function addHost(domain: string) {
	const content = await fs.readFile(HOSTS_PATH, "utf8");

	if (content.includes(`${domain} ${MARKER}`)) {
		return;
	}

	const entry = `127.0.0.1 ${domain} ${MARKER}`;
	const updated = content.trimEnd() + "\n" + entry + "\n";

	await writeElevated(HOSTS_PATH, updated);
}

export async function removeHost(domain: string) {
	const content = await fs.readFile(HOSTS_PATH, "utf8");

	const lines = content.split("\n").filter((line) => {
		return !(line.includes(domain) && line.includes(MARKER));
	});

	await writeElevated(HOSTS_PATH, lines.join("\n"));
}

async function writeElevated(path: string, content: string) {
	try {
		await fs.writeFile(path, content);
	} catch (err: any) {
		if (err.code !== "EACCES") throw err;

		await execa("sudo", ["tee", path], {
			input: content,
			stdout: "ignore",
		});
	}
}
