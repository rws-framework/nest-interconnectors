import { RWSClient, RWSClientInstance, RWSPlugin, DefaultRWSPluginOptionsType, NotifyService, NotifyServiceInstance, ConfigService, ConfigServiceInstance } from '@rws-framework/client';
import WSService, { WSServiceInstance, WSEvent, WSStatus } from './services/WSService';

WSService;

interface WSOptions extends DefaultRWSPluginOptionsType {

}

class RWSWebsocketsPlugin extends RWSPlugin<WSOptions> {
    async onClientStart(): Promise<void> 
    {       

        console.log('on ws start');
        const wsService: WSServiceInstance = this.container.get(WSService);
        const notifyService: NotifyServiceInstance = this.container.get(NotifyService);
        const appConfig: ConfigServiceInstance = this.container.get(ConfigService);

        wsService.on('ws:disconnected', (instance, params) => {
            notifyService.notify(`Your websocket client disconnected from the server. Your ID was <strong>${params.socketId}</strong>`, 'error');
        });

        wsService.on('ws:connected', (instance, params) => {
            notifyService.notify('You are connected to websocket. Your ID is: <strong>' + instance.socket().id + '</strong>', 'info');
        });

        wsService.on('ws:reconnect', (instance, params) => {
            console.info('WS RECONNECTION ' + (params.reconnects + 1));
            notifyService.notify('Your websocket client has tried to reconnect to server. Attempt #' + (params.reconnects+1), 'warning');
        });  

        wsService.init(appConfig.get('wsUrl'), appConfig.get('user'), appConfig.get('transports'));        
    };
}

export { RWSWebsocketsPlugin, WSService, WSServiceInstance, WSEvent, WSStatus };