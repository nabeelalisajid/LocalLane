// src/cert/leaf.ts
// Per-domain leaf certificates signed by the local root CA (see ca.ts).
// Leaves are cached under ~/.locallane/certs/<domain>.{crt,key} and loaded by
// the HTTPS proxy via SNI so each local domain presents a valid certificate.
import fs from "fs-extra";
import path from "node:path";
import forge from "node-forge";
import { ensureCa } from "./ca";
import { makeSerial } from "./ca";
import { CERTS_DIR } from "../config/path";

export type LeafCert = {
	certPem: string;
	keyPem: string;
};

const LEAF_VALIDITY_DAYS = 825; // common max accepted by browsers

/**
 * Returns a leaf certificate for `domain`, generating and caching it on first
 * use. The returned PEMs are suitable for tls.createSecureContext.
 */
export async function ensureLeafCert(domain: string): Promise<LeafCert> {
	const certPath = path.join(CERTS_DIR, `${domain}.crt`);
	const keyPath = path.join(CERTS_DIR, `${domain}.key`);

	if ((await fs.pathExists(certPath)) && (await fs.pathExists(keyPath))) {
		return {
			certPem: await fs.readFile(certPath, "utf8"),
			keyPem: await fs.readFile(keyPath, "utf8"),
		};
	}

	const leaf = await createLeafCert(domain);

	await fs.ensureDir(CERTS_DIR);
	await fs.writeFile(certPath, leaf.certPem);
	await fs.writeFile(keyPath, leaf.keyPem, { mode: 0o600 });

	return leaf;
}

/** Generates a leaf certificate for `domain` signed by the root CA. */
async function createLeafCert(domain: string): Promise<LeafCert> {
	const ca = await ensureCa();

	const keys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();

	cert.publicKey = keys.publicKey;
	cert.serialNumber = makeSerial();
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setDate(
		cert.validity.notBefore.getDate() + LEAF_VALIDITY_DAYS,
	);

	cert.setSubject([{ name: "commonName", value: domain }]);
	cert.setIssuer(ca.cert.subject.attributes);
	cert.setExtensions([
		{ name: "basicConstraints", cA: false },
		{
			name: "keyUsage",
			digitalSignature: true,
			keyEncipherment: true,
		},
		{ name: "extKeyUsage", serverAuth: true },
		{
			name: "subjectAltName",
			altNames: [{ type: 2, value: domain }], // type 2 = DNS name
		},
	]);

	cert.sign(ca.key, forge.md.sha256.create());

	return {
		certPem: forge.pki.certificateToPem(cert),
		keyPem: forge.pki.privateKeyToPem(keys.privateKey),
	};
}
