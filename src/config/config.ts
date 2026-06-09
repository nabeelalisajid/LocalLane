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

export type LocalLaneConfig = {
	domains: Domain[];
	cors?: boolean;
	logMode?: "full" | "minimal" | "off";
};

export async function loadConfig(): Promise<LocalLaneConfig> {
	if (!(await fs.pathExists(CONFIG_PATH))) {
		return { domains: [] };
	}

	const raw = await fs.readFile(CONFIG_PATH, "utf8");
	return YAML.parse(raw) ?? { domains: [] };
}

export async function saveConfig(config: LocalLaneConfig): Promise<void> {
	await fs.ensureDir(BASE_DIR);
	await fs.writeFile(CONFIG_PATH, YAML.stringify(config), "utf8");
}

export function normalizeDomain(name: string): string {
	const cleaned = name.trim().toLowerCase().replace(/\.$/, "");
	return cleaned.includes(".") ? cleaned : `${cleaned}.test`;
}

export async function setDomain(
	name: string,
	port: number,
	routes: Route[] = [],
): Promise<string> {
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

export async function removeDomain(name: string): Promise<void> {
	const config = await loadConfig();
	const domain = normalizeDomain(name);

	config.domains = config.domains.filter((d) => d.name !== domain);

	await saveConfig(config);
}
