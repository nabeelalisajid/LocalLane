import * as os from "node:os";
import * as path from "node:path";

export const BASE_DIR = path.join(os.homedir(), ".locallane");
export const CONFIG_PATH = path.join(BASE_DIR, "config.yaml");
export const LOG_PATH = path.join(BASE_DIR, "access.log");
export const PID_PATH = path.join(BASE_DIR, "locallane.pid");
export const SOCKET_PATH = path.join(BASE_DIR, "locallane.sock");

export const PROXY_HTTP_PORT = 10080;
export const PROXY_HTTPS_PORT = 10443;
