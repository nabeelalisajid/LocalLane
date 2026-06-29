// src/cli/doctor.ts
import { Command } from "commander";
import { runDiagnostics, type CheckStatus } from "../doctor/doctor";

const ICONS: Record<CheckStatus, string> = {
	ok: "✓",
	warn: "!",
	fail: "✗",
};

export const doctorCommand = new Command("doctor")
	.description("Diagnose the local LocalLane setup")
	.action(async () => {
		const checks = await runDiagnostics();

		for (const check of checks) {
			console.log(`${ICONS[check.status]} ${check.name}: ${check.detail}`);
		}

		const failed = checks.some((c) => c.status === "fail");
		if (failed) {
			process.exitCode = 1;
		}
	});
