// src/cli/root.ts
// `ca` command: manage the local root CA used to sign per-domain certificates.
import os from "node:os";
import { Command } from "commander";
import { ensureCa } from "../cert/ca";
import { CA_CERT_PATH } from "../config/path";

function trustInstructions(): string {
	const platform = os.platform();
	if (platform === "darwin") {
		return [
			"macOS — trust the root CA:",
			`  sudo security add-trusted-cert -d -r trustRoot \\`,
			`    -k /Library/Keychains/System.keychain ${CA_CERT_PATH}`,
		].join("\n");
	}
	if (platform === "linux") {
		return [
			"Linux (Debian/Ubuntu) — trust the root CA:",
			`  sudo cp ${CA_CERT_PATH} /usr/local/share/ca-certificates/locallane.crt`,
			"  sudo update-ca-certificates",
			"",
			"Firefox/Chrome keep their own stores; import the CA there too if needed.",
		].join("\n");
	}
	return `Import ${CA_CERT_PATH} into your system/browser trust store.`;
}

export const caCommand = new Command("ca")
	.description("Generate and show the local root CA used for HTTPS")
	.action(async () => {
		await ensureCa();
		console.log(`✓ Root CA ready at: ${CA_CERT_PATH}`);
		console.log("");
		console.log(trustInstructions());
	});
