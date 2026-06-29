import * as os from "node:os";
import * as path from "node:path";

export const BASE_DIR = path.join(os.homedir(), ".locallane");
export const CONFIG_PATH = path.join(BASE_DIR, "config.yaml");
export const LOG_PATH = path.join(BASE_DIR, "access.log");
export const PID_PATH = path.join(BASE_DIR, "locallane.pid");
export const SOCKET_PATH = path.join(BASE_DIR, "locallane.sock");

// Local root CA (key + self-signed cert) used to sign per-domain leaf certs.
export const CA_DIR = path.join(BASE_DIR, "ca");
export const CA_CERT_PATH = path.join(CA_DIR, "rootCA.crt");
export const CA_KEY_PATH = path.join(CA_DIR, "rootCA.key");

// Per-domain leaf certificates, cached as <domain>.crt / <domain>.key.
export const CERTS_DIR = path.join(BASE_DIR, "certs");

export const PROXY_HTTP_PORT = 10080;
export const PROXY_HTTPS_PORT = 10443;
