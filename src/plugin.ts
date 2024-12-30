import { RWSPlugin, DefaultRWSPluginOptionsType, NotifyService, NotifyServiceInstance, IRWSUser } from '@rws-framework/client';
import WSService, { WSServiceInstance, WSEvent, WSStatus } from './services/WSService';

WSService;

interface WSOptions extends DefaultRWSPluginOptionsType {
    auto_notify: boolean;
}

class RWSWebsocketsPlugin extends RWSPlugin<WSOptions> {
    async onClientStart(): Promise<void> 
    {                       
        const wsService: WSServiceInstance = this.container.get(WSService);
        const notifyService: NotifyServiceInstance = this.container.get(NotifyService);   
        console.log("ASDASDASDASD", this.options)     

        if(this.options.auto_notify){
            wsService.on('ws:disconnected', (instance, params) => {
                notifyService.notify(`Your websocket client disconnected from the server. Your ID was <strong>${params.socketId}</strong>`, 'error');
            });
    
            wsService.on('ws:connected', (instance, params) => {
                notifyService.notify('You are connected to websocket. Your ID is: <strong>' + instance.socket().id + '</strong>', 'info');
            });
    
            wsService.on('ws:reconnect', (instance, params) => {
                console.info('WS RECONNECTION ' + (params.reconnects + 1));
                notifyService.notify('Your websocket client has tried to reconnect to server. Attempt #' + (params.reconnects + 1), 'warning');
            });     
        }                
    };

    async onSetUser(user: IRWSUser): Promise<void> {        
        this.container.get(WSService).setUser(user);         
    }
}


export { RWSWebsocketsPlugin, WSService, WSServiceInstance, WSOptions };

export type {WSEvent, WSStatus}
