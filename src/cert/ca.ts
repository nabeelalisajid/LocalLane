// src/cert/ca.ts
// Local development root Certificate Authority.
//
// LocalLane signs a short-lived leaf certificate for each domain (see leaf.ts).
// Those leaves are only trusted once this root CA is added to the system /
// browser trust store. We generate the CA once and cache it under
// ~/.locallane/ca so the same root can be trusted permanently.
import fs from "fs-extra";
import forge from "node-forge";
import { CA_CERT_PATH, CA_DIR, CA_KEY_PATH } from "../config/path";

export type Ca = {
	certPem: string;
	keyPem: string;
	cert: forge.pki.Certificate;
	key: forge.pki.rsa.PrivateKey;
};

const CA_COMMON_NAME = "LocalLane Local CA";
const CA_VALIDITY_YEARS = 10;

/**
 * Loads the root CA from disk, generating and persisting it on first use.
 */
export async function ensureCa(): Promise<Ca> {
	if ((await fs.pathExists(CA_CERT_PATH)) && (await fs.pathExists(CA_KEY_PATH))) {
		const certPem = await fs.readFile(CA_CERT_PATH, "utf8");
		const keyPem = await fs.readFile(CA_KEY_PATH, "utf8");
		return {
			certPem,
			keyPem,
			cert: forge.pki.certificateFromPem(certPem),
			key: forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey,
		};
	}

	return createCa();
}

/** Generates a fresh root CA and writes it to ~/.locallane/ca. */
async function createCa(): Promise<Ca> {
	const keys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();

	cert.publicKey = keys.publicKey;
	cert.serialNumber = makeSerial();
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setFullYear(
		cert.validity.notBefore.getFullYear() + CA_VALIDITY_YEARS,
	);

	const attrs = [{ name: "commonName", value: CA_COMMON_NAME }];
	cert.setSubject(attrs);
	cert.setIssuer(attrs); // self-signed
	cert.setExtensions([
		{ name: "basicConstraints", cA: true, critical: true },
		{ name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
		{ name: "subjectKeyIdentifier" },
	]);

	cert.sign(keys.privateKey, forge.md.sha256.create());

	const certPem = forge.pki.certificateToPem(cert);
	const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

	await fs.ensureDir(CA_DIR);
	await fs.writeFile(CA_CERT_PATH, certPem);
	await fs.writeFile(CA_KEY_PATH, keyPem, { mode: 0o600 });

	return { certPem, keyPem, cert, key: keys.privateKey };
}

/** Random positive hex serial number, as forge expects. */
export function makeSerial(): string {
	const bytes = forge.random.getBytesSync(16);
	// Ensure the high bit is clear so the serial is treated as positive.
	return "00" + forge.util.bytesToHex(bytes);
}
