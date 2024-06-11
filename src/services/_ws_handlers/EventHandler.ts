import { WSServiceInstance, WSEvent } from '@rws-framework/nest-interconnectors';

function on(instance: WSServiceInstance, event: WSEvent, callback: (wsInstance: WSServiceInstance, params: any) => any): void {
    let listeners = instance.eventListeners.get(event);
    if (!listeners) {
        listeners = [];
        instance.eventListeners.set(event, listeners);
    }
    listeners.push(callback);
}

function executeEventListener(instance: WSServiceInstance, event: WSEvent, params: any = {}): void {    
    const listeners = instance.eventListeners.get(event);
    if (listeners) {
        listeners.forEach((callback: (instance: WSServiceInstance, params: any) => void) => {
            try {
                callback(instance, params);
            } catch (e) {
                console.error(`Error executing callback for event '${event}':`, e);
            }
        });
    }
}

export default {
    on,
    executeEventListener
};