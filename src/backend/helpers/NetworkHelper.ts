import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LoggingUtils } from './LoggingUtils';

export class NetworkHelper {
  static async emitToSocket(
    socket: Socket, 
    event: string, 
    data: any, 
    logger: Logger,
    clientId: string
  ): Promise<boolean> {
    try {
      await socket.emit(event, data);
      return true;
    } catch (error) {
      LoggingUtils.logError(logger, clientId, error);
      return false;
    }
  }

  static disconnectSocket(socket: Socket, force: boolean = true) {
    socket.disconnect(force);
  }
}