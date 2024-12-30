import { Logger } from '@nestjs/common';

export class LoggingUtils {
  static createLogger(context: string): Logger {
    return new Logger(context);
  }

  static logClientConnection(logger: Logger, clientId: string) {
    logger.log(`Client connected: ${clientId}`);
  }

  static logClientDisconnection(logger: Logger, clientId: string) {
    logger.log(`Client disconnected: ${clientId}`);
  }

  static logError(logger: Logger, clientId: string, error: any) {
    logger.error(`Error sending to client ${clientId}:`, error);
  }

  static logWarning(logger: Logger, message: string) {
    logger.warn(message);
  }
}