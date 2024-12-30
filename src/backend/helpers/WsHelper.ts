import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LoggingUtils } from './LoggingUtils';

export interface SocketClient {
  id: string;
  socket: Socket;
  metadata?: Record<string, any>;
}

export class WsHelper {
  static createClient(
    clientId: string, 
    socket: Socket, 
    metadata: Record<string, any> = {}
  ): SocketClient {
    return {
      id: clientId,
      socket,
      metadata
    };
  }

  static setupDisconnectHandler(
    client: SocketClient,
    onDisconnect: (clientId: string) => void,
    logger: Logger
  ) {
    client.socket.on('disconnect', () => {
      onDisconnect(client.id);
      LoggingUtils.logClientDisconnection(logger, client.id);
    });
  }

  static filterClientsByMetadata(
    clients: SocketClient[],
    query: Record<string, any>
  ): SocketClient[] {
    return clients.filter(client => {
      return Object.entries(query).every(([key, value]) => 
        client.metadata?.[key] === value
      );
    });
  }

  static updateMetadata(
    existingMetadata: Record<string, any> = {},
    newMetadata: Record<string, any>
  ): Record<string, any> {
    return { ...existingMetadata, ...newMetadata };
  }
}