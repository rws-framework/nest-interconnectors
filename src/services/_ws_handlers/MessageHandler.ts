import { WSServiceInstance } from '../WSService';

function listenForMessage<T = unknown>(instance: WSServiceInstance, eventName: string, callback: (data: T, isJson?: boolean) => void, method?: string): WSServiceInstance {
    if (!instance.socket()) {
        throw new Error('socket is not active');
    }

    instance.socket().on(eventName, (data: any) => {
        try {            
            const parsedData = JSON.parse(data);
            if (!!method && parsedData.method === method) {                              
                callback(parsedData, true);
                instance.executeEventListener('ws:message_received', { message: parsedData });

            } else if (!method) {
                callback(parsedData, true);
            }            
        } catch (e) {
            console.error(e);
            
            if (!method) {                
                callback(data);
            }
        }
    });

    return instance;
}

function sendMessage<T>(instance: WSServiceInstance, gate: string, method: string, msg: T): void {
    if (!instance.socket()) {
        throw new Error('socket is not active');
    }

    const the_message = {
        user_id: instance.socket().id,
        method: method,
        msg: msg
    };

    
    instance.socket().emit(gate, JSON.stringify(the_message));
    instance.executeEventListener('ws:message_sent', { gate, message: the_message });
} 

export default{
    listenForMessage,
    sendMessage
};