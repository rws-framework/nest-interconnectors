import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { LoggingUtils } from '../helpers/LoggingUtils';
import { NetworkHelper } from '../helpers/NetworkHelper';
import { WsHelper, SocketClient } from '../helpers/WsHelper';

@Injectable()
export class WebsocketManagerService implements OnModuleInit {
  private readonly logger: Logger;
  private readonly clients = new Map<string, SocketClient>();

  constructor(private configService: ConfigService) {
    this.logger = LoggingUtils.createLogger(WebsocketManagerService.name);
  }

  async onModuleInit() {
    this.logger.log('WebsocketManagerService initialized.');
  }

  addClient(socket: Socket, metadata: Record<string, any> = {}, disconnectHandler: (client: SocketClient, clients: Map<string, SocketClient>, logger: Logger) => void | null = null) {
    const clientId: string = socket.id;
    const client = WsHelper.createClient(clientId, socket, metadata);
    this.clients.set(clientId, client);
    LoggingUtils.logClientConnection(this.logger, clientId);

    if(disconnectHandler !== null){
      disconnectHandler(client, this.clients, this.logger);
    }else{
      WsHelper.setupDisconnectHandler(
        client,
        (id) => this.clients.delete(id),
        this.logger
      );
    }

    return true;
  }

  async sendTo(clientId: string, event: string, data: any): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client) {
      LoggingUtils.logWarning(this.logger, `Attempted to send to non-existent client: ${clientId}`);
      return false;
    }

    return NetworkHelper.emitToSocket(client.socket, event, data, this.logger, clientId);
  }

  broadcast(event: string, data: any, excludeClientId?: string) {
    this.clients.forEach((client) => {
      if (client.id !== excludeClientId) {
        this.sendTo(client.id, event, data);
      }
    });
  }

  broadcastAll(event: string, data: any) {
    this.broadcast(event, data);
  }

  updateClientMetadata(clientId: string, metadata: Record<string, any>) {
    const client = this.clients.get(clientId);
    if (client) {
      client.metadata = WsHelper.updateMetadata(client.metadata, metadata);
      return true;
    }
    return false;
  }

  getClientMetadata(clientId: string): Record<string, any> | null {
    return this.clients.get(clientId)?.metadata ?? null;
  }

  isConnected(clientId: string): boolean {
    return this.clients.has(clientId);
  }

  get connectedCount(): number {
    return this.clients.size;
  }

  get connectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  disconnectClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      NetworkHelper.disconnectSocket(client.socket);
      this.clients.delete(clientId);
      LoggingUtils.logClientDisconnection(this.logger, clientId);
      return true;
    }
    return false;
  }

  disconnectAll() {
    this.clients.forEach((client) => {
      this.disconnectClient(client.id);
    });
    this.logger.log('All clients disconnected');
  }

  findClientsByMetadata(query: Record<string, any>): string[] {
    const filteredClients = WsHelper.filterClientsByMetadata(
      Array.from(this.clients.values()),
      query
    );
    return filteredClients.map(client => client.id);
  }

  getClients(): Map<string, SocketClient>
  {
    return this.clients;
  }
}