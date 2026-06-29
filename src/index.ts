// src/index.ts
// #!/usr/bin/env node
import { Command } from "commander";
import { startCommand } from "./cli/start";
import { listCommand } from "./cli/list";
import { stopCommand } from "./cli/stop";
import { proxyCommand } from "./cli/proxy";
import { doctorCommand } from "./cli/doctor";
import { caCommand } from "./cli/root";

const program = new Command();

program
	.name("local-lane")
	.description("Local HTTPS dev domain proxy")
	.version("0.0.1");

program.addCommand(startCommand);
program.addCommand(listCommand);
program.addCommand(stopCommand);
program.addCommand(proxyCommand);
program.addCommand(doctorCommand);
program.addCommand(caCommand);

program.parse();
