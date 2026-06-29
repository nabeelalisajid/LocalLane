// src/config/validation.ts
// Shared validation helpers for ports and route mappings.
// Centralizing these keeps the CLI commands thin and the error messages
// consistent across `start`, `proxy`, and future commands.
import type { Route } from "./config";

/**
 * Returns true when `value` is an integer in the valid TCP port range (1-65535).
 */
export function isValidPort(value: number): boolean {
	return Number.isInteger(value) && value >= 1 && value <= 65535;
}

/**
 * Parses and validates a port, throwing a descriptive error when invalid.
 */
export function parsePort(value: string | number, label = "port"): number {
	const port = Number(value);
	if (!isValidPort(port)) {
		throw new Error(`Invalid ${label} "${value}". Expected an integer 1-65535.`);
	}
	return port;
}

/**
 * Parses a single `--route` mapping in the form `/path=port`.
 */
export function parseRoute(mapping: string): Route {
	const parts = mapping.split("=");

	if (parts.length !== 2) {
		throw new Error(`Invalid route "${mapping}". Expected format: /path=port`);
	}

	const [routePath, portValue] = parts;

	if (!routePath.startsWith("/")) {
		throw new Error(
			`Invalid route path "${routePath}". Route must start with /`,
		);
	}

	return {
		path: routePath,
		port: parsePort(portValue, "route port"),
	};
}

/**
 * Parses every `--route` mapping collected from the CLI.
 */
export function parseRoutes(routeMappings: string[]): Route[] {
	return routeMappings.map(parseRoute);
}
