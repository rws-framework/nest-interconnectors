import { RWSContainer, RWSPlugin } from '@rws-framework/client';
import WSService, { WSServiceInstance } from './services/WSService';


class RWSWebsocket extends RWSPlugin {
    static componentsDir: string | null = './components';

    initPlugin(){
        const wsService: WSServiceInstance = RWSContainer().get(WSService);

        this.onClientStart(async () => {       
            
            wsService.on('ws:disconnected', (instance, params) => {
                this.client.notifyService.notify(`Your websocket client disconnected from the server. Your ID was <strong>${params.socketId}</strong>`, 'error');
            });

            wsService.on('ws:connected', (instance, params) => {
                this.client.notifyService.notify('You are connected to websocket. Your ID is: <strong>' + instance.socket().id + '</strong>', 'info');
            });

            wsService.on('ws:reconnect', (instance, params) => {
                console.info('WS RECONNECTION ' + (params.reconnects + 1));
                this.client.notifyService.notify('Your websocket client has tried to reconnect to server. Attempt #' + (params.reconnects+1), 'warning');
            });  

            wsService.init(this.client.appConfig.get('wsUrl'), this.client.appConfig.get('user'), this.client.appConfig.get('transports'));

            return this.client;
        });
    }
}

export { RWSWebsocket };