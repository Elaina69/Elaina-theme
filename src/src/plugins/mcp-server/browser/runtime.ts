import { ElainaData } from '../../../utils/themeDataStore.ts';
import { readCaptureSettings, type ServerConfig } from '../shared/config.ts';
import { BRIDGE_VERSION, MAX_BRIDGE_MESSAGE_BYTES, type BridgeRequest } from '../shared/protocol.ts';
import { McpConfigStore } from './configStore.ts';
import { McpCapture } from './capture.ts';
import { McpCommands } from './commands.ts';
import { byteLength } from '../shared/buffer.ts';
import { redactText } from './payload.ts';

export type McpStatus = { state: 'disabled' | 'configuration' | 'connecting' | 'connected' | 'reconnecting' | 'error'; detail?: string; port?: number };

/** The renderer never starts a process; it only connects to the manually launched service. */
export class McpRuntime {
    readonly config: McpConfigStore;
    readonly capture: McpCapture;
    private commands: McpCommands;
    private socket?: WebSocket;
    private configValue?: ServerConfig;
    private listeners = new Set<(status: McpStatus) => void>();
    private status: McpStatus = { state: 'disabled' };
    private retry?: ReturnType<typeof setTimeout>;
    private handshake?: ReturnType<typeof setTimeout>;
    private attempts = 0;
    private epoch = 0;
    private started = false;
    private connecting = false;
    private unsubscribe?: () => void;
    private mutations: Promise<unknown> = Promise.resolve();

    constructor(context: { fs?: PluginFS }) {
        this.config = new McpConfigStore(context);
        this.capture = new McpCapture(() => this.enabled());
        this.commands = new McpCommands(this.capture, () => this.enabled(), () => this.configValue?.token ? [this.configValue.token] : []);
    }

    enabled = () => ElainaData.get('Dev-mode') === true && ElainaData.get('MCP-enabled', false) === true;

    init() {
        this.unsubscribe = ElainaData.subscribe(keys => {
            if (keys.some(key => key === 'Dev-mode' || key.startsWith('MCP-'))) this.refresh();
        });
        window.addEventListener('pagehide', this.dispose, { once: true });
        this.refresh();
    }

    subscribe(listener: (status: McpStatus) => void) {
        this.listeners.add(listener); listener(this.status);
        return () => this.listeners.delete(listener);
    }

    private update(status: McpStatus) {
        this.status = status;
        for (const listener of this.listeners) listener(status);
    }

    refresh() {
        if (!this.enabled()) { this.stop(); return; }
        const settings = readCaptureSettings((key, fallback) => ElainaData.get(key, fallback));
        if (!this.started) {
            this.started = true;
            this.commands.activate();
            this.capture.start(settings);
            void this.connect();
        } else this.capture.configure(settings);
    }

    reconnect = () => {
        if (!this.enabled()) return;
        this.disconnect();
        this.attempts = 0;
        void this.connect();
    };

    clear = () => this.capture.clear();

