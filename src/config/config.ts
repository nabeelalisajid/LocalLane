import fs from "fs-extra";
import YAML from "yaml";

import { BASE_DIR, CONFIG_PATH } from "./path";

export type Route = {
	path: string;
	port: number;
};

export type Domain = {
	name: string;
	port: number;
	routes: Route[];
};

export type MiniLocalLaneConfig = {
	domains: Domain[];
	cors?: boolean;
	logMode?: "full" | "minimal" | "off";
};

export async function loadConfig(): Promise<MiniLocalLaneConfig> {
	if (!(await fs.pathExists(CONFIG_PATH))) {
		return { domains: [] };
	}
	const raw = await fs.readFileSync(CONFIG_PATH, "utf-8");
	return YAML.parse(raw) ?? { domains: [] };
}

export async function saveConfig(config: MiniLocalLaneConfig) {
	await fs.ensureDirSync(BASE_DIR);
	await fs.writeFile(CONFIG_PATH, YAML.stringify(config));
}

export function normalizeDomain(name: string) {
	const cleaned = name.trim().toLowerCase().replace(/\.$/, "");
	return cleaned.includes(".") ? cleaned : `${cleaned}.test`;
}

export async function setDomain(
	name: string,
	port: number,
	routes: Route[] = [],
) {
	const config = await loadConfig();
	const domain = normalizeDomain(name);

	const existing = config.domains.find((d) => d.name === domain);
	if (existing) {
		existing.port = port;
		existing.routes = routes;
	} else {
		config.domains.push({ name: domain, port, routes });
	}

	await saveConfig(config);
	return domain;
}
export async function removeDomain(name: string) {
	const config = await loadConfig();
	const domain = normalizeDomain(name);

	config.domains = config.domains.filter((d) => d.name !== domain);

	await saveConfig(config);
}
