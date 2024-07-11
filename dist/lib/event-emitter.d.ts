export declare const CB: (msg: any) => void;
export type CB_FUNC = typeof CB;
export declare class EventEmitter {
    eventListeners: Map<string, CB_FUNC[]>;
    constructor();
    init(): void;
    on(eventName: string, fn: CB_FUNC): void;
    emit(eventName: string, data: any): void;
    postMessage(op: string, data?: any): void;
}
//# sourceMappingURL=event-emitter.d.ts.map