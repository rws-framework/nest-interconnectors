import { OnModuleDestroy } from '@nestjs/common';
import { BlackLogger } from '@rws-framework/server/nest';
import { Socket } from '@rws-framework/server';

export interface ISocketEntry<TKey extends string = string> {
    socketId: string;
    socket: Socket;
    key: TKey;
    registeredAt: Date;
    lastSeen: Date;
    pendingPing?: ReturnType<typeof setTimeout>;
}

const DEFAULT_PING_INTERVAL_MS = 15000;
const DEFAULT_PING_TIMEOUT_MS = 8000;

/**
 * Abstract base class for keyed socket stores.
 * Concrete stores extend this and supply a `storeName` for logging.
 * The generic `TKey` is the domain key type (e.g. sessionId, scenarioId).
 */
export abstract class SocketStore<TKey extends string = string> implements OnModuleDestroy {
    protected abstract readonly storeName: string;
    /** Override in subclasses to change how often pings are sent. */
    protected readonly pingIntervalMs: number = DEFAULT_PING_INTERVAL_MS;
    /** Override in subclasses to change how long to wait for a pong before evicting. */
    protected readonly pingTimeoutMs: number = DEFAULT_PING_TIMEOUT_MS;
    protected readonly logger = new BlackLogger(this.constructor.name);
    protected sockets: Map<string, ISocketEntry<TKey>> = new Map();
    private pingInterval: ReturnType<typeof setInterval> | null = null;

    onModuleDestroy(): void {
        this.stopPingLoop();
        this.sockets.clear();
    }

    register(socket: Socket, key: TKey): void {
        const existing = this.sockets.get(socket.id);
        if (existing) {
            existing.key = key;
            existing.lastSeen = new Date();
            return;
        }

        this.sockets.set(socket.id, {
            socketId: socket.id,
            socket,
            key,
            registeredAt: new Date(),
            lastSeen: new Date(),
        });

        this.logger.log(`[${this.storeName}] registered: ${socket.id} (key: ${key}). Total: ${this.sockets.size}`);

        if (this.sockets.size === 1) {
            this.startPingLoop();
        }
    }

    unregister(socketId: string): void {
        const entry = this.sockets.get(socketId);
        if (entry?.pendingPing) {
            clearTimeout(entry.pendingPing);
        }
        this.sockets.delete(socketId);
        this.logger.log(`[${this.storeName}] unregistered: ${socketId}. Remaining: ${this.sockets.size}`);

        if (this.sockets.size === 0) {
            this.stopPingLoop();
        }
    }

    markSeen(socketId: string): void {
        const entry = this.sockets.get(socketId);
        if (!entry) return;
        entry.lastSeen = new Date();
        if (entry.pendingPing) {
            clearTimeout(entry.pendingPing);
            entry.pendingPing = undefined;
        }
    }

    getByKey(key: TKey): ISocketEntry<TKey>[] {
        return [...this.sockets.values()].filter(s => s.key === key);
    }

    getAll(): ISocketEntry<TKey>[] {
        return [...this.sockets.values()];
    }

    emitToKey(key: TKey, event: string, data: unknown): void {
        for (const entry of this.getByKey(key)) {
            try {
                entry.socket.emit(event, data);
            } catch {
                // stale socket — will be cleaned up on next ping cycle
            }
        }
    }

    emitToAll(event: string, data: unknown): void {
        for (const entry of this.sockets.values()) {
            try {
                entry.socket.emit(event, data);
            } catch {
                // ignore stale sockets
            }
        }
    }

    private startPingLoop(): void {
        if (this.pingInterval) return;
        this.pingInterval = setInterval(() => this.pingAll(), this.pingIntervalMs);
        this.logger.log(`[${this.storeName}] Ping loop started`);
    }

    private stopPingLoop(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            this.logger.log(`[${this.storeName}] Ping loop stopped`);
        }
    }

    private pingAll(): void {
        for (const [socketId, entry] of this.sockets.entries()) {
            if (entry.pendingPing) continue;
            try {
                entry.socket.emit('session_ping', { ts: Date.now() });
                entry.pendingPing = setTimeout(() => {
                    this.logger.warn(`[${this.storeName}] Socket ${socketId} did not respond to ping — removing`);
                    this.unregister(socketId);
                }, this.pingTimeoutMs);
            } catch {
                this.logger.warn(`[${this.storeName}] Could not ping ${socketId} — removing`);
                this.unregister(socketId);
            }
        }
    }
}