    private async connect() {
        if (!this.enabled() || this.socket || this.connecting) return;
        this.connecting = true;
        const epoch = this.epoch;
        this.update({ state: 'configuration' });
        try {
            const config = await this.config.read(this.config.writable);
            if (epoch !== this.epoch || !this.enabled()) return;
            this.configValue = config;
            this.capture.excludeServer(config.port, config.token);
            this.update({ state: 'connecting', port: config.port });
            const socket = new WebSocket(`ws://127.0.0.1:${config.port}/bridge`);
            this.socket = socket;
            let authenticated = false;
            this.handshake = setTimeout(() => socket.close(1000, 'Handshake timeout'), 5000);
            socket.onopen = () => {
                if (this.enabled() && epoch === this.epoch) socket.send(JSON.stringify({ type: 'HELLO', token: config.token, version: BRIDGE_VERSION }));
                else socket.close();
            };
            socket.onmessage = event => {
                if (epoch !== this.epoch || !this.enabled() || typeof event.data !== 'string' || byteLength(event.data) > MAX_BRIDGE_MESSAGE_BYTES) return;
                try {
                    const message = JSON.parse(event.data);
                    if (!authenticated) {
                        if (message.type !== 'HELLO_ACK' || message.version !== BRIDGE_VERSION) { socket.close(); return; }
                        authenticated = true; this.attempts = 0; clearTimeout(this.handshake);
                        this.update({ state: 'connected', port: config.port });
                        return;
                    }
                    if (typeof message.requestId !== 'string' || typeof message.type !== 'string') return;
                    const run = () => this.handle(socket, message, epoch);
                    if (['GET_DOM', 'QUERY_ELEMENT', 'WAIT_FOR_ELEMENT', 'GET_CLIENT_STATE', 'GET_PERFORMANCE_METRICS', 'GET_CONSOLE_LOGS', 'GET_NETWORK_LOGS', 'GET_NETWORK_ENTRY', 'GET_PLUGIN'].includes(message.type)) void run();
                    else { this.mutations = this.mutations.then(run, run); }
                } catch { socket.close(1007, 'Invalid bridge message'); }
            };
            socket.onclose = () => {
                if (this.socket !== socket) return;
                this.socket = undefined; clearTimeout(this.handshake);
                this.schedule();
            };
            socket.onerror = () => { this.update({ state: 'error', port: config.port, detail: 'MCP server is unavailable. Start it from the server folder.' }); };
        } catch (reason) {
            if (epoch !== this.epoch || !this.enabled()) return;
            this.update({ state: 'error', detail: reason instanceof Error ? reason.message : String(reason) });
            this.schedule();
        } finally { if (epoch === this.epoch) this.connecting = false; }
    }

    private async handle(socket: WebSocket, message: BridgeRequest, epoch: number) {
        try {
            if (epoch !== this.epoch || !this.enabled()) throw new Error('MCP is disabled or the connection changed.');
            const data = await this.commands.execute(message.type, message.data);
            if (epoch !== this.epoch || !this.enabled()) return;
            const result = JSON.stringify({ requestId: message.requestId, type: message.type, data, success: true });
            if (byteLength(result) > MAX_BRIDGE_MESSAGE_BYTES) throw new Error('Tool result exceeds the bridge size limit. Use a narrower query.');
            if (socket.readyState === WebSocket.OPEN) socket.send(result);
        } catch (reason) {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ requestId: message.requestId,
                error: redactText(reason instanceof Error ? reason.message : String(reason), this.configValue ? [this.configValue.token] : []), success: false }));
        }
    }

    private schedule() {
        if (!this.enabled() || this.retry) return;
        const delay = Math.min(1000 * 2 ** Math.min(this.attempts++, 5), 30000);
        if (this.status.state !== 'error') this.update({ state: 'reconnecting', port: this.configValue?.port });
        this.retry = setTimeout(() => { this.retry = undefined; void this.connect(); }, delay);
    }

    private disconnect() {
        this.epoch++;
        this.mutations = Promise.resolve();
        clearTimeout(this.retry); this.retry = undefined;
        clearTimeout(this.handshake); this.handshake = undefined;
        this.connecting = false;
        const socket = this.socket; this.socket = undefined;
        if (socket) { socket.onclose = null; socket.onerror = null; socket.onmessage = null; socket.onopen = null; socket.close(); }
    }

    private stop() {
        this.disconnect();
        if (this.started) { this.commands.stop(); this.capture.stop(); }
        this.started = false;
        this.configValue = undefined;
        this.update({ state: 'disabled' });
    }

    dispose = () => {
        this.stop(); this.unsubscribe?.(); this.listeners.clear();
        window.removeEventListener('pagehide', this.dispose);
    };
}

let instance: McpRuntime | undefined;
export function initMcp(context: { fs?: PluginFS }) { instance?.dispose(); instance = new McpRuntime(context); instance.init(); }
export function getMcpRuntime() { return instance; }
