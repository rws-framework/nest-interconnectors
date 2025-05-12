import TheService from '@rws-framework/client/src/services/_service';
import ITheUser from '@rws-framework/client/src/types/IRWSUser';
import { io, Socket } from 'socket.io-client';
import { v4 as uuid } from 'uuid';
import { ping, disconnect as disconnectWs, reconnect as reconnectWs } from './_ws_handlers/ConnectionHandler';
import WSEventHandler from './_ws_handlers/EventHandler';
import WSMessageHandler from './_ws_handlers/MessageHandler';
import { ConfigService, ConfigServiceInstance } from '@rws-framework/client';

type WSEvent = string;
type WSStatus = 'WS_OPEN' | 'WS_CLOSED' | 'WS_CONNECTING';

const  wsLog = async (fakeError: Error, text: any, socketId: string = null, isError: boolean = false): Promise<void> => {  
    const logit = isError ? console.error : console.log;
    logit(`<WS-CLIENT>${socketId ? `(${socketId})` : ''}`, text);
};

class WSService extends TheService {
    static _DEFAULT: boolean = false;
    static websocket_instance: Socket;
    private _ws: Socket | null = null;
    private socketId: string = null;
  
  
    private user: ITheUser | null = null;
    private url: string | null = null;
  
    private _status_string: WSStatus = 'WS_CLOSED';

    public _wsId: string | null = null;

  
    public _interval: any = null;    
    public _connecting: boolean = false;
    public _shut_down: boolean = false;
    public reconnects: number = 0;

    public eventListeners: Map<string, Array<(instance: WSService, params: any) => any>> = new Map();

    constructor(@ConfigService private configService: ConfigServiceInstance){
        super();
    }

    public init(): WSService {
        if(this.isActive()){
            return;
        }
        const url: string = this.configService.get('wsUrl');
        const transports: string[] = this.configService.get('transports');        
        
        this._connecting = true;        
        wsLog(new Error(), 'Connecting to: ' + url);
        this.url = url;     
        const user = this.user;     

        const headers = this.user?.jwt_token ? {
            Authorization: 'Bearer ' + this.user?.jwt_token,
        } : {};

        if(!WSService.websocket_instance){            
            const tokenString = headers.Authorization ? `?token=${this.user.jwt_token}` : '' ;
            WSService.websocket_instance = io(this.url + tokenString, { 
                auth: user?.jwt_token ? { token:  user.jwt_token} : {}, 
                transports:  transports || null 
            });
        }          
        
        this._ws = WSService.websocket_instance;

        if (this.user?.mongoId) {
            this._wsId = this.user.mongoId;
        }else{
            this._wsId = uuid();
        }        

        this._ws.on('connect', () => {
            this.handleConnect();
        });
        
        this._ws.on('__PONG__', async (data: any) => {              
            if (data === '__PONG__') {
                wsLog(new Error(), 'Recieving valid ping callback from server', this.socketId);                                                           
                return;
            }
        });

        this._ws.on('disconnect', async (e: Socket.DisconnectReason) => {              
          this.handleDisconnect(e);
        });

        this._ws.on('error', async (error: Error) => {
           this.handleError(error);
        });
        

        // this._interval = setInterval(() => {
        //     ping(_self);
        // }, 3000);

        this.reconnects = 0;

        if (this._ws?.connected) {
            this._connecting = false;
        }

        this.statusChange();

        return this;
    }

    public getStatus(): WSStatus {
        return this._status_string;
    }  

    public isActive(): boolean {
        return !this._connecting && this._ws?.connected;
    }

    setUser(user: ITheUser): void
    {
        this.user = user;
    }

    public listenForError<T extends Error | any = Error | any>(callback: (data: { error: T }) => void, method: string): void
    {
        this.socket().on(method, (rawData: string) => {            
            callback(JSON.parse(rawData));
        });
    }

    public listenForMessage<T = unknown>(eventName: string, callback: (data: T, isJson?: boolean) => void, method?: string): () => void 
    {
        if(!this.isActive()){
            this.init();
        }

        const disableHandler = () => {
            this.socket().off(method, callback);
        };

        WSMessageHandler.listenForMessage<T>(this, eventName, callback, method);

        return disableHandler.bind(this);
    }

    async waitForStatus(): Promise<void>
    {
        return new Promise((resolve, reject) => {
            let iteration = 0;
            const t = setInterval(() => {
                if(iteration > 4){
                    clearInterval(t);
                    reject('Websocket did not connect!');                  
                }

                if(this.isActive()){                        
                    clearInterval(t);
                    resolve();                  
                }

                iteration++;
            }, 1000);
        });
    }

    async waitForMessage<T>(eventName: string, msg: T, method: string | null): Promise<T>
    {
        return new Promise((resolve, reject) => {
            try {
                WSMessageHandler.listenForMessage(this, eventName,(data: T, isJson?: boolean) => {
                if(JSON.stringify(msg) === JSON.stringify(data)){
                    resolve(data);
                }
            }, method);
            } catch(e: Error | any){
                reject(e);
            }

        });
    }

    public sendMessage<T>(gate: string, method: string, msg: T): void {  
        if(!this.isActive()){
            this.init();
        }

        WSMessageHandler.sendMessage<T>(this, gate, method, msg);
    }

    public statusChange(): void {
        let status: WSStatus = 'WS_CLOSED';
        if (this._connecting) {
            status = 'WS_CONNECTING';
        } else if (this.isActive()) {
            status = 'WS_OPEN';
        }

        this.executeEventListener('ws:status_change', { status });      
        this._status_string = status;
    }

    public on(event: WSEvent, callback: (wsInstance: WSService, params: any) => any): void {
        WSEventHandler.on(this, event, callback);
    }

    public executeEventListener(event: WSEvent, params: any = {}): void {
        WSEventHandler.executeEventListener(this, event, params);
    }

    public socket(): Socket
    {
        return this._ws;
    }

    public disconnect()
    {
        disconnectWs(this);
    }

    public reconnect()
    {
        reconnectWs(this);
    }

    getUser(): ITheUser {
        return this.user;
    }

    getUrl(): string {
        return this.url;
    }

    handleConnect(){
        this.socketId = this.socket().id;
        wsLog(new Error(), 'Socket connected with ID: ' + this.socketId, this.socketId);

        this._connecting = false;
        this._ws.connected = true;  

        this.executeEventListener('ws:connected');               
    
        wsLog(new Error(), 'Emitting ping to server', this.socketId);
        ping(this);
    }

    handleDisconnect(e: Socket.DisconnectReason)
    {
        wsLog(new Error(), 'Disconnected from the server', this.socketId);              
        this.executeEventListener('ws:disconnected', { socketId: this.socketId, error: e });
        this.socketId = null;
    }

    handleError(error: Error) {
        wsLog(error, 'Socket error:', this.socketId, true);
        console.error(error);
        this.executeEventListener('ws:error', { socketId: this.socketId, error: error });
    }
}

export default WSService.getSingleton();
export { WSService as WSServiceInstance };

export type {
    WSEvent,
    WSStatus
};