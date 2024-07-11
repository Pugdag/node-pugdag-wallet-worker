import { IRPC, RPC as Rpc, SubscriberItemMap } from '../types/custom-types';
import { WorkerCore } from './worker-core';
export type CBItem = {
    uid?: string;
    cb: Function;
};
export declare const UID: () => string;
export { IRPC };
export declare class Client {
    callbacks: Map<string, Function>;
    subscribers: SubscriberItemMap;
    pending: Map<string, {
        method: string;
        cb: Function;
    }>;
    verbose: boolean;
    log: Function;
    core: WorkerCore;
    constructor(core: WorkerCore, options?: any);
    cleanup(): void;
    addCB(key: string, cb: Function): string;
    req(fn: string, args: any[], rid?: string): void;
    call(method: string, data?: any, type?: string, uid?: string | undefined): Promise<unknown>;
    onConnect(callback: Function): void;
    onDisconnect(callback: Function): void;
    onConnectFailure(callback: Function): void;
    onError(callback: Function): void;
    disconnect(): void;
    connect(): void;
    subscribe<T>(subject: string, data: any, callback: Function): Rpc.SubPromise<T>;
    subject2EventName(subject: string): string;
    unSubscribe(subject: string, uid?: string): void;
}
export declare class RPC implements IRPC {
    client: Client;
    cleanup(): void;
    constructor(options?: any);
    onConnect(callback: Function): void;
    onConnectFailure(callback: Function): void;
    onError(callback: Function): void;
    onDisconnect(callback: Function): void;
    disconnect(): void;
    connect(): Promise<void>;
    unSubscribe(method: string, uid?: string): void;
    subscribe<T, R>(method: string, data: any, callback: Rpc.callback<R>): Rpc.SubPromise<T>;
    request<T>(method: string, data: any): Promise<T>;
    subscribeChainChanged(callback: Rpc.callback<Rpc.ChainChangedNotification>): Rpc.SubPromise<Rpc.NotifyChainChangedResponse>;
    subscribeBlockAdded(callback: Rpc.callback<Rpc.BlockAddedNotification>): Rpc.SubPromise<Rpc.NotifyBlockAddedResponse>;
    subscribeVirtualSelectedParentBlueScoreChanged(callback: Rpc.callback<Rpc.VirtualSelectedParentBlueScoreChangedNotification>): Rpc.SubPromise<Rpc.NotifyVirtualSelectedParentBlueScoreChangedResponse>;
    subscribeUtxosChanged(addresses: string[], callback: Rpc.callback<Rpc.UtxosChangedNotification>): Rpc.SubPromise<Rpc.NotifyUtxosChangedResponse>;
    unSubscribeUtxosChanged(uid?: string): void;
    getBlock(hash: string): Promise<Rpc.BlockResponse>;
    getTransactionsByAddresses(startingBlockHash: string, addresses: string[]): Promise<Rpc.TransactionsByAddressesResponse>;
    getUtxosByAddresses(addresses: string[]): Promise<Rpc.UTXOsByAddressesResponse>;
    submitTransaction(tx: Rpc.SubmitTransactionRequest): Promise<Rpc.SubmitTransactionResponse>;
    getVirtualSelectedParentBlueScore(): Promise<Rpc.VirtualSelectedParentBlueScoreResponse>;
    getBlockDagInfo(): Promise<Rpc.GetBlockDagInfoResponse>;
    subscribeVirtualDaaScoreChanged(callback: Rpc.callback<Rpc.VirtualDaaScoreChangedNotification>): Rpc.SubPromise<Rpc.NotifyVirtualDaaScoreChangedResponse>;
}
//# sourceMappingURL=rpc.d.ts.map