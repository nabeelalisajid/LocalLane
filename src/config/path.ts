import os from "os";
import path from "path";

export const BASE_DIR = path.join(os.homedir(), ".locallane");
export const CONFIG_PATH = path.join(BASE_DIR, "config.yaml");
export const LOG_PATH = path.join(BASE_DIR, "access.log");
export const PID_PATH = path.join(BASE_DIR, "mini-slim.pid");
export const SOCKET_PATH = path.join(BASE_DIR, "mini-slim.sock");

export const PROXY_HTTP_PATH = 10080;
export const PROXY_HTTPS_PORT = 10443;
