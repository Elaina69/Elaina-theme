export const BRIDGE_VERSION = 1;
export const REQUEST_TIMEOUT_MS = 15_000;
export const WAIT_ELEMENT_MAX_MS = 13_000;
export const MAX_BRIDGE_MESSAGE_BYTES = 20 * 1024 * 1024;

export interface BridgeRequest {
    requestId: string;
    type: string;
    data?: unknown;
}
export interface BridgeResponse {
    requestId: string;
    type?: string;
    data?: unknown;
    success?: boolean;
    error?: string;
}

export interface Payload {
    encoding: 'text' | 'base64' | 'omitted';
    text?: string;
    bytes?: number;
    truncated: boolean;
    reason?: string;
}

export interface ConsoleEntry {
    id: number;
    timestamp: string;
    level: string;
    message: string;
    truncated: boolean;
}

export interface NetworkEntry {
    id: number;
    timestamp: string;
    kind: 'fetch' | 'xhr' | 'websocket' | 'lcu' | 'resource';
    url: string;
    method?: string;
    event?: string;
    status?: number;
    durationMs?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: Payload;
    responseBody?: Payload;
    error?: string;
    transferBytes?: number;
}

export interface LogQuery {
    cursor?: number;
    limit?: number;
    search?: string;
    level?: string;
    kind?: NetworkEntry['kind'];
    method?: string;
    status?: number;
}
