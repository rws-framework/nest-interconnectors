import { Injectable, OnModuleInit } from '@nestjs/common';
import { RWSConfigService } from '@rws-framework/server';
import { BlackLogger } from '@rws-framework/server/nest';
import { io, Socket } from 'socket.io-client';


export interface ITransientWsConnection {
    send<P = any>(pointName: string, method: string, payload: P): void;
    close(): void;
}

@Injectable()
export class WebSocketClientService {
    private logger = new BlackLogger(this.constructor.name);

    private client: Socket;

    constructor(
      private configService: RWSConfigService<any>
    ) {}        

    private buildSocket(apiKey?: string, configKey: string = 'ws_port'): Socket {
        return io(`ws://localhost:${this.configService.get(configKey)}`, {
            auth: apiKey ? { apiKey } : {},
            transports: ['websocket']
        });
    }

    private init(apiKey?: string, configKey: string = 'ws_port'){
        this.client = this.buildSocket(apiKey, configKey);
    }

    isAuthEnabled(): boolean {
        const features = (this.configService.get('features') as { auth?: boolean } | undefined);
        return features?.auth === true;
    }

    waitForConnection(): Promise<void> {
        if (!this.isAuthEnabled() || this.client.connected) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('WS connection timeout after 10s')), 10000);
            this.client.once('connect', () => {
                clearTimeout(timeout);
                resolve();
            });
            this.client.once('connect_error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    sendGatewayMessage<P = any>(pointName: string, method: string, payload: P) {
        this.client.emit(pointName, { method, msg: payload });
    }

    onGatewayMessage<P = any>(pointName: string, method: string, handler: (payload: P) => void): void {

        this.client.on(pointName, (response: string) => {
            const parsedResponse: { eventName: string, method: string, success: boolean, data: P } = JSON.parse(response);
            if(parsedResponse.method === method){                
                handler(parsedResponse.data);
            }            
        });
    }

    onAnyMessage(handler: (event: string, args: any[]) => void){
        this.client.onAny((event, ...args) => {
            handler(event, args);
        });
    }
}