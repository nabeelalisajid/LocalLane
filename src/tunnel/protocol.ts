// src/tunnel/protocol.ts
// Shared message protocol between the public tunnel server and the local tunnel
// client. Messages are JSON over a single WebSocket connection. Request and
// response bodies are base64-encoded so binary payloads survive the JSON hop.

export type HeaderMap = Record<string, string | string[] | undefined>;

/** Messages sent from the server (public side) to the client (local side). */
export type ServerMessage =
	| { type: "ready"; id: string; url: string }
	| {
			type: "request";
			requestId: string;
			method: string;
			url: string;
			headers: HeaderMap;
			body: string; // base64
	  };

/** Messages sent from the client (local side) back to the server. */
export type ClientMessage =
	| {
			type: "response";
			requestId: string;
			status: number;
			headers: HeaderMap;
			body: string; // base64
	  }
	| { type: "error"; requestId: string; message: string };

/** Path on the tunnel server where clients establish the WebSocket. */
export const TUNNEL_WS_PATH = "/__tunnel";
